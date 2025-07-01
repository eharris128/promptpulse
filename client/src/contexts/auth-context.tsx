'use client'

import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
  const searchParams = useSearchParams()

  // Check for auth success from callback
  useEffect(() => {
    const authSuccess = searchParams.get('auth')
    if (authSuccess === 'success') {
      // Simulate user - for now just set a basic user object
      // Later we'll implement proper token handling
      setUser({
        name: 'Test User',
        email: 'user@example.com'
      })
      setError(null)
    }
    setLoading(false)
  }, [searchParams])

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