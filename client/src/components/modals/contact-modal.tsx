'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, X } from 'lucide-react'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  if (!isOpen) return null

  const handleEmailClick = () => {
    window.open('mailto:echarris@smcm.edu?subject=PromptPulse Inquiry', '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-popover rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>
        
        {/* Content */}
        <div className="text-center">
          <div className="mb-4">
            <Mail className="mx-auto h-12 w-12 text-primary" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2 text-popover-foreground">Get in Touch</h2>
          <p className="text-muted-foreground mb-6">
            Have questions or feedback about PromptPulse? I'd love to hear from you!
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={handleEmailClick}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
            
            <div className="text-sm text-muted-foreground">
              echarris@smcm.edu
            </div>
            
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}