import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import EnrollmentScreen from './features/enrollment/EnrollmentScreen'
import Dashboard from './features/dashboard/Dashboard'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
}

function App() {
  const [credentials, setCredentials] = useState<AgentCredentials | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkCredentials()
  }, [])

  const checkCredentials = async () => {
    try {
      const creds = await invoke<AgentCredentials>('check_credentials')
      setCredentials(creds)
    } catch (error) {
      console.log('No credentials found')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollmentSuccess = (creds: AgentCredentials) => {
    setCredentials(creds)
  }

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

  if (!credentials) {
    return <EnrollmentScreen onSuccess={handleEnrollmentSuccess} />
  }

  return <Dashboard credentials={credentials} />
}

export default App
