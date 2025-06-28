'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Leaf, Zap, Droplets } from 'lucide-react'

interface EnvironmentStatsProps {
  impact: {
    co2Grams: number
    energyWh: number
    waterLiters: number
    inputTokens: number
    outputTokens: number
  }
}

export function EnvironmentStats({ impact }: EnvironmentStatsProps) {
  const formatCO2 = (grams: number) => {
    if (grams < 1000) return `${grams.toFixed(1)}g`
    return `${(grams / 1000).toFixed(2)}kg`
  }

  const formatEnergy = (wh: number) => {
    if (wh < 1000) return `${wh.toFixed(1)}Wh`
    return `${(wh / 1000).toFixed(2)}kWh`
  }

  const formatWater = (liters: number) => {
    if (liters < 1) return `${(liters * 1000).toFixed(0)}mL`
    return `${liters.toFixed(3)}L`
  }

  const getEquivalent = (co2Grams: number) => {
    // Simple equivalencies for context
    const milesInCar = (co2Grams / 404000).toFixed(3) // ~404g CO2 per mile
    const hoursLight = (impact.energyWh / 10).toFixed(1) // ~10W LED bulb
    
    if (co2Grams < 50) return `≈ ${(co2Grams / 21).toFixed(1)} smartphone charges`
    if (co2Grams < 500) return `≈ ${milesInCar} miles driving`
    if (co2Grams < 5000) return `≈ ${hoursLight} hours of LED lighting`
    return `≈ ${(co2Grams / 21000).toFixed(1)} gallons of gasoline`
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Carbon Footprint</CardTitle>
          <Leaf className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            {formatCO2(impact.co2Grams)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            CO₂ equivalent emissions
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {getEquivalent(impact.co2Grams)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Energy Usage</CardTitle>
          <Zap className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {formatEnergy(impact.energyWh)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total energy consumed
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            ≈ {(impact.energyWh / 10).toFixed(1)} hours of LED lighting
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Water Usage</CardTitle>
          <Droplets className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {formatWater(impact.waterLiters)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Datacenter cooling water
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {impact.waterLiters < 0.1 ? 
              `≈ ${Math.round(impact.waterLiters * 4)} cups of water` :
              `≈ ${(impact.waterLiters / 3.785).toFixed(2)} gallons`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  )
}