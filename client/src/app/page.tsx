'use client'

import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { UsageChart } from '@/components/dashboard/usage-chart'
import { MachinesTable } from '@/components/dashboard/machines-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Navigation } from '@/components/navigation'
import { apiClient } from '@/lib/api'
import { AggregateData, Machine, LeaderboardData } from '@/types'

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [usageData, setUsageData] = useState<AggregateData | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const apiKey = apiClient.getApiKey()
    if (apiKey) {
      try {
        await apiClient.getMachines()
        setIsAuthenticated(true)
        await loadDashboardData()
      } catch (err) {
        console.error('Auth check failed:', err)
        apiClient.clearApiKey()
      }
    }
    setLoading(false)
  }

  const loadDashboardData = async () => {
    try {
      setDataLoading(true)
      setError(null)
      const [usageResponse, machinesResponse] = await Promise.all([
        apiClient.getUsageAggregate(),
        apiClient.getMachines()
      ])
      
      console.log('Usage data received:', usageResponse)
      console.log('Machines data received:', machinesResponse)
      
      setUsageData(usageResponse)
      setMachines(machinesResponse)
      
      // Load leaderboard data for quick access
      try {
        const leaderboard = await apiClient.getLeaderboard('daily')
        setLeaderboardData(leaderboard)
      } catch (err) {
        console.log('Leaderboard not available or user not opted in')
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setDataLoading(false)
    }
  }

  const handleLogin = async () => {
    setIsAuthenticated(true)
    await loadDashboardData()
  }

  const handleLogout = () => {
    apiClient.clearApiKey()
    setIsAuthenticated(false)
    setUsageData(null)
    setMachines([])
    setLeaderboardData(null)
  }

  const generateSampleData = async () => {
    try {
      setDataLoading(true)
      setError(null)
      await apiClient.generateSampleData()
      await loadDashboardData()
    } catch (err) {
      console.error('Failed to generate sample data:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate sample data')
    } finally {
      setDataLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={handleLogout} />
      
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={loadDashboardData} disabled={dataLoading}>
              {dataLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button variant="outline" onClick={generateSampleData} disabled={dataLoading}>
              {dataLoading ? 'Generating...' : 'Generate Sample Data'}
            </Button>
          </div>
        </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
          <p>Error: {error}</p>
          <Button variant="outline" size="sm" onClick={loadDashboardData} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {dataLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-lg">Loading dashboard data...</div>
        </div>
      )}

      {!dataLoading && usageData && (
        <>
          <StatsCards data={usageData} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <UsageChart data={usageData} type="cost" />
            <MachinesTable machines={machines} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <UsageChart data={usageData} type="tokens" />
            {leaderboardData && leaderboardData.user_rank && (
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Your Leaderboard Ranking</CardTitle>
                  <CardDescription>Today's performance vs other users</CardDescription>
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
            )}
          </div>
        </>
      )}

      {!dataLoading && !usageData && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <p className="text-lg">No usage data found</p>
            <p className="text-muted-foreground">
              Run <code className="bg-muted px-1 rounded">promptpulse collect</code> to upload your usage data, or generate sample data for testing
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={loadDashboardData}>Check Again</Button>
              <Button variant="outline" onClick={generateSampleData}>Generate Sample Data</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}