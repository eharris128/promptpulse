'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { LeaderboardData, LeaderboardEntry } from '@/types'
import { Navigation } from '@/components/navigation'

export default function Leaderboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadLeaderboard()
    }
  }, [isAuthenticated, period])

  const checkAuth = async () => {
    const apiKey = apiClient.getApiKey()
    if (apiKey) {
      try {
        await apiClient.getMachines()
        setIsAuthenticated(true)
      } catch (err) {
        console.error('Auth check failed:', err)
        apiClient.clearApiKey()
      }
    }
    setLoading(false)
  }

  const loadLeaderboard = async () => {
    try {
      setDataLoading(true)
      setError(null)
      const data = await apiClient.getLeaderboard(period)
      setLeaderboardData(data)
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
    } finally {
      setDataLoading(false)
    }
  }

  const handleLogout = () => {
    apiClient.clearApiKey()
    setIsAuthenticated(false)
    setLeaderboardData(null)
  }

  const formatTokens = (tokens: number) => {
    return new Intl.NumberFormat('en-US').format(tokens)
  }

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(cost)
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-600'
    if (rank === 2) return 'text-gray-500'
    if (rank === 3) return 'text-amber-600'
    return 'text-muted-foreground'
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg">Please log in to view the leaderboard</p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={handleLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-muted-foreground">
              See how you stack up against other PromptPulse users
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant={period === 'daily' ? 'default' : 'outline'}
              onClick={() => setPeriod('daily')}
              disabled={dataLoading}
            >
              Daily
            </Button>
            <Button
              variant={period === 'weekly' ? 'default' : 'outline'}
              onClick={() => setPeriod('weekly')}
              disabled={dataLoading}
            >
              Weekly
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 mb-6">
            <p>Error: {error}</p>
            <Button variant="outline" size="sm" onClick={loadLeaderboard} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {dataLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-lg">Loading leaderboard...</div>
          </div>
        )}

        {!dataLoading && leaderboardData && (
          <div className="space-y-6">
            {leaderboardData.user_rank && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Your Ranking
                    <Badge variant="secondary">
                      #{leaderboardData.user_rank} of {leaderboardData.total_participants}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    You're in the top{' '}
                    {Math.round(((leaderboardData.total_participants - leaderboardData.user_rank + 1) / leaderboardData.total_participants) * 100)}%
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  {period === 'daily' ? 'Today\'s' : 'This Week\'s'} Top Performers
                </CardTitle>
                <CardDescription>
                  {leaderboardData.total_participants} participants • Ranked by total tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboardData.entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No leaderboard data available for this period.</p>
                    <p className="text-sm mt-2">
                      Users must opt-in to leaderboard participation in their settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leaderboardData.entries.map((entry) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`text-2xl font-bold ${getRankColor(entry.rank)}`}>
                            {getRankIcon(entry.rank)}
                          </div>
                          <div>
                            <p className="font-medium">
                              {entry.display_name || entry.username}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Top {entry.percentile}%
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatTokens(entry.total_tokens)} tokens
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCost(entry.total_cost)} • {formatTokens(entry.daily_average)} avg/day
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {leaderboardData.entries.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Want to join the leaderboard?</CardTitle>
                  <CardDescription>
                    Enable leaderboard participation in your settings to compete with other users.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => window.location.href = '/settings'}>
                    Go to Settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}