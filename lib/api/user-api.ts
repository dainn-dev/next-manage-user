import type { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest,
  UserStatistics 
} from '../types'
import { UserRole, UserStatus } from '../types'

import { authApi } from "./auth-api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
}

class UserApi {
  private getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  // Get all users with pagination
  async getAllUsers(
    page: number = 0, 
    size: number = 10, 
    sortBy: string = 'createdAt', 
    sortDir: string = 'desc'
  ): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir
    })

    const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch users')
    }

    return response.json()
  }

  // Get all users as list (no pagination)
  async getAllUsersList(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users/list`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch users list')
    }

    return response.json()
  }

  // Get user by ID
  async getUserById(id: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch user')
    }

    return response.json()
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/users/username/${username}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch user')
    }

    return response.json()
  }

  // Search users
  async searchUsers(
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir
    })

    const response = await fetch(`${API_BASE_URL}/admin/users/search?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to search users')
    }

    return response.json()
  }

  // Get users by role
  async getUsersByRole(
    role: UserRole,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir
    })

    const response = await fetch(`${API_BASE_URL}/admin/users/role/${role}?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch users by role')
    }

    return response.json()
  }

  // Get users by status
  async getUsersByStatus(
    status: UserStatus,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir
    })

    const response = await fetch(`${API_BASE_URL}/admin/users/status/${status}?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch users by status')
    }

    return response.json()
  }

  // Create user
  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to create user')
    }

    return response.json()
  }

  // Update user
  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update user')
    }

    return response.json()
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete user')
    }
  }

  // Check if username exists
  async checkUsernameExists(username: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/users/exists/username/${username}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to check username')
    }

    return response.json()
  }

  // Check if email exists
  async checkEmailExists(email: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/users/exists/email/${email}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to check email')
    }

    return response.json()
  }

  // Update user status
  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    const params = new URLSearchParams({ status })
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/status?${params}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update user status')
    }

    return response.json()
  }

  // Update user role
  async updateUserRole(id: string, role: UserRole): Promise<User> {
    const params = new URLSearchParams({ role })
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/role?${params}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update user role')
    }

    return response.json()
  }

  // Bulk delete users
  async bulkDeleteUsers(userIds: string[]): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/users/bulk-delete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userIds),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete users')
    }
  }

  // Bulk update user status
  async bulkUpdateUserStatus(userIds: string[], status: UserStatus): Promise<User[]> {
    const params = new URLSearchParams({ status })
    const response = await fetch(`${API_BASE_URL}/admin/users/bulk-update-status?${params}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userIds),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update user status')
    }

    return response.json()
  }

  // Bulk update user role
  async bulkUpdateUserRole(userIds: string[], role: UserRole): Promise<User[]> {
    const params = new URLSearchParams({ role })
    const response = await fetch(`${API_BASE_URL}/admin/users/bulk-update-role?${params}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userIds),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update user role')
    }

    return response.json()
  }

  // Get user statistics
  async getUserStatistics(): Promise<UserStatistics> {
    const [usersList] = await Promise.all([
      this.getAllUsersList()
    ])

    const stats: UserStatistics = {
      totalUsers: usersList.length,
      activeUsers: usersList.filter(u => u.status === UserStatus.ACTIVE).length,
      inactiveUsers: usersList.filter(u => u.status === UserStatus.INACTIVE).length,
      lockedUsers: usersList.filter(u => u.status === UserStatus.LOCKED).length,
      suspendedUsers: usersList.filter(u => u.status === UserStatus.SUSPENDED).length,
      adminUsers: usersList.filter(u => u.role === UserRole.ADMIN).length,
      regularUsers: usersList.filter(u => u.role === UserRole.USER).length,
      usersByRole: {
        [UserRole.ADMIN]: usersList.filter(u => u.role === UserRole.ADMIN).length,
        [UserRole.USER]: usersList.filter(u => u.role === UserRole.USER).length,
      },
      usersByStatus: {
        [UserStatus.ACTIVE]: usersList.filter(u => u.status === UserStatus.ACTIVE).length,
        [UserStatus.INACTIVE]: usersList.filter(u => u.status === UserStatus.INACTIVE).length,
        [UserStatus.LOCKED]: usersList.filter(u => u.status === UserStatus.LOCKED).length,
        [UserStatus.SUSPENDED]: usersList.filter(u => u.status === UserStatus.SUSPENDED).length,
      }
    }

    return stats
  }
}

export const userApi = new UserApi()
