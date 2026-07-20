import { getApiUrl } from './config'

export interface PublicRegistrationRequest {
  organizationName: string
  managementModel: string
  areaCount: number
  username: string
  email: string
  password: string
}

export interface PublicRegistrationResponse {
  tenantId: string
  tenantName: string
  managementModel: string
  areaCount: number
  userId: string
  username: string
  email: string
  role: string
  token: string
  tokenType: string
  expiresAt: string
}

export class RegistrationApiError extends Error {
  fieldErrors?: Record<string, string>

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'RegistrationApiError'
    this.fieldErrors = fieldErrors
  }
}

class RegistrationApi {
  async register(request: PublicRegistrationRequest): Promise<PublicRegistrationResponse> {
    const response = await fetch(`${getApiUrl()}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new RegistrationApiError(
        errorData.message || 'Không thể tạo tài khoản',
        errorData.fieldErrors,
      )
    }

    return response.json()
  }
}

export const registrationApi = new RegistrationApi()
