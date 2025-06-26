# PromptPulse Environmental Service

<1 Environmental impact calculation service using EcoLogits-inspired methodology for Claude Code usage tracking.

## Overview

This Python 3.13 service calculates environmental impact (CO2 emissions, energy consumption) for Claude Code usage based on token usage data. It implements a custom calculator inspired by EcoLogits research methodology, designed for processing historical usage data from logs.

## ( Features

- >î **EcoLogits-inspired calculations** - Research-backed methodology for accurate estimates
- < **Real-time carbon intensity** - Integrates with ElectricityMaps and WattTime APIs  
- > **Model-specific profiles** - Different energy profiles for Claude models (Haiku, Sonnet, Opus)
- <3 **Natural language equivalents** - Converts CO2 to "trees absorb daily" format
- = **Graceful fallbacks** - Works without external APIs using regional estimates
- =æ **Batch processing** - Handle multiple calculations efficiently
- <å **Health monitoring** - Built-in health checks and metrics
- =Ê **Historical data processing** - Calculate impact for past usage from logs

## =€ Quick Start

### Prerequisites

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) (recommended) or pip

### Installation

1. **Clone and setup**:
   ```bash
   cd environmental-service
   uv sync
   ```

2. **Configure environment (optional)**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration if needed
   ```

3. **Run the service**:
   ```bash
   # Development
   PYTHONPATH=. uv run python -m src.app
   
   # Or using the run script
   uv run python run.py
   ```

4. **Test the API**:
   ```bash
   curl http://localhost:5000/health
   ```

## =á API Endpoints

### Calculate Environmental Impact
```bash
POST /calculate-impact
{
  "model": "claude-3-5-sonnet-20241022",
  "input_tokens": 100,
  "output_tokens": 200,
  "timestamp": "2025-06-26T10:30:00Z",
  "location": "us-west-1"
}
```

**Response:**
```json
{
  "energy_wh": 0.07,
  "co2_emissions_g": 0.028,
  "carbon_intensity_g_kwh": 400,
  "tree_equivalent": 0.00056,
  "equivalent_text": "same CO2 as 0.6% of daily tree absorption",
  "source": "custom_calculation"
}
```

### Batch Processing
```bash
POST /batch-calculate
{
  "requests": [
    {
      "model": "claude-3-5-sonnet-20241022",
      "input_tokens": 100,
      "output_tokens": 200
    }
  ]
}
```

### Health Check
```bash
GET /health
```

### Supported Models
```bash
GET /models
```

## =' Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Service port |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ELECTRICITY_MAPS_API_KEY` | - | ElectricityMaps API key (optional) |
| `WATT_TIME_USERNAME` | - | WattTime API username (optional) |
| `WATT_TIME_PASSWORD` | - | WattTime API password (optional) |

External APIs are optional - the service will use regional fallback estimates if they're unavailable.

## >î Methodology

### Energy Calculation
- **Model-specific profiles**: Different energy consumption rates per token for each Claude model variant
- **Base energy**: Fixed energy cost per request regardless of tokens
- **Token-based scaling**: Linear scaling based on input/output token counts

### CO2 Calculation
- **Regional carbon intensity**: Real-time grid carbon intensity data when available
- **Fallback estimates**: Regional averages when live data unavailable
- **Formula**: `CO2 = Energy (kWh) × Carbon Intensity (g CO2/kWh)`

### Tree Equivalents
- **Daily absorption**: Based on ~50g CO2 per mature tree per day
- **Natural language**: Converts to relatable terms like "same CO2 as 2.3 trees absorb daily"

## =€ Deployment

### Development
```bash
uv run python run.py
```

### Production (Docker)
```bash
docker build -t environmental-service .
docker run -p 5000:5000 environmental-service
```

### Production (Direct)
```bash
uv run gunicorn -w 4 -b 0.0.0.0:5000 src.app:app
```

## >ê Testing

```bash
# Run tests
uv run pytest

# Test the service
uv run python test_service.py
```

## =È Monitoring

The service provides health checks and basic metrics:
- `/health` - Service status and dependencies
- `/models` - Supported models and profiles
- Built-in request logging

## = Troubleshooting

### Common Issues

1. **Service not starting**: Check Python 3.13+ is installed
2. **API calls failing**: Verify the service is running on the correct port
3. **Environmental data missing**: Service falls back to estimates when external APIs unavailable

### Logs
```bash
# View service logs
tail -f logs/environmental-service.log
```

## =Ú Technical Details

### Architecture
- **Flask-based REST API** - Lightweight and fast
- **Custom calculation engine** - Inspired by EcoLogits research
- **Fallback-first design** - Works without external dependencies
- **Stateless** - No database required, pure calculation service

### Energy Profiles
Energy consumption profiles are based on research and model complexity:
- **Haiku**: ~0.05-0.15 mWh per token (most efficient)
- **Sonnet**: ~0.1-0.3 mWh per token (balanced)
- **Opus**: ~0.2-0.5 mWh per token (most capable)

### Dependencies
- `flask` - Web framework
- `requests` - HTTP client for external APIs
- `python-dotenv` - Environment variable management

## > Integration

This service integrates with PromptPulse's Node.js backend via the `environmental-service.js` client, which handles:
- HTTP requests to this Python service
- Caching for performance
- Fallback calculations when service unavailable
- Error handling and retries

## =Ý License

Part of the PromptPulse project.