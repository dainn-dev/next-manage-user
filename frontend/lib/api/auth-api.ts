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
  PLATFORM_ADMIN: UserRole.PLATFORM_ADMIN,
  TENANT_ADMIN: UserRole.ADMIN,
  SITE_MANAGER: UserRole.SITE_MANAGER,
  SECURITY_GUARD: UserRole.SECURITY_GUARD,
  MEMBER: UserRole.USER,
  ADMIN: UserRole.ADMIN,
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
    // Check local mock registered users first for Member simulation
    if (typeof window !== 'undefined') {
      const mockUsersStr = localStorage.getItem('mock_registered_users')
      if (mockUsersStr) {
        try {
          const mockUsers = JSON.parse(mockUsersStr)
          const matched = mockUsers.find(
            (u: any) => u.username === credentials.username && u.password === credentials.password
          )
          if (matched) {
            localStorage.setItem(
              'mock_member_user',
              JSON.stringify({
                id: matched.id,
                username: matched.username,
                email: matched.email,
                fullName: matched.fullName,
                role: 'USER',
                status: 'ACTIVE',
                createdAt: matched.createdAt,
                updatedAt: matched.updatedAt,
              })
            )

            localStorage.setItem(
              'mock_member_vehicles',
              JSON.stringify([
                {
                  vehicleId: 'v-' + Date.now(),
                  licensePlate: matched.licensePlate,
                  vehicleType: matched.vehicleType,
                  brand: matched.brand,
                  model: matched.model,
                  status: 'APPROVED',
                  registeredAt: [
                    {
                      tenantId: 't-demo',
                      tenantName: matched.joinCode || 'ParkVision HQ - Chi nhánh Đống Đa',
                    },
                  ],
                },
              ])
            )

            return {
              token: 'mock_member_token',
              tokenType: 'Bearer',
              username: matched.username,
              email: matched.email,
              role: 'MEMBER',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              user: {
                id: matched.id,
                username: matched.username,
                email: matched.email,
                fullName: matched.fullName,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                createdAt: matched.createdAt,
                updatedAt: matched.updatedAt,
              },
            }
          }
        } catch (e) {
          console.error('Failed to parse mock users', e)
        }
      }
    }

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

    if (token === 'mock_member_token') {
      if (typeof window !== 'undefined') {
        const mockUserStr = localStorage.getItem('mock_member_user')
        if (mockUserStr) {
          try {
            return normalizeUser(JSON.parse(mockUserStr))
          } catch (e) {
            console.error('Failed to parse mock_member_user', e)
          }
        }
      }
      return {
        id: 'mock-member-id',
        username: 'member_demo',
        email: 'member@parkvision.vn',
        fullName: 'Nguyễn Văn Thành Viên',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
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

    if (token === 'mock_member_token') {
      this.clearAuthData()
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
    localStorage.removeItem('mock_member_user')
    localStorage.removeItem('mock_member_vehicles')
  }

  isTokenExpired(): boolean {
    const token = this.getToken()
    if (!token) return true
    if (token === 'mock_member_token') return false

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
