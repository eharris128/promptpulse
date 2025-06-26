"""
Environmental Impact Calculation Service for PromptPulse
Using EcoLogits-inspired methodology to calculate CO2 emissions and environmental impact
Custom implementation based on EcoLogits research principles
"""

import os
import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify, g
from dotenv import load_dotenv

from .ecologits_calculator import EcoLogitsCalculator
from .carbon_intensity import CarbonIntensityService
from .utils import format_environmental_response, validate_request_data

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Initialize services
calculator = EcoLogitsCalculator()
carbon_service = CarbonIntensityService()

# In-memory cache (simple fallback for Redis)
cache_dict = {}


@app.before_request
def before_request():
    """Initialize request context"""
    g.start_time = datetime.now(timezone.utc)


@app.after_request
def after_request(response):
    """Log request completion"""
    duration = (datetime.now(timezone.utc) - g.start_time).total_seconds() * 1000
    logger.info(f"{request.method} {request.path} - {response.status_code} - {duration:.2f}ms")
    return response


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test calculator
        test_result = calculator.test_calculation()
        
        # Test carbon intensity service
        carbon_test = carbon_service.test_connection()
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {
                "calculator": test_result,
                "carbon_intensity": carbon_test,
                "redis": redis_client is not None
            }
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


@app.route('/calculate-impact', methods=['POST'])
def calculate_impact():
    """
    Calculate environmental impact for usage data
    
    Expected request body:
    {
        "model": "claude-3-5-sonnet-20241022",
        "input_tokens": 150,
        "output_tokens": 500,
        "timestamp": "2025-06-25T10:30:00Z",
        "location": "us-west-1"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        # Validate request data
        validation_error = validate_request_data(data)
        if validation_error:
            return jsonify({"error": validation_error}), 400
        
        model = data['model']
        input_tokens = data['input_tokens']
        output_tokens = data['output_tokens']
        timestamp = data.get('timestamp', datetime.now(timezone.utc).isoformat())
        location = data.get('location', 'us-west-1')
        
        logger.info(f"Calculating impact for {model}: {input_tokens}+{output_tokens} tokens")
        
        # Check cache first
        cache_key = f"impact:{model}:{input_tokens}:{output_tokens}:{location}"
        cached_result = get_cached_result(cache_key)
        if cached_result:
            logger.debug(f"Cache hit for {cache_key}")
            return jsonify(cached_result)
        
        # Calculate energy consumption using EcoLogits methodology
        energy_wh = calculator.calculate_energy_consumption(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )
        
        # Get carbon intensity for location and time
        carbon_intensity_g_kwh = carbon_service.get_carbon_intensity(
            location=location,
            timestamp=timestamp
        )
        
        # Calculate CO2 emissions
        co2_emissions_g = (energy_wh / 1000) * carbon_intensity_g_kwh
        
        # Calculate tree equivalent (50g CO2 per tree per day)
        tree_equivalent = co2_emissions_g / 50.0
        
        # Format response
        result = format_environmental_response({
            "energy_wh": energy_wh,
            "co2_emissions_g": co2_emissions_g,
            "carbon_intensity_g_kwh": carbon_intensity_g_kwh,
            "tree_equivalent": tree_equivalent,
            "source": "custom_ecologits_inspired",
            "location": location,
            "timestamp": timestamp
        })
        
        # Cache result
        cache_result(cache_key, result)
        
        logger.info(f"Impact calculated: {co2_emissions_g:.3f}g CO2, {tree_equivalent:.3f} tree equivalent")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error calculating impact: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/batch-calculate', methods=['POST'])
def batch_calculate():
    """
    Calculate environmental impact for multiple usage records
    
    Expected request body:
    {
        "records": [
            {
                "model": "claude-3-5-sonnet-20241022",
                "input_tokens": 150,
                "output_tokens": 500,
                "timestamp": "2025-06-25T10:30:00Z",
                "location": "us-west-1"
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        if not data or 'records' not in data:
            return jsonify({"error": "No records provided"}), 400
        
        records = data['records']
        if len(records) > 1000:  # Limit batch size
            return jsonify({"error": "Batch size too large (max 1000)"}), 400
        
        results = []
        for i, record in enumerate(records):
            try:
                # Validate each record
                validation_error = validate_request_data(record)
                if validation_error:
                    results.append({"error": f"Record {i}: {validation_error}"})
                    continue
                
                # Calculate impact (reuse single calculation logic)
                with app.test_request_context('/calculate-impact', json=record):
                    response = calculate_impact()
                    if response[1] == 200:  # Success
                        results.append(response[0].get_json())
                    else:
                        results.append({"error": f"Calculation failed for record {i}"})
                        
            except Exception as e:
                logger.error(f"Error processing record {i}: {e}")
                results.append({"error": f"Record {i}: {str(e)}"})
        
        return jsonify({"results": results})
        
    except Exception as e:
        logger.error(f"Error in batch calculation: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/models', methods=['GET'])
def get_supported_models():
    """Get list of supported Claude models and their energy profiles"""
    try:
        models = calculator.get_supported_models()
        return jsonify({
            "supported_models": models,
            "methodology": "custom_ecologits_inspired",
            "last_updated": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/methodology', methods=['GET'])
def get_methodology():
    """Explain the calculation methodology"""
    return jsonify({
        "methodology": {
            "name": "EcoLogits-based Environmental Impact Calculation",
            "description": "Calculates environmental impact using EcoLogits research methodology",
            "steps": [
                "1. Model energy consumption estimation based on token usage",
                "2. Carbon intensity lookup for geographic location and time",
                "3. CO2 emissions calculation: Energy (kWh) × Carbon Intensity (g/kWh)",
                "4. Tree equivalent calculation: CO2 (g) ÷ 50g (daily tree absorption)"
            ],
            "data_sources": {
                "energy_consumption": "EcoLogits model research and benchmarks",
                "carbon_intensity": "ElectricityMaps API / WattTime API",
                "tree_absorption": "50g CO2 per tree per day (scientific average)"
            },
            "accuracy": "Estimation based on industry research and real-time data"
        }
    })


@app.route('/cache-stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics"""
    try:
        stats = {
            "cache_type": "in_memory",
            "cache_size": len(cache_dict),
            "cache_max_size": 1000
        }
        
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        return jsonify({"error": "Internal server error"}), 500


def get_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get cached result from in-memory cache"""
    try:
        return cache_dict.get(cache_key)
    except Exception as e:
        logger.error(f"Cache get error: {e}")
        return None


def cache_result(cache_key: str, result: Dict[str, Any], ttl: int = 21600):  # 6 hours
    """Cache result in memory (TTL ignored for simplicity)"""
    try:
        cache_dict[cache_key] = result
        # Keep cache size reasonable (simple LRU simulation)
        if len(cache_dict) > 1000:
            # Remove oldest 200 items
            keys_to_remove = list(cache_dict.keys())[:200]
            for key in keys_to_remove:
                del cache_dict[key]
    except Exception as e:
        logger.error(f"Cache set error: {e}")


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Environmental Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)