import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Label from '@/components/ui/label'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
}

interface EnrollmentScreenProps {
  onSuccess: (credentials: AgentCredentials) => void
}

export default function EnrollmentScreen({ onSuccess }: EnrollmentScreenProps) {
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [agentName, setAgentName] = useState('')
  const [apiUrl, setApiUrl] = useState('http://localhost:8080')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const credentials = await invoke<AgentCredentials>('enroll_agent', {
        enrollmentCode,
        name: agentName,
        apiUrl,
      })
      onSuccess(credentials)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Parking Site Agent</h1>
          <p className="mt-2 text-muted-foreground">
            Pair this device with your parking site
          </p>
        </div>

        <form onSubmit={handleEnroll} className="space-y-6 bg-card p-8 rounded-lg border">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">Backend URL</Label>
            <Input
              id="apiUrl"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8080"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input
              id="agentName"
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Entry-Exit Camera 01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enrollmentCode">Enrollment Code</Label>
            <Input
              id="enrollmentCode"
              type="text"
              value={enrollmentCode}
              onChange={(e) => setEnrollmentCode(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH"
              maxLength={9}
              required
              className="font-mono text-lg text-center tracking-wider"
            />
            <p className="text-sm text-muted-foreground">
              Get this code from the website under Site Settings → Agents
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Pairing...' : 'Pair Agent'}
          </Button>
        </form>
      </div>
    </div>
  )
}
