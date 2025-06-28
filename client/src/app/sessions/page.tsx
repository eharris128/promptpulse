'use client'

import { useEffect, useState } from 'react'
import { BlocksWidget } from '@/components/dashboard/blocks-widget'
import { BlocksWidgetSkeleton } from '@/components/dashboard/blocks-widget-skeleton'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { BlockData } from '@/types'

export default function SessionsPage() {
  const [dataLoading, setDataLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [blocksData, setBlocksData] = useState<BlockData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessionsData()
  }, [])

  const loadSessionsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setDataLoading(true)
      }
      setError(null)
      
      const blocksResponse = await apiClient.getBlocks({ activeOnly: false })
      // Filter out zero-token sessions and limit to 20
      // Handle cases where total_tokens is incorrect but individual token fields have values
      const filteredBlocks = blocksResponse.filter(block => {
        const calculatedTotal = block.input_tokens + block.output_tokens + block.cache_creation_tokens + block.cache_read_tokens;
        return block.total_tokens > 0 || calculatedTotal > 0;
      })
      setBlocksData(filteredBlocks.slice(0, 20))
    } catch (err) {
      console.error('Failed to load sessions data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      if (isRefresh) {
        setIsRefreshing(false)
      } else {
        setDataLoading(false)
      }
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Sessions</h2>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => loadSessionsData(true)} 
            disabled={dataLoading || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
          <p>Error: {error}</p>
          <Button variant="outline" size="sm" onClick={() => loadSessionsData()} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {dataLoading ? (
        <BlocksWidgetSkeleton />
      ) : (
        <BlocksWidget data={blocksData} />
      )}

      {!dataLoading && blocksData.length === 0 && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <p className="text-lg">No sessions found</p>
            <p className="text-muted-foreground">
              Sessions will appear here as you use Claude Code
            </p>
            <Button onClick={() => loadSessionsData()}>Check Again</Button>
          </div>
        </div>
      )}
    </div>
  )
}