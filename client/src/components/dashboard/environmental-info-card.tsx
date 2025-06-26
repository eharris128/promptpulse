'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCO2, formatEnergy, formatTreeEquivalent } from '@/lib/utils'
import { AggregateData } from '@/types'
import { Leaf } from 'lucide-react'

interface EnvironmentalInfoCardProps {
  data: AggregateData
}

export function EnvironmentalInfoCard({ data }: EnvironmentalInfoCardProps) {
  const { totals } = data
  
  // Show card only if environmental data is available
  if (!totals?.total_co2_emissions_g && !totals?.total_tree_equivalent) {
    return null
  }

  const treeEquivalent = totals?.total_tree_equivalent || 0
  const co2Emissions = totals?.total_co2_emissions_g || 0
  const energyConsumption = totals?.total_energy_wh || 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Environmental Footprint</CardTitle>
        <Leaf className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatTreeEquivalent(treeEquivalent)}</div>
        <p className="text-xs text-muted-foreground">
          {formatCO2(co2Emissions)} • {formatEnergy(energyConsumption)}
        </p>
      </CardContent>
    </Card>
  )
}