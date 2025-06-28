'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectsWidget } from './projects-widget'
import { BlocksWidget } from './blocks-widget'
import { ProjectsWidgetSkeleton } from './projects-widget-skeleton'
import { BlocksWidgetSkeleton } from './blocks-widget-skeleton'
import { ProjectData, BlockData } from '@/types'
import { FolderOpen, Activity } from 'lucide-react'

interface ActivityWidgetProps {
  projectsData: ProjectData[]
  blocksData: BlockData[]
  isLoading: boolean
}

type TabType = 'projects' | 'blocks'

export function ActivityWidget({ projectsData, blocksData, isLoading }: ActivityWidgetProps) {
  const [activeTab, setActiveTab] = useState<TabType>('blocks')

  const tabs = [
    {
      id: 'blocks' as TabType,
      label: 'Session Blocks',
      icon: Activity,
      count: blocksData?.length || 0
    },
    {
      id: 'projects' as TabType,
      label: 'Projects',
      icon: FolderOpen,
      count: projectsData?.length || 0
    }
  ]


  const renderTabContent = () => {
    if (isLoading) {
      return <BlocksWidgetSkeleton />
    }

    switch (activeTab) {
      case 'projects':
        return <ProjectsWidget data={projectsData} />
      case 'blocks':
        return <BlocksWidget data={blocksData} />
      default:
        return <BlocksWidget data={blocksData} />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-1 bg-muted/50 rounded-lg p-1">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 flex-1 justify-center"
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            {!isLoading && tab.count > 0 && (
              <span className="bg-background/80 text-xs px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </Button>
        ))}
      </div>
      {renderTabContent()}
    </div>
  )
}