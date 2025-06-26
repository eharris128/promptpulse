#!/usr/bin/env python3
"""
Test script for environmental service
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.ecologits_calculator import EcoLogitsCalculator
from src.carbon_intensity import CarbonIntensityService
from src.utils import format_environmental_response, validate_request_data

def test_calculator():
    """Test the calculator functionality"""
    print("🧪 Testing EcoLogits Calculator...")
    
    calculator = EcoLogitsCalculator()
    
    # Test calculation
    energy = calculator.calculate_energy_consumption(
        model="claude-3-5-sonnet-20241022",
        input_tokens=150,
        output_tokens=500
    )
    
    print(f"✅ Energy calculation: {energy:.6f} Wh")
    
    # Test supported models
    models = calculator.get_supported_models()
    print(f"✅ Supported models: {len(models)}")
    
    return energy

def test_carbon_service():
    """Test the carbon intensity service"""
    print("\n🧪 Testing Carbon Intensity Service...")
    
    carbon_service = CarbonIntensityService()
    
    # Test carbon intensity
    intensity = carbon_service.get_carbon_intensity("us-west-1")
    print(f"✅ Carbon intensity: {intensity} gCO2/kWh")
    
    return intensity

def test_full_calculation():
    """Test full environmental calculation"""
    print("\n🧪 Testing Full Environmental Calculation...")
    
    calculator = EcoLogitsCalculator()
    carbon_service = CarbonIntensityService()
    
    # Input data
    model = "claude-3-5-sonnet-20241022"
    input_tokens = 150
    output_tokens = 500
    location = "us-west-1"
    
    # Calculate energy
    energy_wh = calculator.calculate_energy_consumption(model, input_tokens, output_tokens)
    
    # Get carbon intensity
    carbon_intensity = carbon_service.get_carbon_intensity(location)
    
    # Calculate CO2
    co2_emissions_g = (energy_wh / 1000) * carbon_intensity
    
    # Calculate tree equivalent
    tree_equivalent = co2_emissions_g / 50.0
    
    # Format response
    response_data = {
        "energy_wh": energy_wh,
        "co2_emissions_g": co2_emissions_g,
        "carbon_intensity_g_kwh": carbon_intensity,
        "tree_equivalent": tree_equivalent,
        "source": "test_calculation",
        "location": location
    }
    
    formatted_response = format_environmental_response(response_data)
    
    print(f"✅ Full calculation result:")
    print(f"   Energy: {formatted_response['energy_wh']} Wh")
    print(f"   CO2: {formatted_response['co2_emissions_g']} g")
    print(f"   Tree equivalent: {formatted_response['tree_equivalent']}")
    print(f"   Equivalent text: {formatted_response['equivalent_text']}")
    
    return formatted_response

def test_validation():
    """Test request validation"""
    print("\n🧪 Testing Request Validation...")
    
    # Valid request
    valid_data = {
        "model": "claude-3-5-sonnet-20241022",
        "input_tokens": 150,
        "output_tokens": 500
    }
    
    error = validate_request_data(valid_data)
    if error:
        print(f"❌ Valid data failed validation: {error}")
    else:
        print("✅ Valid data passed validation")
    
    # Invalid request
    invalid_data = {
        "model": "",
        "input_tokens": -1,
        "output_tokens": "not_a_number"
    }
    
    error = validate_request_data(invalid_data)
    if error:
        print(f"✅ Invalid data correctly rejected: {error}")
    else:
        print("❌ Invalid data incorrectly passed validation")

if __name__ == "__main__":
    print("🌱 Environmental Service Test Suite")
    print("=" * 50)
    
    try:
        test_calculator()
        test_carbon_service()
        test_full_calculation()
        test_validation()
        
        print("\n🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)