#!/usr/bin/env python3
"""
Environmental Service Runner
Simple script to start the Flask application
"""

import os
import sys

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.app import app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    print(f"🌱 Starting Environmental Service on port {port}")
    print(f"Debug mode: {debug}")
    print(f"Python version: {sys.version}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )