"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCost, formatTokens } from "@/lib/utils";
import { AggregateData } from "@/types";

interface StatsCardsProps {
  data: AggregateData
}

export function StatsCards({ data }: StatsCardsProps) {
  const { totals } = data;

  // Ensure totals exists with default values and handle NaN
  const safeTotal = totals || {
    total_cost: 0,
    total_tokens: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_machines: 0
  };

  // Additional safety for cost field to handle NaN
  if (isNaN(safeTotal.total_cost)) {
    safeTotal.total_cost = 0;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estimated Usage Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(safeTotal.total_cost)}</div>
          <p className="text-xs text-muted-foreground">
            Value of your token usage
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTokens(safeTotal.total_tokens)}</div>
          <p className="text-xs text-muted-foreground">
            Input + Output + Cache tokens
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTokens(safeTotal.total_input_tokens)}</div>
          <p className="text-xs text-muted-foreground">
            User prompts and context
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTokens(safeTotal.total_output_tokens)}</div>
          <p className="text-xs text-muted-foreground">
            Claude responses
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
