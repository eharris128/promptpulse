'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { sanitizeDisplayName } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { LeaderboardSettings, EmailPreferences } from '@/types'

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<LeaderboardSettings>({
    leaderboard_enabled: false,
    display_name: ''
  })
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    email_reports_enabled: false,
    report_frequency: 'weekly',
    preferred_time: '09:00',
    timezone: 'UTC'
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testEmailLoading, setTestEmailLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])



  const loadSettings = async () => {
    try {
      const [leaderboardData, emailData] = await Promise.all([
        apiClient.getLeaderboardSettings(),
        apiClient.getEmailPreferences()
      ])
      setSettings(leaderboardData)
      setEmailPreferences(emailData)
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
      
      // Save both leaderboard settings and email preferences
      await Promise.all([
        apiClient.updateLeaderboardSettings(sanitizedSettings),
        apiClient.updateEmailPreferences(emailPreferences)
      ])
      
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

  const handleTestEmail = async () => {
    try {
      setTestEmailLoading(true)
      setError(null)
      setSuccess(null)
      
      await apiClient.sendTestEmail()
      setSuccess('Test email sent successfully! Check your inbox.')
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Failed to send test email:', err)
      setError(err instanceof Error ? err.message : 'Failed to send test email')
    } finally {
      setTestEmailLoading(false)
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
              <CardTitle>Email Reports (Coming Soon)</CardTitle>
              <CardDescription>
                Configure automatic email reports about your Claude Code usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-reports-enabled" className="text-base font-medium">
                    Enable Email Reports
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive periodic usage summaries via email
                  </p>
                </div>
                <Switch
                  id="email-reports-enabled"
                  checked={emailPreferences.email_reports_enabled}
                  onCheckedChange={(checked) => 
                    setEmailPreferences(prev => ({ ...prev, email_reports_enabled: checked }))
                  }
                />
              </div>

              {emailPreferences.email && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md p-3">
                  <p className="text-sm">
                    <strong>Email:</strong> {emailPreferences.email}
                  </p>
                </div>
              )}

              {!emailPreferences.email && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-md p-3">
                  <p className="text-sm">
                    No email address found. Please add an email to your account to receive reports.
                  </p>
                </div>
              )}

              {emailPreferences.email_reports_enabled && emailPreferences.email && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-frequency">Report Frequency</Label>
                      <Select
                        id="report-frequency"
                        value={emailPreferences.report_frequency}
                        onChange={(e) => 
                          setEmailPreferences(prev => ({ 
                            ...prev, 
                            report_frequency: e.target.value as 'daily' | 'weekly' | 'monthly'
                          }))
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferred-time">Preferred Time</Label>
                      <Input
                        id="preferred-time"
                        type="time"
                        value={emailPreferences.preferred_time}
                        onChange={(e) => 
                          setEmailPreferences(prev => ({ ...prev, preferred_time: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      id="timezone"
                      value={emailPreferences.timezone}
                      onChange={(e) => 
                        setEmailPreferences(prev => ({ ...prev, timezone: e.target.value }))
                      }
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (US)</option>
                      <option value="America/Chicago">Central Time (US)</option>
                      <option value="America/Denver">Mountain Time (US)</option>
                      <option value="America/Los_Angeles">Pacific Time (US)</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Europe/Berlin">Berlin</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Shanghai">Shanghai</option>
                      <option value="Asia/Kolkata">Mumbai</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </Select>
                  </div>

                  {emailPreferences.email && (
                    <div className="flex justify-start">
                      <Button 
                        variant="outline" 
                        onClick={handleTestEmail}
                        disabled={testEmailLoading}
                        size="sm"
                      >
                        {testEmailLoading ? 'Sending...' : 'Send Test Email'}
                      </Button>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      • Reports include token usage, costs, session counts, and top projects
                    </p>
                    <p>
                      • Only sent when you have significant activity in the period
                    </p>
                    <p>
                      • You can change these settings or unsubscribe at any time
                    </p>
                  </div>
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
                  <li>You can still view the leaderboard but won&apos;t appear on it</li>
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