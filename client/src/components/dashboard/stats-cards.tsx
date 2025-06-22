'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AggregateData } from '@/types'

interface StatsCardsProps {
  data: AggregateData
}

export function StatsCards({ data }: StatsCardsProps) {
  console.log('StatsCards received data:', data)
  const { totals } = data

  const formatCost = (cost: number) => {
    if (cost === 0) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(cost)
  }

  const formatNumber = (num: number) => {
    if (num === 0) return '0'
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <span className="text-2xl">💰</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(totals?.total_cost || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Across {totals?.total_machines || 0} machine{(totals?.total_machines || 0) !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          <span className="text-2xl">🎯</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totals?.total_tokens || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Input + Output + Cache tokens
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
          <span className="text-2xl">📝</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totals?.total_input_tokens || 0)}</div>
          <p className="text-xs text-muted-foreground">
            User prompts and context
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
          <span className="text-2xl">🤖</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totals?.total_output_tokens || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Claude responses
          </p>
        </CardContent>
      </Card>
    </div>
  )
}