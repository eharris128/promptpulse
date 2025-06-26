'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCO2, formatEnergy, formatTreeEquivalent } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { EnvironmentalSummary } from '@/types'
import { Leaf, Zap, TreePine, BarChart3 } from 'lucide-react'

export default function EnvironmentalPage() {
  const [loading, setLoading] = useState(true)
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEnvironmentalData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.get<EnvironmentalSummary>('/api/environmental/summary')
      setEnvironmentalData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load environmental data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEnvironmentalData()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Environmental Impact</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-lg">Loading environmental data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Environmental Impact</h2>
          <Button variant="outline" onClick={loadEnvironmentalData}>
            Retry
          </Button>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  const data = environmentalData

  if (!data || data.sessions_with_environmental_data === 0) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Environmental Impact</h2>
          <Button variant="outline" onClick={loadEnvironmentalData}>
            Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <Leaf className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Environmental Data Available</h3>
              <p className="mb-4">Environmental tracking data will appear here once available.</p>
              <p className="text-sm">
                Environmental impact is calculated automatically when you use Claude Code with environmental tracking enabled.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Environmental Impact</h2>
        <Button variant="outline" onClick={loadEnvironmentalData}>
          Refresh
        </Button>
      </div>

      {/* Environmental Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tree Equivalent</CardTitle>
            <TreePine className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTreeEquivalent(data.total_tree_equivalent)}</div>
            <p className="text-xs text-muted-foreground">
              Daily CO2 absorption equivalent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CO2 Emissions</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCO2(data.total_co2_emissions_g)}</div>
            <p className="text-xs text-muted-foreground">
              Across {data.total_sessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Energy Consumption</CardTitle>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEnergy(data.total_energy_wh)}</div>
            <p className="text-xs text-muted-foreground">
              Total energy used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carbon Intensity</CardTitle>
            <Leaf className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.avg_carbon_intensity_g_kwh && !isNaN(data.avg_carbon_intensity_g_kwh) 
                ? data.avg_carbon_intensity_g_kwh.toFixed(0) 
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              g CO2/kWh average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Environmental Details */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environmental Summary</CardTitle>
            <CardDescription>Your total environmental footprint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-lg font-semibold mb-2">Carbon Footprint</div>
              <p className="text-sm text-muted-foreground">
                Your Claude Code usage has generated <strong>{formatCO2(data.total_co2_emissions_g)}</strong> in carbon emissions, 
                equivalent to what <strong>{formatTreeEquivalent(data.total_tree_equivalent)}</strong> would absorb.
              </p>
            </div>
            <div>
              <div className="text-lg font-semibold mb-2">Energy Usage</div>
              <p className="text-sm text-muted-foreground">
                Total energy consumption: <strong>{formatEnergy(data.total_energy_wh)}</strong> 
                across {data.total_sessions} sessions.
              </p>
            </div>
            <div>
              <div className="text-lg font-semibold mb-2">Data Coverage</div>
              <p className="text-sm text-muted-foreground">
                Environmental data available for <strong>{data.sessions_with_environmental_data}</strong> out 
                of {data.total_sessions} total sessions 
                ({Math.round((data.sessions_with_environmental_data / data.total_sessions) * 100)}% coverage).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Understanding Your Impact</CardTitle>
            <CardDescription>Environmental context and information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-lg font-semibold mb-2">Tree Equivalents</div>
              <p className="text-sm text-muted-foreground">
                Tree equivalents represent the amount of CO2 that mature trees absorb daily (~50g CO2/tree/day). 
                This helps put your carbon footprint in relatable terms.
              </p>
            </div>
            <div>
              <div className="text-lg font-semibold mb-2">Carbon Intensity</div>
              <p className="text-sm text-muted-foreground">
                Carbon intensity measures how much CO2 is emitted per unit of energy (g CO2/kWh). 
                Lower values indicate cleaner energy sources.
              </p>
            </div>
            <div>
              <div className="text-lg font-semibold mb-2">Calculation Method</div>
              <p className="text-sm text-muted-foreground">
                Environmental impact is calculated using EcoLogits methodology based on model usage, 
                energy consumption, and regional carbon intensity data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}