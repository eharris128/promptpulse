'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

export function LoginForm() {
  const { login } = useAuth()

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">PromptPulse Dashboard</CardTitle>
          <CardDescription>
            Sign in to access your Claude Code usage analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={login} className="w-full" size="lg">
              Sign In
            </Button>
            
            <div className="text-sm text-muted-foreground text-center">
              <p>Secure authentication powered by Auth0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}