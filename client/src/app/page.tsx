'use client'

import { useEffect, useState } from 'react'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { UsageChart } from '@/components/dashboard/usage-chart'
import { MachinesTable } from '@/components/dashboard/machines-table'
import { FixedPlanComparison } from '@/components/dashboard/fixed-plan-comparison'
import { ProjectsWidget } from '@/components/dashboard/projects-widget'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { AggregateData, Machine, ProjectData, LeaderboardData, PlanSettings } from '@/types'

export default function Dashboard() {
  const [dataLoading, setDataLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [usageData, setUsageData] = useState<AggregateData | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [projectsData, setProjectsData] = useState<ProjectData[]>([])
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [planSettings, setPlanSettings] = useState<PlanSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])


  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setDataLoading(true)
      }
      setError(null)
      const [usageResponse, machinesResponse, planResponse, projectsResponse] = await Promise.all([
        apiClient.getUsageAggregate(),
        apiClient.getMachines(),
        apiClient.getPlanSettings(),
        apiClient.getProjects({ limit: 10 })
      ])
      
      setUsageData(usageResponse)
      setMachines(machinesResponse)
      setPlanSettings(planResponse)
      setProjectsData(projectsResponse)
      
      try {
        const leaderboard = await apiClient.getLeaderboard('daily')
        setLeaderboardData(leaderboard)
      } catch (err) {
        console.log('Leaderboard not available or user not opted in', err)
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
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
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => loadDashboardData(true)} 
              disabled={dataLoading || isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
          <p>Error: {error}</p>
          <Button variant="outline" size="sm" onClick={() => loadDashboardData()} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {dataLoading && !usageData && (
        <div className="space-y-4">
          <div className="text-lg">Loading dashboard data...</div>
        </div>
      )}

      {!dataLoading && usageData && usageData.totals && planSettings && (
        <>
          <StatsCards data={usageData} />
          <FixedPlanComparison 
            actualCost={usageData.totals?.total_cost || 0} 
            userPlan={planSettings.claude_plan} 
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="lg:col-span-4">
              <ProjectsWidget data={projectsData} />
            </div>
          </div>
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
            )}
          </div>
        </>
      )}

      {!dataLoading && !usageData && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <p className="text-lg">No usage data found</p>
            <p className="text-muted-foreground">
              Run <code className="bg-muted px-1 rounded">promptpulse collect</code> to upload your usage data
            </p>
            <Button onClick={() => loadDashboardData()}>Check Again</Button>
          </div>
        </div>
      )}
      </div>
  )
}