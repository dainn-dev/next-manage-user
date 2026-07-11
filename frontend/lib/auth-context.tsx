"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, LoginRequest } from './types'
import { authApi } from './api/auth-api'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<User>
  adoptSession: (token: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null && authApi.isAuthenticated()

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      if (authApi.isAuthenticated()) {
        const userData = await authApi.getCurrentUser()
        setUser(userData)
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      authApi.clearAuthData()
    } finally {
      setIsLoading(false)
    }
  }

  const adoptSession = async (token: string) => {
    try {
      setIsLoading(true)
      authApi.setToken(token)
      const userData = await authApi.getCurrentUser()
      setUser(userData)
    } catch (error) {
      setUser(null)
      authApi.clearAuthData()
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true)
      const response = await authApi.login(credentials)
      authApi.setToken(response.token)
      setUser(response.user)
      return response.user
    } catch (error) {
      setUser(null)
      authApi.clearAuthData()
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      authApi.clearAuthData()
    }
  }

  const refreshUser = async () => {
    try {
      if (authApi.isAuthenticated()) {
        const userData = await authApi.getCurrentUser()
        setUser(userData)
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
      authApi.clearAuthData()
      setUser(null)
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    adoptSession,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
