'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost, formatTokens } from '@/lib/utils'
import { AggregateData } from '@/types'
import { DollarSign, Zap, ArrowRight, ArrowLeft } from 'lucide-react'

interface StatsCardsProps {
  data: AggregateData
}

export function StatsCards({ data }: StatsCardsProps) {
  console.log('StatsCards received data:', data)
  const { totals } = data

  // Ensure totals exists with default values and handle NaN
  const safeTotal = totals || {
    total_cost: 0,
    total_tokens: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_machines: 0
  }

  // Additional safety for cost field to handle NaN
  if (isNaN(safeTotal.total_cost)) {
    safeTotal.total_cost = 0
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(safeTotal.total_cost)}</div>
          <p className="text-xs text-muted-foreground">
            Across {safeTotal.total_machines} machine{safeTotal.total_machines !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          <Zap className="h-5 w-5 text-muted-foreground" />
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
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
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
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTokens(safeTotal.total_output_tokens)}</div>
          <p className="text-xs text-muted-foreground">
            Claude responses
          </p>
        </CardContent>
      </Card>
    </div>
  )
}