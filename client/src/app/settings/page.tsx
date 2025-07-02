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
import { LeaderboardSettings, EmailPreferences, PlanSettings, ClaudePlan } from '@/types'

const PLAN_OPTIONS = [
  { value: 'pro_17', label: 'Pro ($17/month)', description: 'Standard Claude usage' },
  { value: 'max_100', label: 'Max 5x ($100/month)', description: '5x higher usage limits' },
  { value: 'max_200', label: 'Max 20x ($200/month)', description: '20x higher usage limits' }
] as const

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<LeaderboardSettings>({
    leaderboard_enabled: false,
    display_name: '',
    team_leaderboard_enabled: true,
    team_display_name: ''
  })
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    daily_digest: true,
    weekly_summary: true,
    leaderboard_updates: true,
    team_invitations: true,
    security_alerts: true,
    email_frequency: 'daily',
    timezone_for_emails: 'UTC'
  })
  const [planSettings, setPlanSettings] = useState<PlanSettings>({
    claude_plan: 'max_100'
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])



  const loadSettings = async () => {
    try {
      const [leaderboardData, emailData, planData] = await Promise.all([
        apiClient.getLeaderboardSettings(),
        apiClient.getEmailPreferences(),
        apiClient.getPlanSettings()
      ])
      setSettings(leaderboardData)
      setEmailPreferences(emailData)
      setPlanSettings(planData)
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
      
      // Save leaderboard settings, email preferences, and plan settings
      await Promise.all([
        apiClient.updateLeaderboardSettings(sanitizedSettings),
        apiClient.updateEmailPreferences(emailPreferences),
        apiClient.updatePlanSettings(planSettings)
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

  const handleUpdateEmail = async () => {
    try {
      setSavingEmail(true)
      setError(null)
      setSuccess(null)
      
      const response = await apiClient.updateUserEmail(newEmail)
      
      // Update email preferences with new email
      setEmailPreferences(prev => ({ ...prev, email: response.email }))
      setIsEditingEmail(false)
      setNewEmail('')
      setSuccess('Email updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to update email:', err)
      setError(err instanceof Error ? err.message : 'Failed to update email')
    } finally {
      setSavingEmail(false)
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
              <CardTitle>Public Leaderboard</CardTitle>
              <CardDescription>
                Control whether your usage data appears on the public leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="public-leaderboard-enabled" className="text-base font-medium">
                    Enable Public Leaderboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your usage statistics to be included in public leaderboard rankings
                  </p>
                </div>
                <Switch
                  id="public-leaderboard-enabled"
                  checked={settings.leaderboard_enabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, leaderboard_enabled: checked }))
                  }
                />
              </div>

              {settings.leaderboard_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="public-display-name">Public Display Name (Optional)</Label>
                  <Input
                    id="public-display-name"
                    placeholder="Leave empty to stay anonymous on public leaderboards"
                    value={settings.display_name || ''}
                    maxLength={50}
                    onChange={(e) => {
                      const sanitized = sanitizeDisplayName(e.target.value)
                      setSettings(prev => ({ ...prev, display_name: sanitized }))
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    How you appear on public leaderboards • Leave empty to stay anonymous
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Leaderboard</CardTitle>
              <CardDescription>
                Control whether your usage data appears in team leaderboards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="team-leaderboard-enabled" className="text-base font-medium">
                    Enable Team Leaderboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your usage statistics to be included in team rankings
                  </p>
                </div>
                <Switch
                  id="team-leaderboard-enabled"
                  checked={settings.team_leaderboard_enabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, team_leaderboard_enabled: checked }))
                  }
                />
              </div>

              {settings.team_leaderboard_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="team-display-name">Team Display Name (Optional)</Label>
                  <Input
                    id="team-display-name"
                    placeholder="What should teammates call you?"
                    value={settings.team_display_name || ''}
                    maxLength={50}
                    onChange={(e) => {
                      const sanitized = sanitizeDisplayName(e.target.value)
                      setSettings(prev => ({ ...prev, team_display_name: sanitized }))
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    How you appear to teammates • Falls back to public name, then username
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ display: 'none' }}>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure which email notifications you would like to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6" style={{ display: 'none' }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="daily-digest" className="text-base font-medium">
                      Daily Digest
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Daily summary of your Claude Code usage
                    </p>
                  </div>
                  <Switch
                    id="daily-digest"
                    checked={emailPreferences.daily_digest}
                    onCheckedChange={(checked) => 
                      setEmailPreferences(prev => ({ ...prev, daily_digest: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-summary" className="text-base font-medium">
                      Weekly Summary
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive weekly usage report
                    </p>
                  </div>
                  <Switch
                    id="weekly-summary"
                    checked={emailPreferences.weekly_summary}
                    onCheckedChange={(checked) => 
                      setEmailPreferences(prev => ({ ...prev, weekly_summary: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="leaderboard-updates" className="text-base font-medium">
                      Leaderboard Updates
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications about your leaderboard ranking changes
                    </p>
                  </div>
                  <Switch
                    id="leaderboard-updates"
                    checked={emailPreferences.leaderboard_updates}
                    onCheckedChange={(checked) => 
                      setEmailPreferences(prev => ({ ...prev, leaderboard_updates: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="team-invitations" className="text-base font-medium">
                      Team Invitations
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications when you are invited to join teams
                    </p>
                  </div>
                  <Switch
                    id="team-invitations"
                    checked={emailPreferences.team_invitations}
                    onCheckedChange={(checked) => 
                      setEmailPreferences(prev => ({ ...prev, team_invitations: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="security-alerts" className="text-base font-medium">
                      Security Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Important security notifications about your account
                    </p>
                  </div>
                  <Switch
                    id="security-alerts"
                    checked={emailPreferences.security_alerts}
                    onCheckedChange={(checked) => 
                      setEmailPreferences(prev => ({ ...prev, security_alerts: checked }))
                    }
                  />
                </div>
              </div>

              {emailPreferences.email && !isEditingEmail && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md p-3 flex items-center justify-between">
                  <p className="text-sm">
                    <strong>Email:</strong> {emailPreferences.email}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingEmail(true)
                      setNewEmail(emailPreferences.email || '')
                    }}
                  >
                    Change Email
                  </Button>
                </div>
              )}

              {(!emailPreferences.email || isEditingEmail) && (
                <div className="space-y-3">
                  {!emailPreferences.email && !isEditingEmail && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-md p-3">
                      <p className="text-sm">
                        No email address found. Please add an email to your account to receive reports.
                      </p>
                    </div>
                  )}
                  
                  {(!emailPreferences.email || isEditingEmail) && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address (coming soon...)</Label>
                        <Input
                          disabled
                          id="email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpdateEmail}
                          disabled={savingEmail || !newEmail}
                          size="sm"
                        >
                          {savingEmail ? 'Saving...' : 'Save Email'}
                        </Button>
                        {isEditingEmail && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingEmail(false)
                              setNewEmail('')
                              setError(null)
                            }}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {emailPreferences.email && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-frequency">Email Frequency</Label>
                      <Select
                        id="email-frequency"
                        value={emailPreferences.email_frequency}
                        onChange={(e) => 
                          setEmailPreferences(prev => ({ 
                            ...prev, 
                            email_frequency: e.target.value as 'immediate' | 'daily' | 'weekly' | 'none'
                          }))
                        }
                      >
                        <option value="immediate">Immediate</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="none">None (Disabled)</option>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone-for-emails">Timezone for Emails</Label>
                      <Select
                        id="timezone-for-emails"
                        value={emailPreferences.timezone_for_emails}
                        onChange={(e) => 
                          setEmailPreferences(prev => ({ ...prev, timezone_for_emails: e.target.value }))
                        }
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">New York</option>
                        <option value="America/Los_Angeles">Los Angeles</option>
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Asia/Shanghai">Shanghai</option>
                        <option value="Asia/Kolkata">Mumbai</option>
                        <option value="Australia/Sydney">Sydney</option>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-frequency-desc">Email Delivery</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose how frequently you want to receive email notifications. Individual notification types can be controlled above.
                    </p>
                    <Select>
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
              <CardTitle>Claude Plan</CardTitle>
              <CardDescription>
                Configure your Claude subscription plan for accurate ROI calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="claude-plan">Your Claude Plan</Label>
                <select
                  id="claude-plan"
                  value={planSettings.claude_plan}
                  onChange={(e) => 
                    setPlanSettings(prev => ({ ...prev, claude_plan: e.target.value as ClaudePlan }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  {PLAN_OPTIONS.find(p => p.value === planSettings.claude_plan)?.description}
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md p-3">
                <p className="text-sm">
                  <strong>Why this matters:</strong> Setting your correct plan helps calculate your ROI by comparing your actual usage costs against your fixed monthly subscription fee. This shows how much you are saving (or overspending) with your current plan.
                </p>
              </div>
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
                  <li>You can still view the leaderboard but will not appear on it</li>
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