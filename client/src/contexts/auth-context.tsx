'use client'

import { createContext, useContext, ReactNode, useEffect, useState } from 'react'

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
  const [error, setError] = useState(null)

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      setUser(null)
      setError(error)
    } finally {
      setLoading(false)
    }
  }

  const login = () => {
    // Redirect to Auth0 login
    window.location.href = '/api/auth/login'
  }

  const logout = () => {
    // Redirect to Auth0 logout
    window.location.href = '/api/auth/logout'
  }

  const isAuthenticated = !!user && !error

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