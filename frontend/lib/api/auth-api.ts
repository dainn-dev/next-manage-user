import {
  UserRole,
  type LoginRequest,
  type LoginResponse,
  type PasswordResetResponse,
  type User,
} from '../types'

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

const ROLE_MAP: Record<string, UserRole> = {
  PLATFORM_ADMIN: UserRole.ADMIN,
  TENANT_ADMIN: UserRole.ADMIN,
  SITE_MANAGER: UserRole.APPROVER,
  SECURITY_GUARD: UserRole.SECURITY_OFFICER,
  MEMBER: UserRole.USER,
  ADMIN: UserRole.ADMIN,
  APPROVER: UserRole.APPROVER,
  SECURITY_OFFICER: UserRole.SECURITY_OFFICER,
  USER: UserRole.USER,
}

function normalizeUser(user: User): User {
  return {
    ...user,
    role: ROLE_MAP[user.role] ?? UserRole.USER,
  }
}

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

    const loginResponse: LoginResponse = await response.json()
    return { ...loginResponse, user: normalizeUser(loginResponse.user) }
  }

  async requestPasswordReset(email: string): Promise<PasswordResetResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.message || 'Không thể gửi yêu cầu đặt lại mật khẩu')
    }

    return body as PasswordResetResponse
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<PasswordResetResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.message || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    }

    return body as PasswordResetResponse
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

    return normalizeUser(await response.json())
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
      this.clearAuthData()
    }
  }

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

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const token = this.getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return headers
  }
}

export const authApi = new AuthApi()
