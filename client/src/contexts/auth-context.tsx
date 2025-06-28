'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { sanitizeApiKey } from '@/lib/utils'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  login: (apiKey: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAuth = async () => {
    const apiKey = apiClient.getApiKey()
    if (apiKey) {
      try {
        await apiClient.getMachines()
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Auth check failed:', error)
        apiClient.clearApiKey()
        setIsAuthenticated(false)
      }
    } else {
      setIsAuthenticated(false)
    }
    setLoading(false)
  }

  const login = async (apiKey: string): Promise<boolean> => {
    try {
      // Sanitize API key before setting it
      const sanitizedApiKey = sanitizeApiKey(apiKey)
      apiClient.setApiKey(sanitizedApiKey)
      await apiClient.getMachines()
      setIsAuthenticated(true)
      
      // Check for pending team invitation
      if (typeof window !== 'undefined') {
        const pendingInvite = sessionStorage.getItem('pendingTeamInvite')
        if (pendingInvite) {
          sessionStorage.removeItem('pendingTeamInvite')
          // Join the team automatically after successful login
          try {
            await apiClient.joinTeam(pendingInvite)
            router.push('/teams')
          } catch (error) {
            console.error('Failed to join team after login:', error)
            // Still redirect to the invitation page so user can see the error
            router.push(`/teams/join/${pendingInvite}`)
          }
        }
      }
      
      return true
    } catch (error) {
      console.error('Login failed:', error)
      apiClient.clearApiKey()
      setIsAuthenticated(false)
      return false
    }
  }

  const logout = () => {
    apiClient.clearApiKey()
    setIsAuthenticated(false)
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading,
      login,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  )
}