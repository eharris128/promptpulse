'use client'

import { use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LeaderboardCardDataProps {
  leaderboardDataPromise: Promise<any>
}

export function LeaderboardCardData({ leaderboardDataPromise }: LeaderboardCardDataProps) {
  const leaderboardData = use(leaderboardDataPromise)
  
  if (!leaderboardData?.user_rank) {
    return null
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Your Leaderboard Ranking</CardTitle>
        <CardDescription>Daily performance vs other users</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Daily Rank</span>
            <span className="font-semibold">#{leaderboardData.user_rank}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Participants</span>
            <span className="font-semibold">{leaderboardData.total_participants}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Top Percentile</span>
            <span className="font-semibold">
              {Math.round(((leaderboardData.total_participants - leaderboardData.user_rank + 1) / leaderboardData.total_participants) * 100)}%
            </span>
          </div>
          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => window.location.href = '/leaderboard'}
          >
            View Full Leaderboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}