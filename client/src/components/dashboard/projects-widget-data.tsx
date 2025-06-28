'use client'

import { use } from 'react'
import { ProjectsWidget } from './projects-widget'
import { ProjectData } from '@/types'

interface ProjectsWidgetDataProps {
  projectsDataPromise: Promise<ProjectData[]>
}

export function ProjectsWidgetData({ projectsDataPromise }: ProjectsWidgetDataProps) {
  const projectsData = use(projectsDataPromise)
  return <ProjectsWidget data={projectsData} />
}