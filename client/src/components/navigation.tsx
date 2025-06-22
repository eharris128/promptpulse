'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'

interface NavigationProps {
  onLogout: () => void
}

export function Navigation({ onLogout }: NavigationProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Dashboard', active: pathname === '/' },
    { href: '/leaderboard', label: 'Leaderboard', active: pathname === '/leaderboard' },
    { href: '/settings', label: 'Settings', active: pathname === '/settings' },
  ]

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-xl">PromptPulse</span>
            </Link>
            
            <div className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    item.active 
                      ? 'text-foreground' 
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <Button variant="outline" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}