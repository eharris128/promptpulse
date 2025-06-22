import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Number formatting utilities
export function formatTokens(tokens: number): string {
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
  sanitized = sanitized.replace(/[<>'"&]/g, '')
  
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