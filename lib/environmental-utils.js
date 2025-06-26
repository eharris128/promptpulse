/**
 * Environmental utility functions for carbon footprint and tree equivalents
 */

/**
 * Format CO2 emissions for display
 * @param {number} co2Grams - CO2 emissions in grams
 * @returns {string} Formatted CO2 string
 */
export function formatCO2(co2Grams) {
  if (co2Grams === null || co2Grams === undefined) {
    return 'N/A';
  }

  if (co2Grams < 0.01) {
    return '<0.01g CO2';
  } else if (co2Grams < 1) {
    return `${co2Grams.toFixed(2)}g CO2`;
  } else if (co2Grams < 1000) {
    return `${co2Grams.toFixed(1)}g CO2`;
  } else {
    return `${(co2Grams / 1000).toFixed(2)}kg CO2`;
  }
}

/**
 * Format energy consumption for display
 * @param {number} energyWh - Energy in watt-hours
 * @returns {string} Formatted energy string
 */
export function formatEnergy(energyWh) {
  if (energyWh === null || energyWh === undefined) {
    return 'N/A';
  }

  if (energyWh < 0.01) {
    return '<0.01Wh';
  } else if (energyWh < 1) {
    return `${energyWh.toFixed(2)}Wh`;
  } else if (energyWh < 1000) {
    return `${energyWh.toFixed(1)}Wh`;
  } else {
    return `${(energyWh / 1000).toFixed(2)}kWh`;
  }
}

/**
 * Generate tree equivalent text with natural language
 * @param {number} treeEquivalent - Tree equivalent value (days)
 * @param {boolean} short - Whether to use short form
 * @returns {string} Natural language tree equivalent
 */
export function formatTreeEquivalent(treeEquivalent, short = false) {
  if (treeEquivalent === null || treeEquivalent === undefined || treeEquivalent <= 0) {
    return short ? 'No impact' : 'Negligible environmental impact';
  }

  if (treeEquivalent < 0.01) {
    return short ? '<0.01 trees/day' : 'Less than 1% of daily tree absorption';
  } else if (treeEquivalent < 0.1) {
    const percent = Math.round(treeEquivalent * 100);
    return short ? `${percent}% tree/day` : `${percent}% of what a tree absorbs daily`;
  } else if (treeEquivalent < 1) {
    return short ? `${treeEquivalent.toFixed(1)} tree/day` : `same CO2 as ${treeEquivalent.toFixed(1)} of a tree absorbs daily`;
  } else if (treeEquivalent < 2) {
    return short ? `${treeEquivalent.toFixed(1)} tree/day` : `same CO2 as ${treeEquivalent.toFixed(1)} tree absorbs daily`;
  } else {
    return short ? `${treeEquivalent.toFixed(1)} trees/day` : `same CO2 as ${treeEquivalent.toFixed(1)} trees absorb daily`;
  }
}

/**
 * Calculate additional environmental equivalents
 * @param {number} co2Grams - CO2 emissions in grams
 * @returns {Object} Various environmental equivalents
 */
export function calculateEquivalents(co2Grams) {
  if (!co2Grams || co2Grams <= 0) {
    return {
      trees: 0,
      phoneCharges: 0,
      milesDriven: 0,
      ledHours: 0,
      laptopHours: 0
    };
  }

  // Conversion factors (approximate)
  const TREE_CO2_PER_DAY = 50; // grams CO2 per tree per day
  const PHONE_CHARGE_CO2 = 8; // grams CO2 per phone charge
  const CAR_CO2_PER_MILE = 411; // grams CO2 per mile (average car)
  const LED_CO2_PER_HOUR = 0.5; // grams CO2 per LED bulb hour
  const LAPTOP_CO2_PER_HOUR = 20; // grams CO2 per laptop hour

  return {
    trees: co2Grams / TREE_CO2_PER_DAY,
    phoneCharges: co2Grams / PHONE_CHARGE_CO2,
    milesDriven: co2Grams / CAR_CO2_PER_MILE,
    ledHours: co2Grams / LED_CO2_PER_HOUR,
    laptopHours: co2Grams / LAPTOP_CO2_PER_HOUR
  };
}

/**
 * Get the most appropriate equivalent for display
 * @param {number} co2Grams - CO2 emissions in grams
 * @returns {Object} Best equivalent with text
 */
export function getBestEquivalent(co2Grams) {
  const equivalents = calculateEquivalents(co2Grams);
  
  // Choose the most relatable equivalent based on magnitude
  if (equivalents.trees >= 0.1) {
    return {
      type: 'trees',
      value: equivalents.trees,
      text: formatTreeEquivalent(equivalents.trees)
    };
  } else if (equivalents.phoneCharges >= 0.1) {
    return {
      type: 'phoneCharges',
      value: equivalents.phoneCharges,
      text: `same energy as ${equivalents.phoneCharges.toFixed(1)} phone charges`
    };
  } else if (equivalents.ledHours >= 1) {
    return {
      type: 'ledHours',
      value: equivalents.ledHours,
      text: `same energy as powering LED bulb for ${equivalents.ledHours.toFixed(1)} hours`
    };
  } else {
    return {
      type: 'minimal',
      value: co2Grams,
      text: 'minimal environmental impact'
    };
  }
}

/**
 * Calculate environmental efficiency score
 * @param {number} co2Grams - CO2 emissions in grams
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} CO2 per output token (lower is better)
 */
export function calculateEfficiency(co2Grams, outputTokens) {
  if (!co2Grams || !outputTokens || outputTokens <= 0) {
    return 0;
  }
  return co2Grams / outputTokens;
}

/**
 * Get efficiency rating based on CO2 per token
 * @param {number} efficiency - CO2 grams per output token
 * @returns {Object} Rating and description
 */
export function getEfficiencyRating(efficiency) {
  if (efficiency <= 0.001) {
    return { rating: 'excellent', color: 'green', description: 'Highly efficient usage' };
  } else if (efficiency <= 0.005) {
    return { rating: 'good', color: 'lightgreen', description: 'Good efficiency' };
  } else if (efficiency <= 0.01) {
    return { rating: 'average', color: 'yellow', description: 'Average efficiency' };
  } else if (efficiency <= 0.02) {
    return { rating: 'poor', color: 'orange', description: 'Could be more efficient' };
  } else {
    return { rating: 'very-poor', color: 'red', description: 'Low efficiency usage' };
  }
}

/**
 * Aggregate environmental data for multiple records
 * @param {Array} records - Array of records with environmental data
 * @returns {Object} Aggregated environmental metrics
 */
export function aggregateEnvironmentalData(records) {
  if (!records || records.length === 0) {
    return {
      totalCO2: 0,
      totalEnergy: 0,
      totalTreeEquivalent: 0,
      avgCarbonIntensity: 0,
      sessionCount: 0,
      totalTokens: 0,
      efficiency: 0
    };
  }

  const totals = records.reduce((acc, record) => {
    const env = record.environmental || {};
    acc.totalCO2 += env.co2_emissions_g || 0;
    acc.totalEnergy += env.energy_wh || 0;
    acc.totalTreeEquivalent += env.tree_equivalent || 0;
    acc.carbonIntensitySum += env.carbon_intensity_g_kwh || 0;
    acc.carbonIntensityCount += env.carbon_intensity_g_kwh ? 1 : 0;
    acc.sessionCount += 1;
    acc.totalTokens += (record.output_tokens || 0);
    return acc;
  }, {
    totalCO2: 0,
    totalEnergy: 0,
    totalTreeEquivalent: 0,
    carbonIntensitySum: 0,
    carbonIntensityCount: 0,
    sessionCount: 0,
    totalTokens: 0
  });

  return {
    totalCO2: totals.totalCO2,
    totalEnergy: totals.totalEnergy,
    totalTreeEquivalent: totals.totalTreeEquivalent,
    avgCarbonIntensity: totals.carbonIntensityCount > 0 ? 
      totals.carbonIntensitySum / totals.carbonIntensityCount : 0,
    sessionCount: totals.sessionCount,
    totalTokens: totals.totalTokens,
    efficiency: totals.totalTokens > 0 ? totals.totalCO2 / totals.totalTokens : 0
  };
}

/**
 * Generate environmental insight text
 * @param {Object} aggregatedData - Aggregated environmental data
 * @param {string} period - Time period (day, week, month)
 * @returns {string} Insight text
 */
export function generateEnvironmentalInsight(aggregatedData, period = 'session') {
  const { totalCO2, totalTreeEquivalent, efficiency } = aggregatedData;
  
  if (totalCO2 <= 0) {
    return `No environmental impact data available for this ${period}.`;
  }

  const treeText = formatTreeEquivalent(totalTreeEquivalent);
  const efficiencyRating = getEfficiencyRating(efficiency);
  
  return `Your ${period} usage: ${formatCO2(totalCO2)} (${treeText}). ${efficiencyRating.description}.`;
}

/**
 * Check for environmental achievements
 * @param {Object} sessionData - Session environmental data
 * @param {Object} historicalData - Historical user data for comparison
 * @returns {Array} Array of achievements earned
 */
export function checkEnvironmentalAchievements(sessionData, historicalData = {}) {
  const achievements = [];
  const env = sessionData.environmental || {};
  
  // Low impact session
  if (env.co2_emissions_g && env.co2_emissions_g < 1) {
    achievements.push({
      type: 'low_impact_session',
      title: 'Eco Warrior',
      description: 'Session with less than 1g CO2 emissions',
      trees_equivalent: env.tree_equivalent
    });
  }

  // Efficiency milestone
  const efficiency = calculateEfficiency(env.co2_emissions_g, sessionData.output_tokens);
  if (efficiency > 0 && efficiency < 0.001) {
    achievements.push({
      type: 'efficiency_milestone',
      title: 'Carbon Efficient',
      description: 'Highly efficient session (< 0.001g CO2 per token)',
      trees_equivalent: env.tree_equivalent
    });
  }

  // First environmental tracking
  if (!historicalData.hasEnvironmentalData) {
    achievements.push({
      type: 'first_tracking',
      title: 'Environmental Pioneer',
      description: 'First session with environmental tracking enabled',
      trees_equivalent: env.tree_equivalent
    });
  }

  return achievements;
}