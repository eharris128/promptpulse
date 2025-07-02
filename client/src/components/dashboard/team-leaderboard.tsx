"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatTokens, getAverageLabel } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { TeamLeaderboardData, TeamLeaderboardEntry } from "@/types";
import { Trophy, Users } from "lucide-react";

interface TeamLeaderboardProps {
  teamId: string // KSUID
  teamName: string
}

export function TeamLeaderboard({ teamId, teamName }: TeamLeaderboardProps) {
  const [dataLoading, setDataLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<TeamLeaderboardData | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [error, setError] = useState<string | null>(null);

  const loadTeamLeaderboard = useCallback(async () => {
    try {
      setDataLoading(true);
      setError(null);
      const data = await apiClient.getTeamLeaderboard(teamId, period);
      setLeaderboardData(data);
    } catch (err) {
      console.error("Failed to load team leaderboard:", err);
      setError(err instanceof Error ? err.message : "Failed to load team leaderboard");
    } finally {
      setDataLoading(false);
    }
  }, [teamId, period]);

  useEffect(() => {
    loadTeamLeaderboard();
  }, [loadTeamLeaderboard]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-600 dark:text-yellow-400";
    if (rank === 2) return "text-slate-600 dark:text-slate-400";
    if (rank === 3) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {teamName} Leaderboard
            </CardTitle>
            <CardDescription>
              Team performance ranking • {leaderboardData?.total_participants || 0} active members
              {leaderboardData?.user_rank && (
                <> • You are #{leaderboardData.user_rank} of {leaderboardData.total_participants}</>
              )}
            </CardDescription>
          </div>

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={period === "daily" ? "default" : "outline"}
              onClick={() => setPeriod("daily")}
              disabled={dataLoading}
            >
              Daily
            </Button>
            <Button
              size="sm"
              variant={period === "weekly" ? "default" : "outline"}
              onClick={() => setPeriod("weekly")}
              disabled={dataLoading}
            >
              Weekly
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 mb-4">
            <p className="text-sm">Error: {error}</p>
            <Button variant="outline" size="sm" onClick={loadTeamLeaderboard} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {dataLoading && (
          <div className="text-center py-6 text-muted-foreground">
            Loading team leaderboard...
          </div>
        )}

        {!dataLoading && leaderboardData && (
          <div className="space-y-4">
            {/* Team leaderboard entries */}
            {leaderboardData.entries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="mx-auto h-8 w-8 mb-2" />
                <p>No team leaderboard data available.</p>
                <p className="text-sm mt-1">
                  Team members need to opt-in to team leaderboards in settings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboardData.entries.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      entry.is_current_user
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                        : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`text-lg font-bold ${getRankColor(entry.rank)}`}>
                        {getRankIcon(entry.rank)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {entry.display_name || entry.username}
                          </p>
                          {entry.is_current_user && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Top {entry.percentile}%
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {formatTokens(entry.total_tokens)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCost(entry.total_cost)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
