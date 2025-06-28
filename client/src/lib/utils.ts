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
  // Handle invalid values (NaN, null, undefined)
  if (cost === null || cost === undefined || isNaN(cost) || cost === 0) {
    return '$0.00'
  }
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

// Input sanitization with SQL injection protection
export function sanitizeDisplayName(input: string): string {
  if (!input) return ''
  
  // Trim whitespace and limit length
  let sanitized = input.trim().slice(0, 50)
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // SQL injection protection - escape SQL special characters
  sanitized = escapeSqlCharacters(sanitized)
  
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
  
  // API keys shouldn't contain SQL characters anyway, but add protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

// SQL injection protection utilities
export function escapeSqlCharacters(input: string): string {
  if (!input) return ''
  
  return input
    .replace(/'/g, "''")        // Escape single quotes
    .replace(/\\/g, '\\\\')     // Escape backslashes
    .replace(/\0/g, '\\0')      // Escape null bytes
    .replace(/\n/g, '\\n')      // Escape newlines
    .replace(/\r/g, '\\r')      // Escape carriage returns
    .replace(/\x1a/g, '\\Z')    // Escape Control+Z
}

export function sanitizeSearchInput(input: string): string {
  if (!input) return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, 100)
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  
  // Remove dangerous SQL patterns
  sanitized = sanitized.replace(/(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|UPDATE|UNION|INTO|FROM|WHERE)\b)/gi, '')
  
  // Escape SQL characters
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

export function sanitizeGenericInput(input: string, maxLength: number = 255): string {
  if (!input) return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength)
  
  // Remove HTML tags and scripts
  sanitized = sanitized.replace(/<[^>]*>/g, '')
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>'\"&]/g, '')
  
  // SQL injection protection
  sanitized = escapeSqlCharacters(sanitized)
  
  return sanitized
}

export function validateSqlIdentifier(identifier: string): boolean {
  // Only allow alphanumeric characters, underscores, and hyphens
  return /^[a-zA-Z0-9_-]+$/.test(identifier)
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

