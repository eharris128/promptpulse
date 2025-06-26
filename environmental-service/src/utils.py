"""
Utility functions for environmental service
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def validate_request_data(data: Dict[str, Any]) -> Optional[str]:
    """
    Validate request data for environmental impact calculation
    
    Args:
        data: Request data dictionary
        
    Returns:
        Error message if validation fails, None if valid
    """
    required_fields = ['model', 'input_tokens', 'output_tokens']
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            return f"Missing required field: {field}"
    
    # Validate model
    model = data['model']
    if not isinstance(model, str) or len(model.strip()) == 0:
        return "Model must be a non-empty string"
    
    # Validate token counts
    input_tokens = data['input_tokens']
    output_tokens = data['output_tokens']
    
    if not isinstance(input_tokens, int) or input_tokens < 0:
        return "input_tokens must be a non-negative integer"
    
    if not isinstance(output_tokens, int) or output_tokens < 0:
        return "output_tokens must be a non-negative integer"
    
    # Validate reasonable limits
    if input_tokens > 1_000_000:
        return "input_tokens exceeds reasonable limit (1M)"
    
    if output_tokens > 1_000_000:
        return "output_tokens exceeds reasonable limit (1M)"
    
    # Validate optional fields if present
    if 'timestamp' in data:
        timestamp = data['timestamp']
        if timestamp and not isinstance(timestamp, str):
            return "timestamp must be a string in ISO format"
        
        # Try to parse timestamp
        if timestamp:
            try:
                datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except ValueError:
                return "timestamp must be a valid ISO format string"
    
    if 'location' in data:
        location = data['location']
        if location and (not isinstance(location, str) or len(location.strip()) == 0):
            return "location must be a non-empty string"
    
    return None


def format_environmental_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format environmental impact response with consistent structure
    
    Args:
        data: Raw environmental impact data
        
    Returns:
        Formatted response dictionary
    """
    try:
        energy_wh = float(data.get('energy_wh', 0))
        co2_emissions_g = float(data.get('co2_emissions_g', 0))
        carbon_intensity_g_kwh = float(data.get('carbon_intensity_g_kwh', 0))
        tree_equivalent = float(data.get('tree_equivalent', 0))
        
        # Generate equivalent text
        equivalent_text = generate_tree_equivalent_text(tree_equivalent)
        
        response = {
            "energy_wh": round(energy_wh, 6),
            "co2_emissions_g": round(co2_emissions_g, 6),
            "carbon_intensity_g_kwh": round(carbon_intensity_g_kwh, 2),
            "tree_equivalent": round(tree_equivalent, 3),
            "equivalent_text": equivalent_text,
            "source": data.get('source', 'ecologits_methodology'),
            "location": data.get('location', 'us-west-1'),
            "timestamp": data.get('timestamp', datetime.now().isoformat()),
            "additional_equivalents": calculate_additional_equivalents(co2_emissions_g)
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error formatting environmental response: {e}")
        return {
            "error": "Error formatting response",
            "source": "error",
            "energy_wh": 0,
            "co2_emissions_g": 0,
            "carbon_intensity_g_kwh": 0,
            "tree_equivalent": 0,
            "equivalent_text": "calculation error"
        }


def generate_tree_equivalent_text(tree_equivalent: float) -> str:
    """
    Generate natural language tree equivalent text
    
    Args:
        tree_equivalent: Tree equivalent value (days)
        
    Returns:
        Natural language description
    """
    if tree_equivalent <= 0:
        return "negligible environmental impact"
    elif tree_equivalent < 0.01:
        return "less than 1% of what a tree absorbs daily"
    elif tree_equivalent < 0.1:
        percent = round(tree_equivalent * 100)
        return f"{percent}% of what a tree absorbs daily"
    elif tree_equivalent < 1:
        return f"same CO2 as {tree_equivalent:.1f} of a tree absorbs daily"
    elif tree_equivalent < 2:
        return f"same CO2 as {tree_equivalent:.1f} tree absorbs daily"
    else:
        return f"same CO2 as {tree_equivalent:.1f} trees absorb daily"


def calculate_additional_equivalents(co2_grams: float) -> Dict[str, Any]:
    """
    Calculate additional environmental equivalents
    
    Args:
        co2_grams: CO2 emissions in grams
        
    Returns:
        Dictionary of various equivalents
    """
    if co2_grams <= 0:
        return {
            "phone_charges": 0,
            "miles_driven": 0,
            "led_hours": 0,
            "laptop_hours": 0
        }
    
    # Conversion factors (approximate)
    PHONE_CHARGE_CO2 = 8      # grams CO2 per phone charge
    CAR_CO2_PER_MILE = 411    # grams CO2 per mile (average car)
    LED_CO2_PER_HOUR = 0.5    # grams CO2 per LED bulb hour
    LAPTOP_CO2_PER_HOUR = 20  # grams CO2 per laptop hour
    
    return {
        "phone_charges": round(co2_grams / PHONE_CHARGE_CO2, 2),
        "miles_driven": round(co2_grams / CAR_CO2_PER_MILE, 3),
        "led_hours": round(co2_grams / LED_CO2_PER_HOUR, 1),
        "laptop_hours": round(co2_grams / LAPTOP_CO2_PER_HOUR, 2)
    }


def format_energy_display(energy_wh: float) -> str:
    """Format energy for display"""
    if energy_wh < 0.001:
        return f"{energy_wh * 1000:.1f}mWh"
    elif energy_wh < 1:
        return f"{energy_wh:.3f}Wh"
    elif energy_wh < 1000:
        return f"{energy_wh:.1f}Wh"
    else:
        return f"{energy_wh / 1000:.2f}kWh"


def format_co2_display(co2_grams: float) -> str:
    """Format CO2 emissions for display"""
    if co2_grams < 0.001:
        return f"{co2_grams * 1000:.1f}mg CO2"
    elif co2_grams < 1:
        return f"{co2_grams:.3f}g CO2"
    elif co2_grams < 1000:
        return f"{co2_grams:.1f}g CO2"
    else:
        return f"{co2_grams / 1000:.2f}kg CO2"


def calculate_efficiency_rating(co2_per_token: float) -> Dict[str, str]:
    """
    Calculate efficiency rating based on CO2 per token
    
    Args:
        co2_per_token: CO2 emissions per output token
        
    Returns:
        Rating information
    """
    if co2_per_token <= 0.0001:
        return {
            "rating": "excellent",
            "color": "#22c55e",
            "description": "Highly efficient usage",
            "level": "A+"
        }
    elif co2_per_token <= 0.0005:
        return {
            "rating": "good",
            "color": "#84cc16",
            "description": "Good efficiency",
            "level": "A"
        }
    elif co2_per_token <= 0.001:
        return {
            "rating": "average",
            "color": "#eab308",
            "description": "Average efficiency",
            "level": "B"
        }
    elif co2_per_token <= 0.002:
        return {
            "rating": "poor",
            "color": "#f97316",
            "description": "Below average efficiency",
            "level": "C"
        }
    else:
        return {
            "rating": "very_poor",
            "color": "#ef4444",
            "description": "Low efficiency",
            "level": "D"
        }


def generate_environmental_insight(
    co2_grams: float, 
    output_tokens: int,
    comparison_data: Optional[Dict] = None
) -> str:
    """
    Generate environmental insight text
    
    Args:
        co2_grams: CO2 emissions
        output_tokens: Number of output tokens
        comparison_data: Optional historical data for comparison
        
    Returns:
        Insight text
    """
    if output_tokens <= 0:
        return "No output tokens generated."
    
    efficiency = co2_grams / output_tokens
    rating = calculate_efficiency_rating(efficiency)
    
    insight = f"Environmental efficiency: {rating['level']} ({rating['description']})."
    
    # Add comparison if available
    if comparison_data:
        avg_efficiency = comparison_data.get('average_efficiency', 0)
        if avg_efficiency > 0:
            if efficiency < avg_efficiency * 0.8:
                insight += " This session was more efficient than your average."
            elif efficiency > avg_efficiency * 1.2:
                insight += " This session was less efficient than your average."
            else:
                insight += " This session efficiency is typical for you."
    
    return insight


def sanitize_model_name(model_name: str) -> str:
    """Sanitize and normalize model name"""
    if not isinstance(model_name, str):
        return "unknown"
    
    # Remove extra whitespace and convert to lowercase
    sanitized = model_name.strip().lower()
    
    # Basic validation
    if len(sanitized) == 0:
        return "unknown"
    
    if len(sanitized) > 100:  # Reasonable limit
        return sanitized[:100]
    
    return sanitized


def validate_location(location: str) -> str:
    """Validate and normalize location"""
    if not isinstance(location, str):
        return "us-west-1"  # Default
    
    location = location.strip().lower()
    
    # List of valid locations
    valid_locations = [
        'us-west-1', 'us-west-2', 'us-east-1', 'us-east-2',
        'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1',
        'california', 'oregon', 'virginia', 'ohio', 'ireland',
        'germany', 'singapore', 'japan'
    ]
    
    if location in valid_locations:
        return location
    
    # Default fallback
    return "us-west-1"


def create_error_response(error_message: str, error_code: str = "calculation_error") -> Dict[str, Any]:
    """Create standardized error response"""
    return {
        "error": error_message,
        "error_code": error_code,
        "timestamp": datetime.now().isoformat(),
        "energy_wh": 0,
        "co2_emissions_g": 0,
        "carbon_intensity_g_kwh": 0,
        "tree_equivalent": 0,
        "equivalent_text": "calculation error",
        "source": "error"
    }