'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { sanitizeDisplayName } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { LeaderboardSettings } from '@/types'

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<LeaderboardSettings>({
    leaderboard_enabled: false,
    display_name: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])



  const loadSettings = async () => {
    try {
      const data = await apiClient.getLeaderboardSettings()
      setSettings(data)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('Failed to load settings')
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      // Sanitize display name before saving
      const sanitizedSettings = {
        ...settings,
        display_name: sanitizeDisplayName(settings.display_name || '')
      }
      
      await apiClient.updateLeaderboardSettings(sanitizedSettings)
      setSettings(sanitizedSettings) // Update local state with sanitized version
      setSuccess('Settings saved successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }


  return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and privacy settings
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 mb-6">
            <p>Error: {error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-md p-4 mb-6">
            <p>{success}</p>
          </div>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard Participation</CardTitle>
              <CardDescription>
                Control whether your usage data appears on the public leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="leaderboard-enabled" className="text-base font-medium">
                    Enable Leaderboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your usage statistics to be included in leaderboard rankings
                  </p>
                </div>
                <Switch
                  id="leaderboard-enabled"
                  checked={settings.leaderboard_enabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, leaderboard_enabled: checked }))
                  }
                />
              </div>

              {settings.leaderboard_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name (Optional)</Label>
                  <Input
                    id="display-name"
                    placeholder="Leave empty to use your username"
                    value={settings.display_name || ''}
                    maxLength={50}
                    onChange={(e) => {
                      const sanitized = sanitizeDisplayName(e.target.value)
                      setSettings(prev => ({ ...prev, display_name: sanitized }))
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    This name will be shown on the leaderboard instead of your username
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy Information</CardTitle>
              <CardDescription>
                How your data is used in the leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p>
                  <strong>When leaderboard is enabled:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Your token usage and costs are included in daily and weekly rankings</li>
                  <li>Your username or display name is shown publicly on the leaderboard</li>
                  <li>Your ranking position and percentile are calculated</li>
                  <li>No other personal information is shared</li>
                </ul>
                
                <p className="mt-4">
                  <strong>When leaderboard is disabled:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Your data is completely private and not included in any rankings</li>
                  <li>You can still view the leaderboard but won't appear on it</li>
                  <li>You can re-enable participation at any time</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
  )
}