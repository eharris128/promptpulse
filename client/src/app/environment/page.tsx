"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TreeVisualization } from "@/components/environment/tree-visualization";
import { EnvironmentStats } from "@/components/environment/environment-stats";
import { apiClient } from "@/lib/api";
import { AggregateData } from "@/types";
import { calculateClaude4Impact } from "ai-carbon";

export default function EnvironmentPage() {
  const [dataLoading, setDataLoading] = useState(false);
  const [usageData, setUsageData] = useState<AggregateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnvironmentData();
  }, []);

  const loadEnvironmentData = async () => {
    try {
      setDataLoading(true);
      setError(null);
      const usageResponse = await apiClient.getUsageAggregate();
      setUsageData(usageResponse);
    } catch (err) {
      console.error("Failed to load environment data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setDataLoading(false);
    }
  };

  // Calculate environmental impact from usage data with thinking mode detection
  const environmentalImpact = usageData ? (() => {
    // Check if we have thinking mode data
    const hasThinkingData = usageData.totals.total_thinking_tokens > 0;
    const thinkingPercentage = usageData.totals.average_thinking_percentage || 0;

    if (hasThinkingData && thinkingPercentage > 0) {
      // Calculate impact for thinking and non-thinking tokens separately
      const thinkingTokens = usageData.totals.total_thinking_tokens || 0;
      const regularTokens = usageData.totals.total_tokens - thinkingTokens;

      // Calculate thinking impact (with reasoning=true for 2.5x multiplier)
      const thinkingImpact = calculateClaude4Impact({
        model: "claude-4-sonnet",
        inputTokens: Math.round(thinkingTokens * 0.5), // Rough estimate of input/output split
        outputTokens: Math.round(thinkingTokens * 0.5),
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        reasoning: true // This applies the 2.5x multiplier
      });

      // Calculate regular impact
      const regularImpact = calculateClaude4Impact({
        model: "claude-4-sonnet",
        inputTokens: usageData.totals.total_input_tokens - Math.round(thinkingTokens * 0.5),
        outputTokens: usageData.totals.total_output_tokens - Math.round(thinkingTokens * 0.5),
        cacheCreationTokens: usageData.totals.total_cache_creation_tokens || 0,
        cacheReadTokens: usageData.totals.total_cache_read_tokens || 0,
        reasoning: false
      });

      // Combine the impacts
      return {
        ...regularImpact,
        co2Grams: thinkingImpact.co2Grams + regularImpact.co2Grams,
        energyWh: thinkingImpact.energyWh + regularImpact.energyWh,
        waterLiters: thinkingImpact.waterLiters + regularImpact.waterLiters,
        thinkingTokens: thinkingTokens,
        thinkingPercentage: thinkingPercentage
      };
    } else {
      // Fallback to original calculation if no thinking data
      return calculateClaude4Impact({
        model: "claude-4-sonnet",
        inputTokens: usageData.totals.total_input_tokens || 0,
        outputTokens: usageData.totals.total_output_tokens || 0,
        cacheCreationTokens: usageData.totals.total_cache_creation_tokens || 0,
        cacheReadTokens: usageData.totals.total_cache_read_tokens || 0,
        reasoning: false
      });
    }
  })() : null;

  // Calculate what impact would be if all tokens were treated as regular tokens (for comparison)
  const naiveImpact = usageData ? calculateClaude4Impact({
    model: "claude-4-sonnet",
    inputTokens: usageData.totals.total_tokens || 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    reasoning: false
  }) : null;

  // Debug logging
  if (usageData && environmentalImpact) {
    console.log("=== ENVIRONMENTAL DEBUG ===");
    console.log("Token inputs:", {
      inputTokens: usageData.totals.total_input_tokens,
      outputTokens: usageData.totals.total_output_tokens,
      cacheCreationTokens: usageData.totals.total_cache_creation_tokens,
      cacheReadTokens: usageData.totals.total_cache_read_tokens,
      totalTokens: usageData.totals.total_tokens,
      thinkingTokens: usageData.totals.total_thinking_tokens,
      thinkingSessions: usageData.totals.thinking_sessions_count
    });
    console.log("AI-Carbon result:", environmentalImpact);
    console.log("Cache tokens represent:", `${usageData.totals.total_tokens > 0 ? Math.round(((usageData.totals.total_cache_read_tokens || 0) / usageData.totals.total_tokens) * 100) : 0}% of total tokens`);
    console.log("Cache tokens have 0.12x environmental impact of regular tokens");
    if (usageData.totals.total_thinking_tokens > 0) {
      console.log("Thinking tokens:", usageData.totals.total_thinking_tokens, `(${((usageData.totals.average_thinking_percentage || 0) * 100).toFixed(1)}% avg)`);
      console.log("Thinking mode sessions:", usageData.totals.thinking_sessions_count);
      console.log("Thinking tokens have 2.5x environmental impact of regular tokens");
    }
    console.log("===========================");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Environmental Impact</h2>
          <p className="text-muted-foreground">
            Your AI usage environmental footprint
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadEnvironmentData}
            disabled={dataLoading}
          >
            {dataLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
          <p>Error: {error}</p>
          <Button variant="outline" size="sm" onClick={loadEnvironmentData} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {dataLoading && !usageData && (
        <div className="space-y-4">
          <div className="text-lg">Loading environmental data...</div>
        </div>
      )}

      {!dataLoading && usageData && environmentalImpact && (
        <>
          <EnvironmentStats impact={environmentalImpact} />

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Your Digital Forest</CardTitle>
                <CardDescription>
                  Visual representation of your environmental impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TreeVisualization impact={environmentalImpact} />
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Understanding Your Impact</CardTitle>
                <CardDescription>
                  Context for your environmental footprint
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <strong>CO2 Equivalent:</strong> {environmentalImpact.co2Grams < 1000
                      ? `${environmentalImpact.co2Grams.toFixed(1)}g`
                      : `${(environmentalImpact.co2Grams / 1000).toFixed(2)}kg`}
                  </p>
                  <p className="mb-2">
                    <strong>Energy Used:</strong> {environmentalImpact.energyWh < 1000
                      ? `${environmentalImpact.energyWh.toFixed(1)}Wh`
                      : `${(environmentalImpact.energyWh / 1000).toFixed(2)}kWh`}
                  </p>
                  <p className="mb-4">
                    <strong>Water Usage:</strong> {environmentalImpact.waterLiters.toFixed(3)}L
                  </p>

                  <div className="border-t pt-4 space-y-2">
                    <p className="text-xs">
                      These estimates are based on datacenter energy usage, grid carbon intensity,
                      and cooling requirements. Calculations use industry-standard metrics for
                      AI model inference environmental impact.
                    </p>
                    {usageData && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          <strong>Note:</strong> Cache reads ({usageData.totals.total_tokens > 0 ? Math.round(((usageData.totals.total_cache_read_tokens || 0) / usageData.totals.total_tokens) * 100) : 0}% of your tokens)
                          have 88% lower environmental impact than regular token processing.
                        </p>
                        {usageData.totals.total_thinking_tokens > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <strong>Thinking mode:</strong> {usageData.totals.thinking_sessions_count} sessions used thinking mode
                            ({((usageData.totals.average_thinking_percentage || 0) * 100).toFixed(1)}% avg thinking content)
                            with 2.5x higher environmental impact.
                          </p>
                        )}
                        {naiveImpact && usageData.totals.total_tokens > 0 && (
                          <p className="text-xs text-muted-foreground">
                            If all {(usageData.totals.total_tokens / 1000000).toFixed(1)}M tokens were processed normally:
                            {naiveImpact.co2Grams < 1000 ? `${naiveImpact.co2Grams.toFixed(1)}g` : `${(naiveImpact.co2Grams / 1000).toFixed(2)}kg`} CO₂
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!dataLoading && (!usageData || !usageData.totals.total_tokens) && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">No Usage Data Available</h3>
              <p className="text-muted-foreground">
                Start using Claude Code to see your environmental impact metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
