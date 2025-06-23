'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelpCircle, Menu, X } from 'lucide-react'
import { UserMenu } from './user-menu'
import { ContactModal } from '../modals/contact-modal'
import { ThemeToggle } from '../theme-toggle'

interface TopHeaderProps {
  onLogout: () => void
  onMenuClick: () => void
  isMobileMenuOpen: boolean
}

export function TopHeader({ 
  onLogout, 
  onMenuClick, 
  isMobileMenuOpen 
}: TopHeaderProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

  return (
    <>
      <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl text-foreground">
              PromptPulse
            </span>
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Help button */}
          <button
            onClick={() => setIsContactModalOpen(true)}
            className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-colors"
            title="Contact & Help"
          >
            <HelpCircle size={16} />
          </button>

          {/* User menu */}
          <UserMenu 
            onLogout={onLogout}
          />
        </div>
      </header>

      {/* Contact Modal */}
      <ContactModal 
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  )
}