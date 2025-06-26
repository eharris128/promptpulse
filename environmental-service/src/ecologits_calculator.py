"""
Custom Environmental Calculator - Implements EcoLogits-inspired methodology for environmental impact calculation
Based on EcoLogits research principles and model energy consumption estimates
Note: This is a custom implementation, not using the official EcoLogits package
"""

import logging
from typing import Dict, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ModelEnergyProfile:
    """Energy profile for a specific model"""
    name: str
    energy_per_input_token: float  # Wh per input token
    energy_per_output_token: float  # Wh per output token
    base_energy: float = 0.0  # Base energy consumption per request
    source: str = "ecologits_research"


class EcoLogitsCalculator:
    """
    Custom calculator implementing EcoLogits-inspired methodology for environmental impact.
    This is a standalone implementation based on EcoLogits research, not using the official package.
    """
    
    def __init__(self):
        self.model_profiles = self._initialize_model_profiles()
        logger.info(f"Custom environmental calculator initialized with {len(self.model_profiles)} model profiles")
    
    def _initialize_model_profiles(self) -> Dict[str, ModelEnergyProfile]:
        """
        Initialize model energy profiles based on EcoLogits research principles
        
        Note: These values are estimates based on EcoLogits-inspired methodology and research.
        Actual values may vary based on infrastructure and model versions.
        This is a custom implementation, not using the official EcoLogits package.
        """
        profiles = {}
        
        # Claude 3.5 Sonnet models
        # Based on EcoLogits research and model complexity estimates
        claude_3_5_sonnet_base = ModelEnergyProfile(
            name="claude-3-5-sonnet",
            energy_per_input_token=0.0001,  # ~0.1 mWh per input token
            energy_per_output_token=0.0003,  # ~0.3 mWh per output token
            base_energy=0.01,  # 10mWh base per request
            source="ecologits_estimate"
        )
        
        # Map various Claude model names to profiles
        claude_models = [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-sonnet",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-3-opus-20240229"
        ]
        
        for model_name in claude_models:
            if "haiku" in model_name.lower():
                # Haiku is smaller/more efficient
                profiles[model_name] = ModelEnergyProfile(
                    name=model_name,
                    energy_per_input_token=0.00005,  # ~0.05 mWh per input token
                    energy_per_output_token=0.00015,  # ~0.15 mWh per output token
                    base_energy=0.005,  # 5mWh base per request
                    source="ecologits_estimate"
                )
            elif "opus" in model_name.lower():
                # Opus is larger/more intensive
                profiles[model_name] = ModelEnergyProfile(
                    name=model_name,
                    energy_per_input_token=0.0002,  # ~0.2 mWh per input token
                    energy_per_output_token=0.0005,  # ~0.5 mWh per output token
                    base_energy=0.02,  # 20mWh base per request
                    source="ecologits_estimate"
                )
            else:
                # Default to Sonnet profile
                profiles[model_name] = claude_3_5_sonnet_base
        
        return profiles
    
    def get_supported_models(self) -> List[Dict[str, any]]:
        """Get list of supported models with their energy profiles"""
        models = []
        for model_name, profile in self.model_profiles.items():
            models.append({
                "name": model_name,
                "energy_per_input_token_wh": profile.energy_per_input_token,
                "energy_per_output_token_wh": profile.energy_per_output_token,
                "base_energy_wh": profile.base_energy,
                "source": profile.source
            })
        return sorted(models, key=lambda x: x['name'])
    
    def calculate_energy_consumption(
        self, 
        model: str, 
        input_tokens: int, 
        output_tokens: int
    ) -> float:
        """
        Calculate energy consumption in Wh based on EcoLogits-inspired methodology
        
        Args:
            model: Model name (e.g., "claude-3-5-sonnet-20241022")
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Energy consumption in Wh (watt-hours)
        """
        try:
            # Get model profile, fallback to default if not found
            profile = self._get_model_profile(model)
            
            # Calculate total energy consumption
            input_energy = input_tokens * profile.energy_per_input_token
            output_energy = output_tokens * profile.energy_per_output_token
            base_energy = profile.base_energy
            
            total_energy = input_energy + output_energy + base_energy
            
            logger.debug(f"Energy calculation for {model}: "
                        f"input={input_energy:.6f}Wh, output={output_energy:.6f}Wh, "
                        f"base={base_energy:.6f}Wh, total={total_energy:.6f}Wh")
            
            return total_energy
            
        except Exception as e:
            logger.error(f"Error calculating energy consumption: {e}")
            # Fallback calculation
            return self._fallback_energy_calculation(input_tokens, output_tokens)
    
    def _get_model_profile(self, model: str) -> ModelEnergyProfile:
        """Get model profile, with fallback logic"""
        # Direct match
        if model in self.model_profiles:
            return self.model_profiles[model]
        
        # Fuzzy matching for model variants
        model_lower = model.lower()
        for profile_name, profile in self.model_profiles.items():
            if profile_name.lower() in model_lower or model_lower in profile_name.lower():
                logger.debug(f"Fuzzy matched {model} to {profile_name}")
                return profile
        
        # Model family matching
        if "haiku" in model_lower:
            return self._get_haiku_profile()
        elif "opus" in model_lower:
            return self._get_opus_profile()
        elif "sonnet" in model_lower or "claude" in model_lower:
            return self._get_sonnet_profile()
        
        # Ultimate fallback
        logger.warning(f"Unknown model {model}, using default profile")
        return self._get_default_profile()
    
    def _get_haiku_profile(self) -> ModelEnergyProfile:
        """Get Haiku model profile"""
        return ModelEnergyProfile(
            name="claude-haiku-fallback",
            energy_per_input_token=0.00005,
            energy_per_output_token=0.00015,
            base_energy=0.005,
            source="fallback_estimate"
        )
    
    def _get_opus_profile(self) -> ModelEnergyProfile:
        """Get Opus model profile"""
        return ModelEnergyProfile(
            name="claude-opus-fallback",
            energy_per_input_token=0.0002,
            energy_per_output_token=0.0005,
            base_energy=0.02,
            source="fallback_estimate"
        )
    
    def _get_sonnet_profile(self) -> ModelEnergyProfile:
        """Get Sonnet model profile"""
        return ModelEnergyProfile(
            name="claude-sonnet-fallback",
            energy_per_input_token=0.0001,
            energy_per_output_token=0.0003,
            base_energy=0.01,
            source="fallback_estimate"
        )
    
    def _get_default_profile(self) -> ModelEnergyProfile:
        """Get default model profile for unknown models"""
        return ModelEnergyProfile(
            name="unknown-model-fallback",
            energy_per_input_token=0.0001,
            energy_per_output_token=0.0003,
            base_energy=0.01,
            source="default_fallback"
        )
    
    def _fallback_energy_calculation(self, input_tokens: int, output_tokens: int) -> float:
        """
        Fallback energy calculation when model profile lookup fails
        Based on rough industry averages
        """
        # Conservative estimate: ~0.1mWh per token average
        total_tokens = input_tokens + output_tokens
        energy_wh = total_tokens * 0.0001  # 0.1 mWh per token
        
        logger.warning(f"Using fallback energy calculation: {energy_wh:.6f}Wh for {total_tokens} tokens")
        return energy_wh
    
    def test_calculation(self) -> Dict[str, any]:
        """Test calculation functionality"""
        try:
            # Test with a standard request
            test_energy = self.calculate_energy_consumption(
                model="claude-3-5-sonnet-20241022",
                input_tokens=100,
                output_tokens=200
            )
            
            return {
                "status": "working",
                "test_energy_wh": test_energy,
                "supported_models_count": len(self.model_profiles)
            }
        except Exception as e:
            logger.error(f"Calculator test failed: {e}")
            return {
                "status": "error", 
                "error": str(e)
            }
    
    def get_model_efficiency_rating(self, model: str) -> str:
        """Get efficiency rating for a model"""
        profile = self._get_model_profile(model)
        avg_energy_per_token = (profile.energy_per_input_token + profile.energy_per_output_token) / 2
        
        if avg_energy_per_token < 0.0001:
            return "highly_efficient"
        elif avg_energy_per_token < 0.0003:
            return "efficient"
        elif avg_energy_per_token < 0.0005:
            return "moderate"
        else:
            return "intensive"
    
    def estimate_session_impact(self, sessions: List[Dict]) -> Dict[str, float]:
        """Estimate total environmental impact for multiple sessions"""
        total_energy = 0.0
        total_tokens = 0
        
        for session in sessions:
            energy = self.calculate_energy_consumption(
                model=session.get('model', 'claude-3-5-sonnet-20241022'),
                input_tokens=session.get('input_tokens', 0),
                output_tokens=session.get('output_tokens', 0)
            )
            total_energy += energy
            total_tokens += session.get('input_tokens', 0) + session.get('output_tokens', 0)
        
        return {
            "total_energy_wh": total_energy,
            "total_tokens": total_tokens,
            "average_energy_per_token": total_energy / total_tokens if total_tokens > 0 else 0.0,
            "sessions_count": len(sessions)
        }