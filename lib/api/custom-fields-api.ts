import type { CustomField } from "@/lib/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api'

export interface CustomFieldApiResponse {
  content: CustomField[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface CustomFieldCreateRequest {
  name: string
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea"
  options?: string[]
  required: boolean
  category: string
  order: number
  description?: string
  defaultValue?: string
  validationRules?: string
  isActive?: boolean
}

export interface CustomFieldUpdateRequest extends CustomFieldCreateRequest {
  id: string
}

class CustomFieldsApiService {
  private baseUrl = `${API_BASE_URL}/api/custom-fields`

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

  // Get all custom fields with pagination
  async getAllCustomFields(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'order',
    sortDir: string = 'asc'
  ): Promise<CustomFieldApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<CustomFieldApiResponse>(`?${params}`)
  }

  // Get all custom fields as list (no pagination)
  async getAllCustomFieldsList(): Promise<CustomField[]> {
    return this.request<CustomField[]>('/list')
  }

  // Get all active custom fields
  async getActiveCustomFields(): Promise<CustomField[]> {
    return this.request<CustomField[]>('/active')
  }

  // Get active custom fields with pagination
  async getActiveCustomFieldsPaginated(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'order',
    sortDir: string = 'asc'
  ): Promise<CustomFieldApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<CustomFieldApiResponse>(`/active/paginated?${params}`)
  }

  // Get custom field by ID
  async getCustomFieldById(id: string): Promise<CustomField> {
    return this.request<CustomField>(`/${id}`)
  }

  // Get custom fields by category
  async getCustomFieldsByCategory(category: string): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/category/${encodeURIComponent(category)}`)
  }

  // Get active custom fields by category
  async getActiveCustomFieldsByCategory(category: string): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/category/${encodeURIComponent(category)}/active`)
  }

  // Get custom fields by type
  async getCustomFieldsByType(type: string): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/type/${type}`)
  }

  // Get active custom fields by type
  async getActiveCustomFieldsByType(type: string): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/type/${type}/active`)
  }

  // Get custom fields by required flag
  async getCustomFieldsByRequired(required: boolean): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/required/${required}`)
  }

  // Get active custom fields by required flag
  async getActiveCustomFieldsByRequired(required: boolean): Promise<CustomField[]> {
    return this.request<CustomField[]>(`/required/${required}/active`)
  }

  // Search custom fields
  async searchCustomFields(
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'order',
    sortDir: string = 'asc'
  ): Promise<CustomFieldApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<CustomFieldApiResponse>(`/search?${params}`)
  }

  // Create custom field
  async createCustomField(data: CustomFieldCreateRequest): Promise<CustomField> {
    return this.request<CustomField>('', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Update custom field
  async updateCustomField(id: string, data: CustomFieldCreateRequest): Promise<CustomField> {
    return this.request<CustomField>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Delete custom field
  async deleteCustomField(id: string): Promise<void> {
    return this.request<void>(`/${id}`, {
      method: 'DELETE',
    })
  }

  // Toggle custom field status
  async toggleCustomFieldStatus(id: string): Promise<CustomField> {
    return this.request<CustomField>(`/${id}/toggle-status`, {
      method: 'PATCH',
    })
  }

  // Reorder custom fields
  async reorderCustomFields(fieldIds: string[]): Promise<CustomField[]> {
    return this.request<CustomField[]>('/reorder', {
      method: 'PUT',
      body: JSON.stringify(fieldIds),
    })
  }

  // Get all categories
  async getAllCategories(): Promise<string[]> {
    return this.request<string[]>('/categories')
  }

  // Get active categories
  async getActiveCategories(): Promise<string[]> {
    return this.request<string[]>('/categories/active')
  }

  // Get statistics by category
  async getStatisticsByCategory(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/category')
  }

  // Get active statistics by category
  async getActiveStatisticsByCategory(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/category/active')
  }

  // Get statistics by type
  async getStatisticsByType(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/type')
  }

  // Get active statistics by type
  async getActiveStatisticsByType(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/type/active')
  }

  // Check if custom field name exists
  async existsByName(name: string): Promise<boolean> {
    return this.request<boolean>(`/exists/name/${encodeURIComponent(name)}`)
  }

  // Check if custom field name exists (excluding ID)
  async existsByNameAndIdNot(name: string, id: string): Promise<boolean> {
    return this.request<boolean>(`/exists/name/${encodeURIComponent(name)}/exclude/${id}`)
  }
}

// Export singleton instance
export const customFieldsApi = new CustomFieldsApiService()
