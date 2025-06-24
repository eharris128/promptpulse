'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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