'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, Copy, Check, Edit, Trash2, Crown, LogOut } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Team, TeamWithRole, TeamMember } from '@/types'
import { TeamLeaderboard } from '@/components/dashboard/team-leaderboard'

export default function Teams() {
  const [teams, setTeams] = useState<TeamWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Create team form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [creating, setCreating] = useState(false)
  
  
  // Team members state
  const [selectedTeam, setSelectedTeam] = useState<TeamWithRole | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  
  // Copy invite link state
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null)
  
  // Edit team state
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamDescription, setEditTeamDescription] = useState('')
  const [savingTeam, setSavingTeam] = useState(false)
  
  // Member action states
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [promotingMember, setPromotingMember] = useState<string | null>(null)
  const [leavingTeam, setLeavingTeam] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      setLoading(true)
      setError(null)
      const teamsData = await apiClient.getTeams()
      setTeams(teamsData)
    } catch (err) {
      console.error('Failed to load teams:', err)
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async (team: TeamWithRole) => {
    try {
      setLoadingMembers(true)
      setSelectedTeam(team)
      const members = await apiClient.getTeamMembers(team.id)
      setTeamMembers(members)
    } catch (err) {
      console.error('Failed to load team members:', err)
      setError(err instanceof Error ? err.message : 'Failed to load team members')
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTeamName.trim()) {
      setError('Team name is required')
      return
    }
    
    try {
      setCreating(true)
      setError(null)
      
      const newTeam = await apiClient.createTeam({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined
      })
      
      setTeams(prev => [{ ...newTeam, role: 'owner', status: 'active', joined_at: new Date().toISOString() }, ...prev])
      setShowCreateForm(false)
      setNewTeamName('')
      setNewTeamDescription('')
      setSuccess('Team created successfully!')
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to create team:', err)
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }


  const copyInviteLink = async (inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/teams/join/${inviteCode}`
    
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedInviteCode(inviteCode)
      setTimeout(() => setCopiedInviteCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy invite link:', err)
      setError('Failed to copy invite link')
    }
  }

  const startEditingTeam = (team: TeamWithRole) => {
    setEditingTeam(team.id)
    setEditTeamName(team.name)
    setEditTeamDescription(team.description || '')
  }

  const cancelEditingTeam = () => {
    setEditingTeam(null)
    setEditTeamName('')
    setEditTeamDescription('')
  }

  const saveTeam = async (teamId: string) => {
    if (!editTeamName.trim()) {
      setError('Team name cannot be empty')
      return
    }

    try {
      setSavingTeam(true)
      setError(null)
      
      await apiClient.updateTeam(teamId, {
        name: editTeamName.trim(),
        description: editTeamDescription.trim() || undefined
      })
      
      // Update the team in the local state
      setTeams(prev => prev.map(team => 
        team.id === teamId 
          ? { 
              ...team, 
              name: editTeamName.trim(),
              description: editTeamDescription.trim() || undefined
            }
          : team
      ))
      
      setEditingTeam(null)
      setEditTeamName('')
      setEditTeamDescription('')
      setSuccess('Team updated successfully!')
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to update team:', err)
      setError(err instanceof Error ? err.message : 'Failed to update team')
    } finally {
      setSavingTeam(false)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) {
      return
    }

    try {
      setRemovingMember(userId)
      setError(null)
      
      await apiClient.removeTeamMember(teamId, userId)
      
      // Refresh team members list
      if (selectedTeam) {
        await loadTeamMembers(selectedTeam)
      }
      
      setSuccess(`${memberName} removed from team successfully!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to remove member:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  const handlePromoteMember = async (teamId: string, userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to promote ${memberName} to admin?`)) {
      return
    }

    try {
      setPromotingMember(userId)
      setError(null)
      
      await apiClient.promoteTeamMember(teamId, userId)
      
      // Refresh team members list
      if (selectedTeam) {
        await loadTeamMembers(selectedTeam)
      }
      
      setSuccess(`${memberName} promoted to admin successfully!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to promote member:', err)
      setError(err instanceof Error ? err.message : 'Failed to promote member')
    } finally {
      setPromotingMember(null)
    }
  }

  const handleLeaveTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to leave ${teamName}?`)) {
      return
    }

    try {
      setLeavingTeam(true)
      setError(null)
      
      await apiClient.leaveTeam(teamId)
      
      // Refresh teams list and close member panel
      await loadTeams()
      setSelectedTeam(null)
      
      setSuccess(`Successfully left ${teamName}!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to leave team:', err)
      if (err instanceof Error && err.message.includes('Promote another admin first')) {
        setError('You are the only admin. Promote another member to admin first or remove all members.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to leave team')
      }
    } finally {
      setLeavingTeam(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading teams...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">
            Create teams and compare Claude Code usage with your colleagues
          </p>
        </div>
        
        <Button onClick={() => setShowCreateForm(true)} disabled={showCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Create Team
        </Button>
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

      {/* Team Leaderboard - Show when user has exactly one team */}
      {teams.length === 1 && !showCreateForm && (
        <div className="mb-8">
          <TeamLeaderboard 
            teamId={teams[0].id} 
            teamName={teams[0].name} 
          />
        </div>
      )}

      {/* Create Team Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Team</CardTitle>
            <CardDescription>
              Start a new team to compare usage with your colleagues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name *</Label>
                <Input
                  id="team-name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., ACME Engineering Team"
                  maxLength={100}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (Optional)</Label>
                <Input
                  id="team-description"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="Brief description of your team"
                  maxLength={200}
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Team'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewTeamName('')
                    setNewTeamDescription('')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {editingTeam === team.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        placeholder="Team name"
                        maxLength={100}
                        disabled={savingTeam}
                      />
                      <Input
                        value={editTeamDescription}
                        onChange={(e) => setEditTeamDescription(e.target.value)}
                        placeholder="Description (optional)"
                        maxLength={200}
                        disabled={savingTeam}
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => saveTeam(team.id)}
                          disabled={savingTeam}
                        >
                          {savingTeam ? 'Saving...' : 'Save'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={cancelEditingTeam}
                          disabled={savingTeam}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="flex items-center gap-2">
                      {team.name}
                      <Badge variant={team.role === 'owner' ? 'default' : team.role === 'admin' ? 'default' : 'secondary'}>
                        {team.role}
                      </Badge>
                      {(team.role === 'owner' || team.role === 'admin') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditingTeam(team)}
                          className="h-8 px-3 py-1 ml-2"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </CardTitle>
                  )}
                  {team.description && editingTeam !== team.id && (
                    <CardDescription className="mt-1">
                      {team.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {team.member_count} member{team.member_count !== 1 ? 's' : ''}
              </div>
              
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => loadTeamMembers(team)}
                  className="w-full"
                  disabled={loadingMembers && selectedTeam?.id === team.id}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {loadingMembers && selectedTeam?.id === team.id ? 'Loading...' : 'View Members'}
                </Button>
                
                {(team.role === 'owner' || team.role === 'admin') && team.invite_code && (
                  <Button
                    variant="outline"
                    onClick={() => copyInviteLink(team.invite_code)}
                    className="w-full"
                  >
                    {copiedInviteCode === team.invite_code ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copiedInviteCode === team.invite_code ? 'Copied!' : 'Copy Invite Link'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teams.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mt-4 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first team to start comparing Claude Code usage with colleagues
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Team Members Modal/Panel */}
      {selectedTeam && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{selectedTeam.name} Members</CardTitle>
            <CardDescription>
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in this team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="text-center py-4">Loading members...</div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {member.display_name || member.username}
                      </p>
                      {member.email && (
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'owner' ? 'default' : member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      
                      {/* Admin actions - only show to admins/owners */}
                      {(selectedTeam?.role === 'owner' || selectedTeam?.role === 'admin') && member.user_id !== selectedTeam.owner_id && (
                        <div className="flex items-center gap-1">
                          {member.role === 'member' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePromoteMember(selectedTeam.id, member.user_id, member.display_name || member.username)}
                              disabled={promotingMember === member.user_id}
                              className="h-8 px-2"
                            >
                              {promotingMember === member.user_id ? (
                                'Promoting...'
                              ) : (
                                <>
                                  <Crown className="h-3 w-3 mr-1" />
                                  Promote
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(selectedTeam.id, member.user_id, member.display_name || member.username)}
                            disabled={removingMember === member.user_id}
                            className="h-8 px-2 text-destructive hover:text-destructive"
                          >
                            {removingMember === member.user_id ? (
                              'Removing...'
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTeam(null)}
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => handleLeaveTeam(selectedTeam.id, selectedTeam.name)}
                disabled={leavingTeam}
                className="text-destructive hover:text-destructive"
              >
                {leavingTeam ? (
                  'Leaving...'
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave Team
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}