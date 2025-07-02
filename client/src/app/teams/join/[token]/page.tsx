'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

interface JoinTeamPageProps {
  params: Promise<{
    token: string
  }>
}

export default function JoinTeamPage({ params }: JoinTeamPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { isAuthenticated, login, loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')

  // Fetch team preview
  useEffect(() => {
    const fetchTeamPreview = async () => {
      try {
        setIsLoading(true)
        console.log('Fetching team preview for token:', resolvedParams.token)
        const { teamName } = await apiClient.getTeamPreview(resolvedParams.token)
        console.log('Team preview response:', { teamName })
        setTeamName(teamName)
      } catch (error) {
        console.error('Error fetching team preview:', error)
        setError('Invalid or expired invitation')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeamPreview()
  }, [resolvedParams.token])

  const handleJoin = async () => {
    if (!isAuthenticated) {
      sessionStorage.setItem('pendingTeamInvite', resolvedParams.token)
      login()
      return
    }

    try {
      setIsJoining(true)
      await apiClient.joinTeam(resolvedParams.token)
      sessionStorage.removeItem('pendingTeamInvite')
      router.push('/')
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Failed to join team')
      }
      setIsJoining(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !teamName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold">Invalid Invitation</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">You have been invited to join</p>
          <h1 className="text-4xl font-bold tracking-tight">{teamName}</h1>
        </div>

        {/* Card */}
        <div className="bg-card border rounded-lg shadow-lg">
          <div className="p-8 space-y-6">
            {/* Logo/Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-10 w-10 text-primary" />
              </div>
            </div>

            {/* Welcome message */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Welcome to PromptPulse</h2>
              <p className="text-sm text-muted-foreground">
                Track and analyze your Claude Code usage with your team
              </p>
            </div>

            {/* Error message if any */}
            {error && teamName && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3">
                {error}
              </div>
            )}

            {/* Action button */}
            <Button 
              onClick={handleJoin} 
              className="w-full" 
              size="lg"
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : isAuthenticated ? (
                'Join Team'
              ) : (
                'Sign in to Join'
              )}
            </Button>

            {/* Alternative actions */}
            {!isAuthenticated && (
              <p className="text-center text-sm text-muted-foreground">
                No account?{' '}
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-normal"
                  onClick={() => {
                    sessionStorage.setItem('pendingTeamInvite', resolvedParams.token)
                    login()
                  }}
                >
                  Create one first
                </Button>
              </p>
            )}
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-muted-foreground">
          Changed your mind?{' '}
          <Button 
            variant="link" 
            className="p-0 h-auto font-normal text-muted-foreground"
            onClick={() => router.push('/')}
          >
            Go back
          </Button>
        </p>
      </div>
    </div>
  )
}