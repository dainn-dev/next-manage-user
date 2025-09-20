import type { Position } from '@/lib/types'
import { authApi } from "./auth-api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface PositionApiResponse {
  id: string
  name: string
  description?: string
  parentId?: string
  isActive: boolean
  displayOrder: number
  filterBy?: 'CO_QUAN_DON_VI' | 'CHUC_VU' | 'N_A'
  createdAt: string
  updatedAt: string
  parentName?: string
  childrenCount?: number
  children?: PositionApiResponse[]
}

export interface PositionCreateRequest {
  name: string
  description?: string
  parentId?: string
  isActive?: boolean
  displayOrder?: number
  filterBy?: 'CO_QUAN_DON_VI' | 'CHUC_VU' | 'N_A'
}

export interface PositionUpdateRequest extends PositionCreateRequest {
  id: string
}

export interface PositionStatistics {
  totalPositions: number
  activePositions: number
  inactivePositions: number
  rootPositions: number
  positionsByLevel: Record<string, number>
}

export interface PositionLevels {
  [key: string]: string
}

export class PositionApi {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/positions${endpoint}`
    
    const config: RequestInit = {
      headers: {
        ...authApi.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed: ${url}`, error)
      throw error
    }
  }

  // Get all positions as a list
  async getAllPositionsList(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/list')
  }

  // Get all active positions
  async getAllActivePositions(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/active')
  }

  // Get all positions with parent information
  async getPositionsWithParent(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/with-parent')
  }

  // Get position menu hierarchy for navigation
  async getPositionMenuHierarchy(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/menu')
  }

  // Get position by ID
  async getPositionById(id: string): Promise<PositionApiResponse> {
    return this.request<PositionApiResponse>(`/${id}`)
  }

  // Get position by name
  async getPositionByName(name: string): Promise<PositionApiResponse> {
    return this.request<PositionApiResponse>(`/name/${encodeURIComponent(name)}`)
  }

  // Create new position
  async createPosition(position: PositionCreateRequest): Promise<PositionApiResponse> {
    return this.request<PositionApiResponse>('', {
      method: 'POST',
      body: JSON.stringify(position),
    })
  }

  // Update position
  async updatePosition(id: string, position: PositionUpdateRequest): Promise<PositionApiResponse> {
    return this.request<PositionApiResponse>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(position),
    })
  }

  // Delete position
  async deletePosition(id: string): Promise<void> {
    await this.request<void>(`/${id}`, {
      method: 'DELETE',
    })
  }

  // Search positions
  async searchPositions(
    searchTerm: string,
    page: number = 0,
    size: number = 10
  ): Promise<{
    content: PositionApiResponse[]
    totalElements: number
    totalPages: number
    size: number
    number: number
  }> {
    const params = new URLSearchParams({
      q: searchTerm,
      page: page.toString(),
      size: size.toString(),
    })
    return this.request(`/search?${params}`)
  }

  // Get positions by level
  async getPositionsByLevel(level: string): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>(`/level/${level}`)
  }

  // Get root positions
  async getRootPositions(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/root')
  }

  // Get child positions
  async getChildPositions(parentId: string): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>(`/${parentId}/children`)
  }

  // Get positions with filters
  async getPositionsWithFilters(
    level?: string,
    parentId?: string,
    page: number = 0,
    size: number = 10,
    leafOnly: boolean = false
  ): Promise<{
    content: PositionApiResponse[]
    totalElements: number
    totalPages: number
    size: number
    number: number
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      leafOnly: leafOnly.toString(),
    })
    
    if (level) params.append('level', level)
    if (parentId) params.append('parentId', parentId)
    
    return this.request(`/filter?${params}`)
  }

  // Get position statistics
  async getPositionStatistics(): Promise<PositionStatistics> {
    return this.request<PositionStatistics>('/statistics')
  }

  // Bulk delete positions
  async bulkDeletePositions(positionIds: string[]): Promise<void> {
    await this.request<void>('/bulk', {
      method: 'DELETE',
      body: JSON.stringify(positionIds),
    })
  }

  // Move position
  async movePosition(id: string, parentId?: string): Promise<PositionApiResponse> {
    const params = new URLSearchParams()
    if (parentId) params.append('parentId', parentId)
    
    return this.request<PositionApiResponse>(`/${id}/move?${params}`, {
      method: 'PUT',
    })
  }

  // Get available position levels
  async getPositionLevels(): Promise<PositionLevels> {
    return this.request<PositionLevels>('/levels')
  }

  // Get positions with CHUC_VU filter and optional parentId
  async getChucVuPositions(parentId?: string): Promise<PositionApiResponse[]> {
    const params = new URLSearchParams()
    if (parentId) params.append('parentId', parentId)
    
    const endpoint = params.toString() ? `/filter/chuc-vu?${params}` : '/filter/chuc-vu'
    return this.request<PositionApiResponse[]>(endpoint)
  }

  // Get positions by filter type and optional parentId
  async getPositionsByFilter(
    filterBy: 'CO_QUAN_DON_VI' | 'CHUC_VU' | 'N_A',
    parentId?: string
  ): Promise<PositionApiResponse[]> {
    const params = new URLSearchParams({
      filterBy: filterBy
    })
    if (parentId) params.append('parentId', parentId)
    
    return this.request<PositionApiResponse[]>(`/filter/by-type?${params}`)
  }

  // Get leaf positions (positions without children) under a parent
  async getLeafPositions(parentId?: string): Promise<PositionApiResponse[]> {
    const response = await this.getPositionsWithFilters(undefined, parentId, 0, 1000, true)
    return response.content
  }

  // Get all leaf positions (positions without children) across the entire system
  async getAllLeafPositions(): Promise<PositionApiResponse[]> {
    return this.request<PositionApiResponse[]>('/leaf')
  }

  // Convert API response to frontend Position type
  convertToPosition(apiResponse: PositionApiResponse): Position {
    return {
      id: apiResponse.id,
      name: apiResponse.name,
      description: apiResponse.description || '',
      parentId: apiResponse.parentId || undefined,
      isActive: apiResponse.isActive,
      displayOrder: apiResponse.displayOrder,
      filterBy: apiResponse.filterBy || 'N_A',
      createdAt: apiResponse.createdAt,
      updatedAt: apiResponse.updatedAt,
      parentName: apiResponse.parentName,
      childrenCount: apiResponse.childrenCount || 0,
    }
  }

  // Convert frontend Position to API request
  convertToApiRequest(position: Position): PositionCreateRequest {
    return {
      name: position.name,
      description: position.description || undefined,
      parentId: position.parentId || undefined,
      isActive: position.isActive,
      displayOrder: position.displayOrder,
      filterBy: position.filterBy || 'N_A',
    }
  }
}

// Export singleton instance
export const positionApi = new PositionApi()