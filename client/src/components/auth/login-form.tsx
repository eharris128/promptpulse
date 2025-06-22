'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api'

interface LoginFormProps {
  onLogin: () => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Set the API key and test it by fetching machines
      apiClient.setApiKey(apiKey)
      await apiClient.getMachines()
      
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid API key')
      apiClient.clearApiKey()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">PromptPulse Dashboard</CardTitle>
          <CardDescription>
            Enter your API key to access your Claude Code usage analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
                API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                placeholder="pk_xxxxxxxxxxxxxxxxxx..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
            
            <div className="text-sm text-muted-foreground text-center">
              <p>Need an API key?</p>
              <p className="mt-1">Run: <code className="bg-muted px-1 rounded">promptpulse user init</code></p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}