const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: string[]
  importedRequests: any[]
}

class EntryExitRequestExcelApiService {
  private baseUrl = `${API_BASE_URL}/entry-exit-requests`

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, defaultOptions)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
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

  private async downloadFile(
    endpoint: string,
    filename: string,
    options: RequestInit = {}
  ): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error(`Download failed for ${endpoint}:`, error)
      throw error
    }
  }

  // Export all requests to Excel
  async exportAllToExcel(): Promise<void> {
    return this.downloadFile('/export/excel', 'entry_exit_requests.xlsx', {
      method: 'POST',
    })
  }

  // Export requests by status to Excel
  async exportByStatusToExcel(status: 'pending' | 'approved' | 'rejected' | 'completed'): Promise<void> {
    return this.downloadFile(`/export/excel/status/${status}`, `entry_exit_requests_${status}.xlsx`, {
      method: 'POST',
    })
  }

  // Export requests by date range to Excel
  async exportByDateRangeToExcel(startDate: string, endDate: string): Promise<void> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    
    return this.downloadFile(`/export/excel/date-range?${params}`, `entry_exit_requests_${startDate}_to_${endDate}.xlsx`, {
      method: 'POST',
    })
  }

  // Import requests from Excel
  async importFromExcel(file: File): Promise<ImportResult> {
    const formData = new FormData()
    formData.append('file', file)

    return this.request<ImportResult>('/import/excel', {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    })
  }

  // Download Excel template
  async downloadTemplate(): Promise<void> {
    return this.downloadFile('/template/excel', 'entry_exit_requests_template.xlsx', {
      method: 'GET',
    })
  }
}

export const entryExitRequestExcelApi = new EntryExitRequestExcelApiService()
