import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Number formatting utilities
export function formatTokens(tokens: number): string {
  // Handle invalid values (null, undefined, NaN)
  if (tokens == null || isNaN(tokens)) return "0";
  if (tokens === 0) return "0";

  if (tokens >= 1000000000) {
    return `${(tokens / 1000000000).toFixed(1)}B`;
  } else if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  } else {
    return tokens.toLocaleString();
  }
}

export function formatCost(cost: number): string {
  // Handle invalid values (NaN, null, undefined)
  if (cost === null || cost === undefined || isNaN(cost) || cost === 0) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

export function formatNumber(num: number): string {
  if (num === 0) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

// Basic input validation (client-side only for UX)
// Note: All security sanitization is handled server-side
export function validateDisplayName(input: string): { isValid: boolean; error?: string } {
  if (!input || input.trim().length === 0) {
    return { isValid: false, error: "Display name is required" };
  }

  if (input.trim().length > 50) {
    return { isValid: false, error: "Display name must be 50 characters or less" };
  }

  return { isValid: true };
}

export function validateSearchInput(input: string): { isValid: boolean; error?: string } {
  if (!input) return { isValid: true }; // Search can be empty

  if (input.length > 100) {
    return { isValid: false, error: "Search term must be 100 characters or less" };
  }

  return { isValid: true };
}

export function validateGenericInput(input: string, maxLength: number = 255): { isValid: boolean; error?: string } {
  if (!input || input.trim().length === 0) {
    return { isValid: false, error: "Input is required" };
  }

  if (input.trim().length > maxLength) {
    return { isValid: false, error: `Input must be ${maxLength} characters or less` };
  }

  return { isValid: true };
}

// Smart labeling for time periods
export function getTokenLabel(period: "daily" | "weekly", tokens: number): string {
  if (period === "daily") {
    return `${formatTokens(tokens)} tokens today`;
  } else {
    return `${formatTokens(tokens)} tokens this week`;
  }
}

export function getAverageLabel(period: "daily" | "weekly", average: number): string {
  if (period === "daily") {
    return `${formatTokens(average)} today`;
  } else {
    return `${formatTokens(average)} avg/day`;
  }
}

// Claude plan pricing constants
export const CLAUDE_PLAN_PRICING = {
  pro_17: { name: "Pro", price: 17, description: "Standard Claude usage" },
  max_100: { name: "Max 5x", price: 100, description: "5x higher usage limits" },
  max_200: { name: "Max 20x", price: 200, description: "20x higher usage limits" }
} as const;

export type ClaudePlan = keyof typeof CLAUDE_PLAN_PRICING

// ROI calculation utilities
export function calculatePlanROI(actualCost: number, planType: ClaudePlan) {
  const planPrice = CLAUDE_PLAN_PRICING[planType].price;
  const savings = planPrice - actualCost;
  const isOver = savings < 0;

  return {
    planName: CLAUDE_PLAN_PRICING[planType].name,
    planPrice,
    actualCost,
    savings: Math.abs(savings),
    isOver,
    percentSavings: planPrice > 0 ? (savings / planPrice) * 100 : 0
  };
}

export function calculateAllPlanROI(actualCost: number) {
  return {
    pro_17: calculatePlanROI(actualCost, "pro_17"),
    max_100: calculatePlanROI(actualCost, "max_100"),
    max_200: calculatePlanROI(actualCost, "max_200")
  };
}

export function formatSavings(savings: number, isOver: boolean): string {
  const formatted = formatCost(savings);
  return isOver ? `+${formatted} Value` : `${formatted} Saved`;
}

