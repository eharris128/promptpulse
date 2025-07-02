"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCost, formatTokens } from "@/lib/utils";
import { ProjectData } from "@/types";
import { FolderOpen, Calendar, Activity } from "lucide-react";

interface ProjectsWidgetProps {
  data: ProjectData[]
}

export function ProjectsWidget({ data }: ProjectsWidgetProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    }
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    }
    return date.toLocaleDateString();
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Top Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No project data available</p>
            <p className="text-sm mt-2">Projects will appear here once you start using Claude Code</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm">Start collecting data with:</p>
              <code className="bg-muted px-2 py-1 rounded text-xs">promptpulse collect</code>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Top Projects
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            Last 30 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((project, index) => (
            <div key={project.project_path} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" title={project.project_name}>
                    {project.project_name}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {project.session_count} sessions
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(project.last_activity)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-medium text-sm">
                  {formatCost(project.total_cost)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTokens(project.total_tokens)}
                </div>
              </div>
            </div>
          ))}
          {data.length === 10 && (
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Showing top 10 projects
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
