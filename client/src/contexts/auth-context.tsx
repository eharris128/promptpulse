'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useUser } from '@auth0/nextjs-auth0'

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
  const { user, error, isLoading } = useUser()

  const login = () => {
    // Redirect to Auth0 login
    window.location.href = '/auth/login'
  }

  const logout = () => {
    // Redirect to Auth0 logout
    window.location.href = '/auth/logout'
  }

  const isAuthenticated = !!user && !error

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading: isLoading,
      login,
      logout,
      user
    }}>
      {children}
    </AuthContext.Provider>
  )
}