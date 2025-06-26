import { logger, log } from './logger.js';

class EnvironmentalService {
  constructor() {
    this.serviceUrl = process.env.ENVIRONMENTAL_SERVICE_URL || 'http://localhost:5000';
    this.cache = new Map();
    this.enabled = process.env.ENVIRONMENTAL_TRACKING_ENABLED !== 'false';
    this.fallbackEnabled = true;
    
    if (this.enabled) {
      log.info('Environmental service initialized', { 
        serviceUrl: this.serviceUrl,
        cacheEnabled: true 
      });
    } else {
      log.info('Environmental tracking disabled');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Calculate environmental impact for usage data
   * @param {Object} usageData - Usage data object
   * @param {string} usageData.model - Claude model name
   * @param {number} usageData.input_tokens - Input tokens
   * @param {number} usageData.output_tokens - Output tokens
   * @param {string} usageData.timestamp - ISO timestamp
   * @param {string} usageData.location - Location/region
   * @returns {Promise<Object|null>} Environmental impact data
   */
  async calculateImpact(usageData) {
    if (!this.isEnabled()) {
      return null;
    }

    // Create cache key based on model and token usage
    const cacheKey = `${usageData.model}-${usageData.input_tokens}-${usageData.output_tokens}`;
    
    if (this.cache.has(cacheKey)) {
      logger.debug('Environmental impact cache hit', { cacheKey });
      return this.cache.get(cacheKey);
    }

    try {
      logger.debug('Calculating environmental impact', { 
        model: usageData.model,
        tokens: usageData.input_tokens + usageData.output_tokens
      });

      const response = await fetch(`${this.serviceUrl}/calculate-impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: usageData.model,
          input_tokens: usageData.input_tokens,
          output_tokens: usageData.output_tokens,
          timestamp: usageData.timestamp,
          location: usageData.location || 'us-west-1'
        }),
        timeout: 5000 // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`Environmental service responded with ${response.status}`);
      }

      const impact = await response.json();
      
      // Add calculated equivalent text
      impact.equivalent_text = this.generateEquivalentText(impact.tree_equivalent);
      
      // Cache successful results
      this.cache.set(cacheKey, impact);
      
      logger.debug('Environmental impact calculated', { 
        cacheKey,
        co2_emissions_g: impact.co2_emissions_g,
        tree_equivalent: impact.tree_equivalent
      });

      return impact;
    } catch (error) {
      logger.warn('Environmental service unavailable, using fallback', { 
        error: error.message,
        model: usageData.model,
        tokens: usageData.input_tokens + usageData.output_tokens
      });

      // Fallback calculation if service unavailable
      if (this.fallbackEnabled) {
        return this.calculateFallbackImpact(usageData);
      }

      return null;
    }
  }

  /**
   * Fallback environmental calculation using estimated values
   * @param {Object} usageData - Usage data
   * @returns {Object} Estimated environmental impact
   */
  calculateFallbackImpact(usageData) {
    // Rough estimates based on research (very approximate)
    const totalTokens = usageData.input_tokens + usageData.output_tokens;
    
    // Estimate: ~0.0001 Wh per token (very rough)
    const energy_wh = totalTokens * 0.0001;
    
    // Estimate: ~400g CO2/kWh average grid intensity
    const carbon_intensity_g_kwh = 400;
    const co2_emissions_g = (energy_wh / 1000) * carbon_intensity_g_kwh;
    
    // Tree equivalent: ~50g CO2 per tree per day
    const tree_equivalent = co2_emissions_g / 50.0;

    const impact = {
      energy_wh: parseFloat(energy_wh.toFixed(6)),
      co2_emissions_g: parseFloat(co2_emissions_g.toFixed(6)),
      carbon_intensity_g_kwh: carbon_intensity_g_kwh,
      tree_equivalent: parseFloat(tree_equivalent.toFixed(3)),
      equivalent_text: this.generateEquivalentText(tree_equivalent),
      source: 'fallback_estimate'
    };

    logger.debug('Fallback environmental impact calculated', impact);
    return impact;
  }

  /**
   * Generate natural language equivalent text
   * @param {number} treeEquivalent - Tree equivalent value
   * @returns {string} Natural language description
   */
  generateEquivalentText(treeEquivalent) {
    if (treeEquivalent < 0.1) {
      return `same CO2 as ${(treeEquivalent * 10).toFixed(1)}/10th of a tree absorbs daily`;
    } else if (treeEquivalent < 1) {
      return `same CO2 as ${treeEquivalent.toFixed(1)} of a tree absorbs daily`;
    } else if (treeEquivalent < 2) {
      return `same CO2 as ${treeEquivalent.toFixed(1)} tree absorbs daily`;
    } else {
      return `same CO2 as ${treeEquivalent.toFixed(1)} trees absorb daily`;
    }
  }

  /**
   * Batch calculate environmental impact for multiple usage records
   * @param {Array} usageRecords - Array of usage data objects
   * @returns {Promise<Array>} Array of usage records with environmental data
   */
  async batchCalculateImpact(usageRecords) {
    if (!this.isEnabled()) {
      return usageRecords;
    }

    log.info('Batch calculating environmental impact', { 
      recordCount: usageRecords.length 
    });

    const results = [];
    for (const record of usageRecords) {
      const impact = await this.calculateImpact(record);
      results.push({
        ...record,
        environmental: impact
      });
    }

    log.info('Batch environmental calculation completed', { 
      recordCount: results.length,
      successCount: results.filter(r => r.environmental).length
    });

    return results;
  }

  /**
   * Clear the environmental impact cache
   */
  clearCache() {
    this.cache.clear();
    log.info('Environmental impact cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      enabled: this.enabled,
      serviceUrl: this.serviceUrl
    };
  }
}

// Create singleton instance
const environmentalService = new EnvironmentalService();

export default environmentalService;