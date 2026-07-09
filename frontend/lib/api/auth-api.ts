import type { LoginRequest, LoginResponse, User } from '../types'

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

class AuthApi {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Login failed')
    }

    return response.json()
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getToken()
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to get current user')
    }

    return response.json()
  }

  async logout(): Promise<void> {
    const token = this.getToken()
    if (!token) {
      return
    }

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      // Always clear local storage regardless of API response
      this.clearAuthData()
    }
  }

  // Token management
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('auth_token', token)
  }

  clearAuthData(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
  }

  isTokenExpired(): boolean {
    const token = this.getToken()
    if (!token) return true

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken()
    return token !== null && !this.isTokenExpired()
  }

  // Get authenticated headers for API requests
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    return headers
  }
}

export const authApi = new AuthApi()
