'use client'

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  login: () => void
  logout: () => void
  user: any
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
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Custom function to fetch user profile from Express server
  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/auth/profile', {
        credentials: 'include' // Include cookies for session
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Check authentication status on mount and periodically
  useEffect(() => {
    fetchUserProfile()
    
    // Check auth status every 30 seconds to handle session expiration
    const interval = setInterval(fetchUserProfile, 30000)
    return () => clearInterval(interval)
  }, [])

  const login = () => {
    // Redirect to Express server login endpoint
    window.location.href = '/auth/login'
  }

  const logout = () => {
    // Redirect to Express server logout endpoint
    window.location.href = '/auth/logout'
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading,
      login,
      logout,
      user
    }}>
      {children}
    </AuthContext.Provider>
  )
}