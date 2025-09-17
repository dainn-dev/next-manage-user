const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface DepartmentApiResponse {
  content: Department[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface DepartmentCreateRequest {
  name: string
  description?: string
  parentId?: string
  managerId?: string
}

export interface DepartmentUpdateRequest {
  name: string
  description?: string
  parentId?: string
  managerId?: string
}

export interface Department {
  id: string
  name: string
  description?: string
  parentId?: string
  managerId?: string
  employeeCount: number
  createdAt: string
  updatedAt: string
}

export interface DepartmentStatistics {
  totalDepartments: number
  totalEmployees: number
  averageEmployeesPerDepartment: number
  largestDepartment: {
    id: string
    name: string
    employeeCount: number
  }
  departmentHierarchy: {
    parentDepartments: number
    childDepartments: number
    maxDepth: number
  }
}

class DepartmentApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
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
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Department API Error [${endpoint}]:`, error)
      throw error
    }
  }

  /**
   * Get all departments with pagination
   */
  async getAllDepartments(page: number = 0, size: number = 20, sortBy: string = 'name', sortDir: string = 'asc'): Promise<DepartmentApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir
    })
    return this.request<DepartmentApiResponse>(`/departments?${params}`)
  }

  /**
   * Get all departments as a simple list (no pagination)
   */
  async getAllDepartmentsList(): Promise<Department[]> {
    return this.request<Department[]>('/departments/list')
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(id: string): Promise<Department> {
    return this.request<Department>(`/departments/${id}`)
  }

  /**
   * Create new department
   */
  async createDepartment(departmentData: DepartmentCreateRequest): Promise<Department> {
    return this.request<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(departmentData),
    })
  }

  /**
   * Update existing department
   */
  async updateDepartment(id: string, departmentData: DepartmentUpdateRequest): Promise<Department> {
    return this.request<Department>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(departmentData),
    })
  }

  /**
   * Delete department
   */
  async deleteDepartment(id: string): Promise<void> {
    return this.request<void>(`/departments/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get departments by parent ID
   */
  async getDepartmentsByParentId(parentId: string): Promise<Department[]> {
    return this.request<Department[]>(`/departments/parent/${parentId}`)
  }

  /**
   * Get root departments (no parent)
   */
  async getRootDepartments(): Promise<Department[]> {
    return this.request<Department[]>('/departments/root')
  }

  /**
   * Search departments by name
   */
  async searchDepartments(query: string): Promise<Department[]> {
    const params = new URLSearchParams({ query })
    return this.request<Department[]>(`/departments/search?${params}`)
  }

  /**
   * Get department hierarchy
   */
  async getDepartmentHierarchy(): Promise<Department[]> {
    return this.request<Department[]>('/departments/hierarchy')
  }

  /**
   * Get department statistics
   */
  async getDepartmentStatistics(): Promise<DepartmentStatistics> {
    return this.request<DepartmentStatistics>('/departments/statistics')
  }

  /**
   * Get employees in a department
   */
  async getDepartmentEmployees(departmentId: string): Promise<any[]> {
    return this.request<any[]>(`/departments/${departmentId}/employees`)
  }

  /**
   * Bulk delete departments
   */
  async bulkDeleteDepartments(departmentIds: string[]): Promise<void> {
    return this.request<void>('/departments/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ departmentIds }),
    })
  }

  /**
   * Check if department name exists
   */
  async checkDepartmentNameExists(name: string, excludeId?: string): Promise<boolean> {
    const params = new URLSearchParams({ name })
    if (excludeId) {
      params.append('excludeId', excludeId)
    }
    return this.request<boolean>(`/departments/exists/name?${params}`)
  }

  /**
   * Validate department ID
   */
  async validateDepartmentId(id: string): Promise<boolean> {
    try {
      await this.getDepartmentById(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Move department to new parent
   */
  async moveDepartment(departmentId: string, newParentId?: string): Promise<Department> {
    return this.request<Department>(`/departments/${departmentId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: newParentId }),
    })
  }

  /**
   * Update department manager
   */
  async updateDepartmentManager(departmentId: string, managerId?: string): Promise<Department> {
    return this.request<Department>(`/departments/${departmentId}/manager`, {
      method: 'PATCH',
      body: JSON.stringify({ managerId }),
    })
  }
}

export const departmentApi = new DepartmentApi()
