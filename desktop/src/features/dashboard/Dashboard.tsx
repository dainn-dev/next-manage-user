import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import CameraGrid from './CameraGrid'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
}

interface DashboardProps {
  credentials: AgentCredentials
}

interface AgentStatus {
  online: boolean
  version: string
  config_version: number
  workers: number
  queue_depth: number
}

export default function Dashboard({ credentials }: DashboardProps) {
  const [status, setStatus] = useState<AgentStatus | null>(null)

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [])

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
        <div className="container flex h-14 items-center">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Parking Site Agent</h1>
              <p className="text-xs text-muted-foreground">
                Agent ID: {credentials.agent_id.substring(0, 8)}...
              </p>
            </div>
            <div className="flex items-center gap-4">
              {status && (
                <>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{status.online ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    v{status.version} | Config: v{status.config_version}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Workers: {status.workers} | Queue: {status.queue_depth}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <CameraGrid />
      </main>
    </div>
  )
}
