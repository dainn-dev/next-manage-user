import type { EntryExitRequest } from "@/lib/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api'

export interface EntryExitRequestApiResponse {
  content: EntryExitRequest[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface EntryExitRequestCreateRequest {
  employeeId: string
  employeeName: string
  vehicleId: string
  licensePlate: string
  requestType: "entry" | "exit"
  requestTime: string
  approvedBy?: string
  approvedAt?: string
  status: "pending" | "approved" | "rejected"
  notes?: string
}

export interface EntryExitRequestUpdateRequest extends EntryExitRequestCreateRequest {
  id: string
}

class EntryExitRequestApiService {
  private baseUrl = `${API_BASE_URL}/entry-exit-requests`

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

  // Get all requests with pagination
  async getAllRequests(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EntryExitRequestApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<EntryExitRequestApiResponse>(`?${params}`)
  }

  // Get all requests as list (no pagination)
  async getAllRequestsList(): Promise<EntryExitRequest[]> {
    return this.request<EntryExitRequest[]>('/list')
  }

  // Get request by ID
  async getRequestById(id: string): Promise<EntryExitRequest> {
    return this.request<EntryExitRequest>(`/${id}`)
  }

  // Get requests by employee
  async getRequestsByEmployee(employeeId: string): Promise<EntryExitRequest[]> {
    return this.request<EntryExitRequest[]>(`/employee/${employeeId}`)
  }

  // Get requests by vehicle
  async getRequestsByVehicle(vehicleId: string): Promise<EntryExitRequest[]> {
    return this.request<EntryExitRequest[]>(`/vehicle/${vehicleId}`)
  }

  // Get requests by type
  async getRequestsByType(requestType: string): Promise<EntryExitRequest[]> {
    return this.request<EntryExitRequest[]>(`/type/${requestType}`)
  }

  // Get requests by status
  async getRequestsByStatus(status: string): Promise<EntryExitRequest[]> {
    return this.request<EntryExitRequest[]>(`/status/${status}`)
  }

  // Search requests
  async searchRequests(
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EntryExitRequestApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<EntryExitRequestApiResponse>(`/search?${params}`)
  }

  // Search requests by type
  async searchRequestsByType(
    requestType: string,
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EntryExitRequestApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<EntryExitRequestApiResponse>(`/search/type/${requestType}?${params}`)
  }

  // Search requests by status
  async searchRequestsByStatus(
    status: string,
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<EntryExitRequestApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<EntryExitRequestApiResponse>(`/search/status/${status}?${params}`)
  }

  // Get requests by date range
  async getRequestsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<EntryExitRequest[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.request<EntryExitRequest[]>(`/date-range?${params}`)
  }

  // Get requests by employee and date range
  async getRequestsByEmployeeAndDateRange(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<EntryExitRequest[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.request<EntryExitRequest[]>(`/employee/${employeeId}/date-range?${params}`)
  }

  // Get requests by vehicle and date range
  async getRequestsByVehicleAndDateRange(
    vehicleId: string,
    startDate: string,
    endDate: string
  ): Promise<EntryExitRequest[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.request<EntryExitRequest[]>(`/vehicle/${vehicleId}/date-range?${params}`)
  }

  // Create request
  async createRequest(data: EntryExitRequestCreateRequest): Promise<EntryExitRequest> {
    return this.request<EntryExitRequest>('', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Update request
  async updateRequest(id: string, data: EntryExitRequestCreateRequest): Promise<EntryExitRequest> {
    return this.request<EntryExitRequest>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Approve request
  async approveRequest(id: string, approvedBy: string): Promise<EntryExitRequest> {
    const params = new URLSearchParams({
      approvedBy,
    })
    
    return this.request<EntryExitRequest>(`/${id}/approve?${params}`, {
      method: 'PUT',
    })
  }

  // Reject request
  async rejectRequest(id: string, approvedBy: string): Promise<EntryExitRequest> {
    const params = new URLSearchParams({
      approvedBy,
    })
    
    return this.request<EntryExitRequest>(`/${id}/reject?${params}`, {
      method: 'PUT',
    })
  }

  // Delete request
  async deleteRequest(id: string): Promise<void> {
    return this.request<void>(`/${id}`, {
      method: 'DELETE',
    })
  }

  // Get request count by status
  async getRequestCountByStatus(status: string): Promise<number> {
    return this.request<number>(`/stats/count/status/${status}`)
  }

  // Get request count by type
  async getRequestCountByType(requestType: string): Promise<number> {
    return this.request<number>(`/stats/count/type/${requestType}`)
  }

  // Get unique vehicle count in date range
  async getUniqueVehicleCountInDateRange(
    startDate: string,
    endDate: string
  ): Promise<number> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.request<number>(`/stats/unique-vehicles/date-range?${params}`)
  }

  // Get daily statistics
  async getDailyStats(
    startDate: string,
    endDate: string
  ): Promise<Array<[string, number]>> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.request<Array<[string, number]>>(`/stats/daily?${params}`)
  }
}

// Export singleton instance
export const entryExitRequestApi = new EntryExitRequestApiService()
