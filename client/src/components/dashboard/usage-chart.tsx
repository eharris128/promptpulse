'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCost, formatTokens } from '@/lib/utils'
import { AggregateData } from '@/types'
import { format, parseISO } from 'date-fns'

interface UsageChartProps {
  data: AggregateData
  type: 'cost' | 'tokens'
}

export function UsageChart({ data, type }: UsageChartProps) {
  console.log(`UsageChart ${type} received data:`, data)
  console.log(`UsageChart ${type} daily array:`, data.daily)
  
  if (!data.daily || data.daily.length === 0) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>{type === 'cost' ? 'Daily Usage Cost' : 'Daily Token Usage'}</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Aggregate data by date since we might have multiple machines per day
  const dailyAggregated = data.daily.reduce((acc, day) => {
    const existing = acc.find(item => item.date === day.date)
    if (existing) {
      existing.total_cost += day.total_cost || 0
      existing.total_tokens += day.total_tokens || 0
      existing.input_tokens += day.input_tokens || 0
      existing.output_tokens += day.output_tokens || 0
    } else {
      acc.push({
        date: day.date,
        total_cost: day.total_cost || 0,
        total_tokens: day.total_tokens || 0,
        input_tokens: day.input_tokens || 0,
        output_tokens: day.output_tokens || 0,
      })
    }
    return acc
  }, [] as Array<{date: string, total_cost: number, total_tokens: number, input_tokens: number, output_tokens: number}>)

  const chartData = dailyAggregated
    .slice(-30) // Last 30 days
    .map(day => ({
      date: day.date,
      formattedDate: format(parseISO(day.date), 'MMM dd'),
      cost: day.total_cost,
      tokens: day.total_tokens,
      inputTokens: day.input_tokens,
      outputTokens: day.output_tokens,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const formatChartCost = (value: number) => formatCost(value)
  const formatChartTokens = (value: number) => formatTokens(value)

  if (type === 'cost') {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Daily Usage Cost</CardTitle>
          <CardDescription>Your Claude Code usage costs over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                tickFormatter={formatChartCost}
              />
              <Tooltip 
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload
                  return data ? format(parseISO(data.date), 'MMMM dd, yyyy') : label
                }}
                formatter={(value: number) => [formatChartCost(value), 'Cost']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="cost" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Daily Token Usage</CardTitle>
        <CardDescription>Input and output tokens over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              tickFormatter={formatChartTokens}
            />
            <Tooltip 
              labelFormatter={(label, payload: any) => {
                const data = payload?.[0]?.payload
                return data ? format(parseISO(data.date), 'MMMM dd, yyyy') : label
              }}
              formatter={(value: number, name: string) => [
                formatChartTokens(value), 
                name === 'inputTokens' ? 'Input Tokens' : 'Output Tokens'
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="inputTokens" stackId="a" fill="hsl(var(--chart-1))" name="inputTokens" />
            <Bar dataKey="outputTokens" stackId="a" fill="hsl(var(--chart-2))" name="outputTokens" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}