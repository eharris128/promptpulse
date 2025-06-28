'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCost, formatTokens } from '@/lib/utils'
import { BlockData } from '@/types'
import { Activity, Clock, Zap } from 'lucide-react'

interface BlocksWidgetProps {
  data: BlockData[]
}

export function BlocksWidget({ data }: BlocksWidgetProps) {
  const formatDuration = (startTime: string, endTime?: string, actualEndTime?: string) => {
    const start = new Date(startTime)
    const end = actualEndTime ? new Date(actualEndTime) : (endTime ? new Date(endTime) : new Date())
    const diffMs = end.getTime() - start.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    
    if (diffMinutes < 60) return `${diffMinutes}m`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const formatBlockStart = (startTime: string) => {
    const date = new Date(startTime)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const blockDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    
    if (blockDate.getTime() === today.getTime()) {
      return time
    } else {
      const month = date.getMonth() + 1
      const day = date.getDate()
      const year = date.getFullYear()
      return `${month}/${day}/${year}, ${time}`
    }
  }

  const getModelBadges = (modelsUsed: string[]) => {
    if (!modelsUsed || !Array.isArray(modelsUsed)) {
      return [];
    }
    // Filter out synthetic models and map to badges
    return modelsUsed
      .filter(model => !model.includes('synthetic'))
      .map(model => {
        let variant: "default" | "secondary" | "destructive" | "outline" = "default"
        let displayName = model
        
        if (model.includes('opus')) {
          variant = "destructive"
          displayName = 'opus-4'
        } else if (model.includes('sonnet')) {
          variant = "default"
          displayName = 'sonnet-4'
        }
        
        return (
          <Badge key={model} variant={variant} className="text-xs">
            {displayName}
          </Badge>
        )
      })
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No sessions available</p>
            <p className="text-sm mt-2">Sessions will appear here once you start using Claude Code</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm">Get started by running:</p>
              <code className="bg-muted px-2 py-1 rounded text-xs">promptpulse setup</code>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Sessions
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            Recent activity
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((block) => (
            <div 
              key={`${block.machine_id}-${block.block_id}`} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                block.is_active ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' : 'bg-card hover:bg-muted/50'
              } transition-colors`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {block.is_active ? (
                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {formatBlockStart(block.start_time)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({formatDuration(block.start_time, block.end_time, block.actual_end_time)}
                      {block.is_active && ' elapsed, ongoing'})
                    </span>
                    {block.is_active ? (
                      <Badge variant="outline" className="text-xs">
                        ACTIVE
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getModelBadges(block.models_used || [])}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-medium text-sm">
                  {formatCost(block.total_cost)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTokens(block.total_tokens)}
                </div>
              </div>
            </div>
          ))}
          {data.length >= 20 && (
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Showing recent 20 blocks
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}