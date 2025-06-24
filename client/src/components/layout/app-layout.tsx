'use client'

import { useState } from 'react'
import { TopHeader } from './top-header'
import { SideNav } from './side-nav'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

export function AppLayout({ children, onLogout }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Header */}
      <TopHeader
        onLogout={onLogout}
        onMenuClick={toggleMobileMenu}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Side Navigation */}
        <div className="hidden lg:block">
          <SideNav />
        </div>

        {/* Mobile Side Navigation Overlay */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={closeMobileMenu}
            />
            
            {/* Mobile Menu */}
            <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
              <SideNav className="shadow-xl bg-background border-r border-border" />
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="h-full text-foreground">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}