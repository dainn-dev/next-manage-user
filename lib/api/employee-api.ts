import type { Employee } from "@/lib/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api'

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
  firstName: string
  lastName: string
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
  cardNumber?: string
  emergencyContact?: string
  emergencyPhone?: string
  salary?: number
  permissions?: string[]
  notes?: string
}

export interface EmployeeUpdateRequest extends EmployeeCreateRequest {
  id: string
}

class EmployeeApiService {
  private baseUrl = `${API_BASE_URL}/employees`

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

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
      console.error(`API request failed for ${endpoint}:`, error)
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
}

export const employeeApi = new EmployeeApiService()
