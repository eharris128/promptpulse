'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Users, CheckCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface JoinTeamPageProps {
  params: {
    token: string
  }
}

export default function JoinTeamPage({ params }: JoinTeamPageProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
  const [message, setMessage] = useState('')
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    joinTeam()
  }, [])

  const joinTeam = async () => {
    try {
      // Attempt to join the team
      const result = await apiClient.joinTeam(params.token)
      setStatus('success')
      setTeamName(result.teamName)
      setMessage(result.message || `Successfully joined ${result.teamName}!`)
      
      // Redirect to teams page after 3 seconds
      setTimeout(() => {
        router.push('/teams')
      }, 3000)
      
    } catch (error) {
      setStatus('error')
      if (error instanceof Error) {
        setMessage(error.message)
      } else {
        setMessage('Failed to join team. The invitation may be invalid or expired.')
      }
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Team
          </CardTitle>
          <CardDescription>
            {status === 'checking' && 'Processing your invitation...'}
            {status === 'success' && 'Welcome to the team!'}
            {status === 'error' && 'Unable to join team'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'checking' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {status === 'success' && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-md p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p>{message}</p>
                <p className="text-sm mt-1 opacity-80">Redirecting to teams page...</p>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <>
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4">
                <p>{message}</p>
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => router.push('/teams')}>
                  Go to Teams
                </Button>
                <Button onClick={() => router.push('/')}>
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}