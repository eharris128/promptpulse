'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Trophy, Settings, Github } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SideNavProps {
  className?: string
}

export function SideNav({ className }: SideNavProps) {
  const pathname = usePathname()

  const navItems = [
    { 
      href: '/', 
      label: 'Dashboard', 
      icon: BarChart3,
      active: pathname === '/' 
    },
    { 
      href: '/leaderboard', 
      label: 'Leaderboard', 
      icon: Trophy,
      active: pathname === '/leaderboard' 
    },
    { 
      href: '/settings', 
      label: 'Settings', 
      icon: Settings,
      active: pathname === '/settings' 
    },
  ]

  return (
    <nav className={cn("w-64 bg-card border-r border-border h-full flex flex-col", className)}>
      {/* Navigation Items */}
      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Footer Links */}
      <div className="px-3 py-4 border-t border-border">
        <a
          href="https://github.com/eharris128"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Github size={18} />
          <span>Community</span>
        </a>
      </div>
    </nav>
  )
}