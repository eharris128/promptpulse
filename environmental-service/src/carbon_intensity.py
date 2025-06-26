"""
Carbon Intensity Service - Real-time carbon intensity data for environmental calculations
Supports multiple APIs: ElectricityMaps, WattTime, and fallback estimates
"""

import os
import logging
import requests
from datetime import datetime, timezone
from typing import Dict, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)


class CarbonIntensityService:
    """
    Service for retrieving real-time carbon intensity data
    """
    
    def __init__(self):
        self.electricity_maps_token = os.getenv('ELECTRICITY_MAPS_TOKEN')
        self.watt_time_username = os.getenv('WATT_TIME_USERNAME')
        self.watt_time_password = os.getenv('WATT_TIME_PASSWORD')
        self.watt_time_token = None
        
        # Regional fallback values (gCO2/kWh) - based on 2024 estimates
        self.regional_fallbacks = {
            'us-west-1': 350,    # California - mix of renewable and natural gas
            'us-west-2': 380,    # Oregon/Washington - hydro + coal
            'us-east-1': 420,    # Virginia - coal + natural gas + nuclear
            'us-east-2': 450,    # Ohio - coal heavy
            'eu-west-1': 300,    # Ireland - wind + natural gas
            'eu-central-1': 400, # Germany - renewables + coal
            'ap-southeast-1': 500, # Singapore - natural gas
            'ap-northeast-1': 350, # Japan - nuclear + natural gas + renewables
            'default': 400       # Global average
        }
        
        logger.info("Carbon intensity service initialized")
    
    def get_carbon_intensity(
        self, 
        location: str, 
        timestamp: Optional[str] = None
    ) -> float:
        """
        Get carbon intensity for a location and time
        
        Args:
            location: Location identifier (e.g., 'us-west-1', 'california', 'DE')
            timestamp: ISO timestamp (defaults to current time)
            
        Returns:
            Carbon intensity in gCO2/kWh
        """
        try:
            # Normalize location
            normalized_location = self._normalize_location(location)
            
            # Try ElectricityMaps first (most comprehensive)
            if self.electricity_maps_token:
                intensity = self._get_electricity_maps_intensity(normalized_location, timestamp)
                if intensity:
                    logger.debug(f"ElectricityMaps intensity for {location}: {intensity} gCO2/kWh")
                    return intensity
            
            # Try WattTime for US locations
            if normalized_location.startswith('us-') and self.watt_time_username:
                intensity = self._get_watt_time_intensity(normalized_location, timestamp)
                if intensity:
                    logger.debug(f"WattTime intensity for {location}: {intensity} gCO2/kWh")
                    return intensity
            
            # Fallback to regional estimates
            fallback = self._get_fallback_intensity(normalized_location)
            logger.debug(f"Fallback intensity for {location}: {fallback} gCO2/kWh")
            return fallback
            
        except Exception as e:
            logger.error(f"Error getting carbon intensity for {location}: {e}")
            return self.regional_fallbacks.get('default', 400)
    
    def _normalize_location(self, location: str) -> str:
        """Normalize location string for consistent lookup"""
        location = location.lower().strip()
        
        # AWS region mapping
        aws_regions = {
            'us-west-1': 'us-west-1',      # California
            'us-west-2': 'us-west-2',      # Oregon
            'us-east-1': 'us-east-1',      # Virginia
            'us-east-2': 'us-east-2',      # Ohio
            'eu-west-1': 'eu-west-1',      # Ireland
            'eu-central-1': 'eu-central-1', # Germany
            'ap-southeast-1': 'ap-southeast-1', # Singapore
            'ap-northeast-1': 'ap-northeast-1', # Japan
        }
        
        if location in aws_regions:
            return aws_regions[location]
        
        # Country/state mapping
        location_mapping = {
            'california': 'us-west-1',
            'oregon': 'us-west-2',
            'washington': 'us-west-2',
            'virginia': 'us-east-1',
            'ohio': 'us-east-2',
            'ireland': 'eu-west-1',
            'germany': 'eu-central-1',
            'singapore': 'ap-southeast-1',
            'japan': 'ap-northeast-1',
            'de': 'eu-central-1',
            'ie': 'eu-west-1',
            'sg': 'ap-southeast-1',
            'jp': 'ap-northeast-1'
        }
        
        return location_mapping.get(location, location)
    
    def _get_electricity_maps_intensity(
        self, 
        location: str, 
        timestamp: Optional[str] = None
    ) -> Optional[float]:
        """Get carbon intensity from ElectricityMaps API"""
        try:
            # Map our location to ElectricityMaps zone
            zone_mapping = {
                'us-west-1': 'US-CAL-CISO',
                'us-west-2': 'US-NW-PACW',
                'us-east-1': 'US-VA',
                'us-east-2': 'US-MIDW-MISO',
                'eu-west-1': 'IE',
                'eu-central-1': 'DE',
                'ap-southeast-1': 'SG',
                'ap-northeast-1': 'JP'
            }
            
            zone = zone_mapping.get(location)
            if not zone:
                return None
            
            url = f"https://api.electricitymap.org/v3/carbon-intensity/latest"
            headers = {'auth-token': self.electricity_maps_token}
            params = {'zone': zone}
            
            response = requests.get(url, headers=headers, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return float(data.get('carbonIntensity', 0))
            else:
                logger.warning(f"ElectricityMaps API error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"ElectricityMaps API error: {e}")
            return None
    
    def _get_watt_time_intensity(
        self, 
        location: str, 
        timestamp: Optional[str] = None
    ) -> Optional[float]:
        """Get carbon intensity from WattTime API (US only)"""
        try:
            # WattTime requires authentication
            if not self.watt_time_token:
                self.watt_time_token = self._authenticate_watt_time()
            
            if not self.watt_time_token:
                return None
            
            # Map location to WattTime region
            region_mapping = {
                'us-west-1': 'CAISO_NORTH',
                'us-west-2': 'PACW',
                'us-east-1': 'PJM_DC',
                'us-east-2': 'MISO_IN'
            }
            
            region = region_mapping.get(location)
            if not region:
                return None
            
            url = "https://api2.watttime.org/v2/index"
            headers = {'Authorization': f'Bearer {self.watt_time_token}'}
            params = {'ba': region}
            
            response = requests.get(url, headers=headers, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                # WattTime returns MOER (Marginal Operating Emissions Rate)
                # Convert from lbs/MWh to g/kWh
                moer_lbs_mwh = float(data.get('moer', 0))
                moer_g_kwh = moer_lbs_mwh * 453.592 / 1000  # Convert lbs to g, MWh to kWh
                return moer_g_kwh
            else:
                logger.warning(f"WattTime API error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"WattTime API error: {e}")
            return None
    
    def _authenticate_watt_time(self) -> Optional[str]:
        """Authenticate with WattTime API"""
        try:
            if not (self.watt_time_username and self.watt_time_password):
                return None
            
            url = "https://api2.watttime.org/v2/login"
            auth = (self.watt_time_username, self.watt_time_password)
            
            response = requests.get(url, auth=auth, timeout=5)
            if response.status_code == 200:
                data = response.json()
                token = data.get('token')
                logger.info("WattTime authentication successful")
                return token
            else:
                logger.error(f"WattTime authentication failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"WattTime authentication error: {e}")
            return None
    
    def _get_fallback_intensity(self, location: str) -> float:
        """Get fallback carbon intensity based on regional estimates"""
        return self.regional_fallbacks.get(location, self.regional_fallbacks['default'])
    
    @lru_cache(maxsize=100)
    def get_cached_intensity(self, location: str) -> float:
        """Get cached carbon intensity (cached for 5 minutes)"""
        return self.get_carbon_intensity(location)
    
    def test_connection(self) -> Dict[str, any]:
        """Test carbon intensity service connections"""
        results = {
            "electricity_maps": False,
            "watt_time": False,
            "fallback": True
        }
        
        # Test ElectricityMaps
        if self.electricity_maps_token:
            try:
                intensity = self._get_electricity_maps_intensity('us-west-1')
                results["electricity_maps"] = intensity is not None
            except:
                pass
        
        # Test WattTime
        if self.watt_time_username and self.watt_time_password:
            try:
                token = self._authenticate_watt_time()
                results["watt_time"] = token is not None
            except:
                pass
        
        return results
    
    def get_regional_averages(self) -> Dict[str, float]:
        """Get all regional fallback values"""
        return self.regional_fallbacks.copy()
    
    def estimate_daily_variation(self, location: str) -> Dict[str, float]:
        """Estimate daily carbon intensity variation for a location"""
        base_intensity = self._get_fallback_intensity(location)
        
        # Rough estimates of daily variation
        return {
            "base_intensity": base_intensity,
            "morning_peak": base_intensity * 1.2,  # 20% higher in morning
            "midday_low": base_intensity * 0.8,    # 20% lower when solar peaks
            "evening_peak": base_intensity * 1.3,  # 30% higher in evening
            "night_low": base_intensity * 0.9      # 10% lower at night
        }