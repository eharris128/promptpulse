'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Machine } from '@/types'
import { format, parseISO } from 'date-fns'

interface MachinesTableProps {
  machines: Machine[]
}

export function MachinesTable({ machines }: MachinesTableProps) {
  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cost)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Your Machines</CardTitle>
        <CardDescription>
          Claude Code usage across your different machines
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {machines.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No machines found.</p>
              <p className="text-sm mt-2">Run <code className="bg-muted px-1 rounded">promptpulse collect</code> to upload usage data.</p>
            </div>
          ) : (
            machines.map((machine) => (
              <div key={machine.machine_id} className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {machine.machine_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {machine.days_tracked} days tracked
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(machine.first_date)} - {formatDate(machine.last_date)}
                  </p>
                </div>
                <div className="ml-auto font-medium">
                  {formatCost(machine.total_cost)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}