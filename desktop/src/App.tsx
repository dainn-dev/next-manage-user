import { useCallback, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import EnrollmentScreen from './features/enrollment/EnrollmentScreen'
import Dashboard from './features/dashboard/Dashboard'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
  api_url: string
}

function App() {
  const [credentials, setCredentials] = useState<AgentCredentials | null>(null)
  const [loading, setLoading] = useState(true)
  const [authNotice, setAuthNotice] = useState('')
  const [startupError, setStartupError] = useState('')

  useEffect(() => {
    checkCredentials()
  }, [])

  const checkCredentials = async () => {
    setStartupError('')
    try {
      const creds = await invoke<AgentCredentials>('check_credentials')
      setCredentials(creds)
      setAuthNotice('')
    } catch (error) {
      const message = String(error)
      setCredentials(null)
      if (message.includes('AUTH_REVOKED')) {
        setAuthNotice('Thiết bị này đã bị thu hồi quyền trên website. Vui lòng dùng mã kích hoạt mới để kết nối lại.')
      } else if (message.includes('AUTH_INVALID')) {
        setAuthNotice('Phiên xác thực của thiết bị không còn hợp lệ. Vui lòng dùng mã kích hoạt mới.')
      } else if (!message.includes('NO_CREDENTIALS')) {
        setStartupError('Không thể xác minh quyền thiết bị với backend. Kiểm tra kết nối rồi thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollmentSuccess = (creds: AgentCredentials) => {
    setCredentials(creds)
    setAuthNotice('')
  }

  const handleAuthorizationLost = useCallback((reason: string) => {
    setCredentials(null)
    setAuthNotice(reason)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Checking authentication</p>
        </div>
      </div>
    )
  }

  if (startupError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-semibold">Không thể xác minh thiết bị</h2>
          <p className="mt-2 text-sm text-muted-foreground">{startupError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void checkCredentials()
            }}
            className="mt-5 h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if (!credentials) {
    return <EnrollmentScreen onSuccess={handleEnrollmentSuccess} notice={authNotice} />
  }

  return <Dashboard credentials={credentials} onAuthorizationLost={handleAuthorizationLost} />
}

export default App
