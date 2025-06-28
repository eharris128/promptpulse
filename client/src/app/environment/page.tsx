'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TreeVisualization } from '@/components/environment/tree-visualization'
import { EnvironmentStats } from '@/components/environment/environment-stats'
import { apiClient } from '@/lib/api'
import { AggregateData } from '@/types'
import { calculateClaude4Impact } from 'ai-carbon'

export default function EnvironmentPage() {
  const [dataLoading, setDataLoading] = useState(false)
  const [usageData, setUsageData] = useState<AggregateData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadEnvironmentData()
  }, [])

  const loadEnvironmentData = async () => {
    try {
      setDataLoading(true)
      setError(null)
      const usageResponse = await apiClient.getUsageAggregate()
      setUsageData(usageResponse)
    } catch (err) {
      console.error('Failed to load environment data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setDataLoading(false)
    }
  }

  // Calculate environmental impact from usage data
  const environmentalImpact = usageData ? calculateClaude4Impact({
    model: 'claude-4-sonnet', // Default to Sonnet for calculation
    inputTokens: usageData.totals.total_input_tokens || 0,
    outputTokens: usageData.totals.total_output_tokens || 0,
    cacheCreationTokens: usageData.totals.total_cache_creation_tokens || 0,
    cacheReadTokens: usageData.totals.total_cache_read_tokens || 0,
    reasoning: false
  }) : null

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
            {dataLoading ? 'Refreshing...' : 'Refresh'}
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
                  
                  <div className="border-t pt-4">
                    <p className="text-xs">
                      These estimates are based on datacenter energy usage, grid carbon intensity, 
                      and cooling requirements. Calculations use industry-standard metrics for 
                      AI model inference environmental impact.
                    </p>
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
  )
}