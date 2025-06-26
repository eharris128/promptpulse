import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Number formatting utilities
export function formatTokens(tokens: number): string {
  // Handle invalid values (null, undefined, NaN)
  if (tokens == null || isNaN(tokens)) return '0'
  if (tokens === 0) return '0'
  
  if (tokens >= 1000000000) {
    return `${(tokens / 1000000000).toFixed(1)}B`
  } else if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  } else {
    return tokens.toLocaleString()
  }
}

export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost)
}

export function formatNumber(num: number): string {
  if (num === 0) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}

// Input sanitization
export function sanitizeDisplayName(input: string): string {
  if (!input) return ''
  
  // Trim whitespace and limit length
  let sanitized = input.trim().slice(0, 50)
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  return sanitized
}

export function sanitizeApiKey(input: string): string {
  if (!input) return ''
  
  // Trim whitespace from start and end
  let sanitized = input.trim()
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // Only allow alphanumeric, underscores, hyphens, and dots (common in API keys)
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '')
  
  // Limit to reasonable API key length
  sanitized = sanitized.slice(0, 100)
  
  return sanitized
}

// Smart labeling for time periods
export function getTokenLabel(period: 'daily' | 'weekly', tokens: number): string {
  if (period === 'daily') {
    return `${formatTokens(tokens)} tokens today`
  } else {
    return `${formatTokens(tokens)} tokens this week`
  }
}

export function getAverageLabel(period: 'daily' | 'weekly', average: number): string {
  if (period === 'daily') {
    return `${formatTokens(average)} today`
  } else {
    return `${formatTokens(average)} avg/day`
  }
}

// Claude plan pricing constants
export const CLAUDE_PLAN_PRICING = {
  pro_17: { name: 'Pro', price: 17, description: 'Standard Claude usage' },
  max_100: { name: 'Max 5x', price: 100, description: '5x higher usage limits' },
  max_200: { name: 'Max 20x', price: 200, description: '20x higher usage limits' }
} as const

export type ClaudePlan = keyof typeof CLAUDE_PLAN_PRICING

// ROI calculation utilities
export function calculatePlanROI(actualCost: number, planType: ClaudePlan) {
  const planPrice = CLAUDE_PLAN_PRICING[planType].price
  const savings = planPrice - actualCost
  const isOver = savings < 0
  
  return {
    planName: CLAUDE_PLAN_PRICING[planType].name,
    planPrice,
    actualCost,
    savings: Math.abs(savings),
    isOver,
    percentSavings: planPrice > 0 ? (savings / planPrice) * 100 : 0
  }
}

export function calculateAllPlanROI(actualCost: number) {
  return {
    pro_17: calculatePlanROI(actualCost, 'pro_17'),
    max_100: calculatePlanROI(actualCost, 'max_100'),
    max_200: calculatePlanROI(actualCost, 'max_200')
  }
}

export function formatSavings(savings: number, isOver: boolean): string {
  const formatted = formatCost(savings)
  return isOver ? `+${formatted} Value` : `${formatted} Saved`
}

// Environmental formatting utilities
export function formatCO2(co2Grams: number): string {
  // Handle invalid values (null, undefined, NaN)
  if (!co2Grams || co2Grams === 0 || isNaN(co2Grams)) return '0g CO2'
  
  if (co2Grams < 0.01) {
    return '<0.01g CO2'
  } else if (co2Grams < 1) {
    return `${co2Grams.toFixed(2)}g CO2`
  } else if (co2Grams < 1000) {
    return `${co2Grams.toFixed(1)}g CO2`
  } else {
    return `${(co2Grams / 1000).toFixed(2)}kg CO2`
  }
}

export function formatEnergy(energyWh: number): string {
  // Handle invalid values (null, undefined, NaN) and fix spacing
  if (!energyWh || energyWh === 0 || isNaN(energyWh)) return '0 Wh'
  
  if (energyWh < 0.01) {
    return '<0.01 Wh'
  } else if (energyWh < 1) {
    return `${energyWh.toFixed(2)} Wh`
  } else if (energyWh < 1000) {
    return `${energyWh.toFixed(1)} Wh`
  } else {
    return `${(energyWh / 1000).toFixed(2)} kWh`
  }
}

export function formatTreeEquivalent(treeEquivalent: number): string {
  // Handle invalid values (null, undefined, NaN)
  if (!treeEquivalent || treeEquivalent <= 0 || isNaN(treeEquivalent)) {
    return 'Negligible impact'
  }
  
  if (treeEquivalent < 0.01) {
    return '<0.01 trees/day'
  } else if (treeEquivalent < 0.1) {
    const percent = Math.round(treeEquivalent * 100)
    return `${percent}% of daily tree absorption`
  } else if (treeEquivalent < 1) {
    return `${treeEquivalent.toFixed(1)} tree/day equivalent`
  } else if (treeEquivalent < 2) {
    return `${treeEquivalent.toFixed(1)} tree/day equivalent`
  } else {
    return `${treeEquivalent.toFixed(1)} trees/day equivalent`
  }
}