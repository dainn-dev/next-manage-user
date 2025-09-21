import type { Employee } from "@/lib/types"
import { authApi } from "./auth-api"

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface EmployeeApiResponse {
  content: Employee[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface EmployeeCreateRequest {
  employeeId: string
  name: string
  email: string
  phone: string
  department: string
  position: string
  hireDate: string
  birthDate?: string
  gender?: string
  status?: string
  accessLevel?: string
  address?: string
  avatar?: string
  emergencyContact?: string
  emergencyPhone?: string
  salary?: number
  permissions?: string[]
  notes?: string
  rank?: string
  jobTitle?: string
  militaryCivilian?: string
  vehicleType?: "car" | "motorbike" | "truck" | "bus"
}

export interface EmployeeStatistics {
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  terminatedEmployees: number
  employeesByDepartment: Record<string, number>
  employeesByStatus: Record<string, number>
  employeesByAccessLevel: Record<string, number>
  averageAge: number
  newEmployeesThisMonth: number
  newEmployeesThisYear: number
}

export interface BulkOperationRequest {
  employeeIds: string[]
}

export interface BulkUpdateStatusRequest extends BulkOperationRequest {
  status: string
}

export interface BulkUpdateDepartmentRequest extends BulkOperationRequest {
  department: string
}

export interface EmployeeUpdateRequest extends EmployeeCreateRequest {
  id: string
}

class EmployeeApiService {
  private baseUrl = `${API_BASE_URL}/employees`
  private requestCache = new Map<string, Promise<any>>()
  private abortControllers = new Map<string, AbortController>()

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const cacheKey = `${options.method || 'GET'}:${url}`
    
    // Check if request is already in progress
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey)!
    }
    
    const config: RequestInit = {
      headers: {
        ...authApi.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    // Create abort controller for this request
    const abortController = new AbortController()
    this.abortControllers.set(cacheKey, abortController)
    
    const requestPromise = this.executeRequest<T>(url, { ...config, signal: abortController.signal })
    this.requestCache.set(cacheKey, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      // Clean up cache and abort controller after request completes
      this.requestCache.delete(cacheKey)
      this.abortControllers.delete(cacheKey)
    }
  }

  private async executeRequest<T>(
    url: string,
    config: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed for ${url}:`, error)
      throw error
    }
  }

  // Get all employees with pagination
  async getAllEmployees(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EmployeeApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sort: `${sortBy},${sortDir}`
    })
    
    return this.request<EmployeeApiResponse>(`?${params}`)
  }

  // Get all employees as list (no pagination)
  async getAllEmployeesList(): Promise<Employee[]> {
    return this.request<Employee[]>('/list')
  }

  // Get employee by ID
  async getEmployeeById(id: string): Promise<Employee> {
    return this.request<Employee>(`/${id}`)
  }

  // Get employee by employee ID
  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee> {
    return this.request<Employee>(`/employee-id/${employeeId}`)
  }

  // Search employees
  async searchEmployees(
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EmployeeApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sort: `${sortBy},${sortDir}`
    })
    
    return this.request<EmployeeApiResponse>(`/search?${params}`)
  }

  // Get employees by department
  async getEmployeesByDepartment(
    department: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EmployeeApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sort: `${sortBy},${sortDir}`
    })
    
    return this.request<EmployeeApiResponse>(`/department/${department}?${params}`)
  }


  // Get employees by status
  async getEmployeesByStatus(
    status: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EmployeeApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sort: `${sortBy},${sortDir}`
    })
    
    return this.request<EmployeeApiResponse>(`/status/${status}?${params}`)
  }

  // Create new employee
  async createEmployee(employee: EmployeeCreateRequest): Promise<Employee> {
    return this.request<Employee>('', {
      method: 'POST',
      body: JSON.stringify(employee),
    })
  }

  // Update employee
  async updateEmployee(id: string, employee: EmployeeCreateRequest): Promise<Employee> {
    return this.request<Employee>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee),
    })
  }

  // Delete employee
  async deleteEmployee(id: string): Promise<void> {
    return this.request<void>(`/${id}`, {
      method: 'DELETE',
    })
  }

  // Check if employee ID exists
  async checkEmployeeIdExists(employeeId: string): Promise<boolean> {
    try {
      await this.request(`/exists/employee-id/${employeeId}`)
      return true
    } catch {
      return false
    }
  }

  // Get employee count by status
  async getEmployeeCountByStatus(status: string): Promise<number> {
    return this.request<number>(`/stats/count/status/${status}`)
  }

  // Get employee count by department
  async getEmployeeCountByDepartment(department: string): Promise<number> {
    return this.request<number>(`/stats/count/department/${department}`)
  }

  // Upload employee image
  async uploadEmployeeImage(id: string, imageFile: File): Promise<Employee> {
    const formData = new FormData()
    formData.append('image', imageFile)

    return this.request<Employee>(`/${id}/upload-image`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
      body: formData,
    })
  }

  // Bulk operations
  async bulkDeleteEmployees(employeeIds: string[]): Promise<void> {
    return this.request<void>('/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(employeeIds),
    })
  }

  async bulkUpdateEmployeeStatus(employeeIds: string[], status: string): Promise<Employee[]> {
    const params = new URLSearchParams({ status })
    return this.request<Employee[]>(`/bulk-update-status?${params}`, {
      method: 'PUT',
      body: JSON.stringify(employeeIds),
    })
  }

  async bulkUpdateEmployeeDepartment(employeeIds: string[], department: string): Promise<Employee[]> {
    const params = new URLSearchParams({ department })
    return this.request<Employee[]>(`/bulk-update-department?${params}`, {
      method: 'PUT',
      body: JSON.stringify(employeeIds),
    })
  }

  // Additional validation endpoints

  async validateEmployeeId(employeeId: string): Promise<boolean> {
    return this.request<boolean>(`/validate/employee-id/${encodeURIComponent(employeeId)}`)
  }

  // Statistics endpoints
  async getEmployeeStatistics(): Promise<EmployeeStatistics> {
    return this.request<EmployeeStatistics>('/stats/overview')
  }

  // Cancel all pending requests
  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => {
      controller.abort()
    })
    this.abortControllers.clear()
    this.requestCache.clear()
  }
}

export const employeeApi = new EmployeeApiService()
