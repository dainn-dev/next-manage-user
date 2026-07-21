'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { useToast } from '@/hooks/use-toast'
import {
  generateEnrollmentCode,
  listAgents,
  revokeAgent,
  type AgentSummary,
  type EnrollmentCodeResponse,
} from '@/lib/api/agent-api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function AgentsPage() {
  const { token } = useAuth()
  const { selectedSite } = useDashboardScope()
  const { toast } = useToast()

  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollmentCode, setEnrollmentCode] = useState<EnrollmentCodeResponse | null>(null)
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [revokeDialogAgent, setRevokeDialogAgent] = useState<AgentSummary | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    if (selectedSite && token) {
      loadAgents()
    }
  }, [selectedSite, token])

  async function loadAgents() {
    if (!selectedSite || !token) return

    try {
      setLoading(true)
      const data = await listAgents(selectedSite.id, token)
      setAgents(data)
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách máy vận hành',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateCode() {
    if (!selectedSite || !token) return

    try {
      setGeneratingCode(true)
      const code = await generateEnrollmentCode(selectedSite.id, token)
      setEnrollmentCode(code)
      setShowEnrollmentDialog(true)
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tạo mã kích hoạt',
        variant: 'destructive',
      })
    } finally {
      setGeneratingCode(false)
    }
  }

  async function handleRevoke() {
    if (!revokeDialogAgent || !token) return

    try {
      setRevoking(true)
      await revokeAgent(revokeDialogAgent.id, token)
      toast({
        title: 'Thành công',
        description: `Đã thu hồi quyền truy cập của ${revokeDialogAgent.name}`,
      })
      setRevokeDialogAgent(null)
      loadAgents()
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể thu hồi quyền truy cập',
        variant: 'destructive',
      })
    } finally {
      setRevoking(false)
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500">Đang hoạt động</Badge>
      case 'offline':
        return <Badge variant="secondary">Ngoại tuyến</Badge>
      case 'revoked':
        return <Badge variant="destructive">Đã thu hồi</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function formatLastSeen(lastHeartbeatAt?: string) {
    if (!lastHeartbeatAt) return 'Chưa kết nối'

    const date = new Date(lastHeartbeatAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)

    if (diffSecs < 60) return `${diffSecs} giây trước`
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} phút trước`
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} giờ trước`
    return `${Math.floor(diffSecs / 86400)} ngày trước`
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Đã sao chép',
      description: 'Mã kích hoạt đã được sao chép vào clipboard',
    })
  }

  if (!selectedSite) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Vui lòng chọn bãi xe để xem máy vận hành
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Máy vận hành</h1>
          <p className="text-muted-foreground">
            Quản lý các máy desktop tại bãi xe
          </p>
        </div>
        <Button onClick={handleGenerateCode} disabled={generatingCode}>
          {generatingCode ? 'Đang tạo...' : 'Thêm máy mới'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Đang tải...
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Chưa có máy vận hành nào được kết nối
            </p>
            <Button onClick={handleGenerateCode} disabled={generatingCode}>
              Thêm máy đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {agent.platform || 'Unknown platform'} • {agent.version || 'v0.1.0'}
                    </CardDescription>
                  </div>
                  {getStatusBadge(agent.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Camera:</span>
                  <span className="font-medium">
                    {agent.onlineCameraCount}/{agent.cameraCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hoạt động:</span>
                  <span>{formatLastSeen(agent.lastHeartbeatAt)}</span>
                </div>
                {agent.status !== 'revoked' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setRevokeDialogAgent(agent)}
                  >
                    Thu hồi quyền
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Enrollment Code Dialog */}
      <Dialog open={showEnrollmentDialog} onOpenChange={setShowEnrollmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mã kích hoạt máy mới</DialogTitle>
            <DialogDescription>
              Nhập mã này vào ứng dụng desktop để kết nối với hệ thống
            </DialogDescription>
          </DialogHeader>
          {enrollmentCode && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <div className="text-3xl font-mono font-bold tracking-wider">
                  {enrollmentCode.code}
                </div>
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Mã có hiệu lực đến{' '}
                {new Date(enrollmentCode.expiresAt).toLocaleString('vi-VN')}
              </div>
              <Button
                className="w-full"
                onClick={() => copyToClipboard(enrollmentCode.code)}
              >
                Sao chép mã
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={!!revokeDialogAgent}
        onOpenChange={(open) => !open && setRevokeDialogAgent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi quyền truy cập?</AlertDialogTitle>
            <AlertDialogDescription>
              Máy <strong>{revokeDialogAgent?.name}</strong> sẽ mất quyền truy cập vào hệ thống.
              Các camera đang hoạt động sẽ bị dừng. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? 'Đang xử lý...' : 'Thu hồi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
