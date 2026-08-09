import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import CameraGrid from './CameraGrid'
import UpdateButton from '../update/UpdateButton'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
  api_url: string
}

interface DashboardProps {
  credentials: AgentCredentials
  onAuthorizationLost: (reason: string) => void
}

interface AgentStatus {
  online: boolean
  version: string
  config_version: number
  workers: number
  queue_depth: number
  last_error?: string | null
}

export default function Dashboard({ credentials, onAuthorizationLost }: DashboardProps) {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [backendReachable, setBackendReachable] = useState(true)

  useEffect(() => {
    void invoke('start_health_reporter').catch((error) => {
      console.error('Failed to start health reporter:', error)
    })
    loadStatus()
    const interval = setInterval(loadStatus, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const validateAuthorization = async () => {
      try {
        await invoke<AgentCredentials>('check_credentials')
        setBackendReachable(true)
      } catch (error) {
        const message = String(error)
        if (message.includes('AUTH_REVOKED')) {
          onAuthorizationLost('Thiết bị này đã bị thu hồi quyền trên website. Vui lòng dùng mã kích hoạt mới để kết nối lại.')
        } else if (message.includes('AUTH_INVALID') || message.includes('NO_CREDENTIALS')) {
          onAuthorizationLost('Phiên xác thực của thiết bị không còn hợp lệ. Vui lòng dùng mã kích hoạt mới.')
        } else {
          setBackendReachable(false)
        }
      }
    }

    const interval = window.setInterval(() => void validateAuthorization(), 15000)
    return () => window.clearInterval(interval)
  }, [onAuthorizationLost])

  const loadStatus = async () => {
    try {
      const agentStatus = await invoke<AgentStatus>('get_agent_status')
      setStatus(agentStatus)
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 w-full items-center px-3 sm:px-4 lg:px-5">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Parking Site Agent</h1>
              <p className="text-xs text-muted-foreground">
                Agent ID: {credentials.agent_id.substring(0, 8)}...
              </p>
            </div>
            <div className="flex items-center gap-4">
              <UpdateButton />
              {status && (
                <>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${status.online && backendReachable ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{status.online && backendReachable ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    v{status.version} | Config: v{status.config_version}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Workers: {status.workers} | Queue: {status.queue_depth}
                  </div>
                  {status.last_error && (
                    <div className="max-w-xs truncate text-xs text-red-500" title={status.last_error}>
                      HB: {status.last_error}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-3 py-4 sm:px-4 lg:px-5">
        <CameraGrid />
      </main>
    </div>
  )
}
