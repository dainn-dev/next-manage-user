'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Clock3,
  Copy,
  Loader2,
  MonitorCog,
  Plus,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { AdminEmptyState, AdminPage, AdminPageHeader } from '@/components/layout/admin-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  generateEnrollmentCode,
  listAgents,
  revokeAgent,
  type AgentSummary,
  type EnrollmentCodeResponse,
} from '@/lib/api/agent-api'
import { useDashboardScope } from '@/lib/dashboard-scope-context'

export default function AgentsPage() {
  const { sites, selectedSiteId, isLoading: scopeLoading } = useDashboardScope()
  const { toast } = useToast()
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [selectedSiteId, sites],
  )

  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrollmentCode, setEnrollmentCode] = useState<EnrollmentCodeResponse | null>(null)
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [revokeDialogAgent, setRevokeDialogAgent] = useState<AgentSummary | null>(null)
  const [revoking, setRevoking] = useState(false)

  const loadAgents = useCallback(async () => {
    if (!selectedSiteId) {
      setAgents([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setAgents(await listAgents(selectedSiteId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách máy vận hành')
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  async function handleGenerateCode() {
    if (!selectedSiteId) return

    try {
      setGeneratingCode(true)
      setEnrollmentCode(await generateEnrollmentCode(selectedSiteId))
      setShowEnrollmentDialog(true)
    } catch (reason) {
      toast({
        title: 'Không thể tạo mã kích hoạt',
        description: reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingCode(false)
    }
  }

  async function handleRevoke() {
    if (!revokeDialogAgent || !selectedSiteId) return

    try {
      setRevoking(true)
      await revokeAgent(selectedSiteId, revokeDialogAgent.id)
      toast({
        title: 'Đã thu hồi quyền truy cập',
        description: `${revokeDialogAgent.name} không còn được kết nối với bãi xe này.`,
      })
      setRevokeDialogAgent(null)
      await loadAgents()
    } catch (reason) {
      toast({
        title: 'Không thể thu hồi quyền truy cập',
        description: reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
        variant: 'destructive',
      })
    } finally {
      setRevoking(false)
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    toast({ title: 'Đã sao chép mã kích hoạt' })
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Thiết bị tại bãi"
        title="Máy vận hành"
        description={selectedSite
          ? `Quản lý ứng dụng desktop kết nối camera tại ${selectedSite.name}.`
          : 'Quản lý ứng dụng desktop kết nối camera tại từng bãi xe.'}
        actions={(
          <Button onClick={() => void handleGenerateCode()} disabled={!selectedSiteId || generatingCode}>
            {generatingCode ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Thêm máy mới
          </Button>
        )}
      />

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Không thể tải danh sách máy vận hành</p>
                <p className="mt-0.5 text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => void loadAgents()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      {scopeLoading && !selectedSiteId ? (
        <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Đang tải bãi xe
        </div>
      ) : !selectedSiteId ? (
        <AdminEmptyState
          icon={<MonitorCog className="size-6" />}
          title="Chưa có bãi xe để quản lý"
          description="Cần tạo hoặc được cấp quyền vào một bãi xe trước khi thêm máy vận hành."
        />
      ) : loading && agents.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="min-h-48 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : agents.length === 0 && !error ? (
        <AdminEmptyState
          icon={<MonitorCog className="size-6" />}
          title="Chưa kết nối máy vận hành"
          description="Tạo mã kích hoạt một lần, sau đó nhập mã vào ứng dụng desktop tại bãi xe."
          action={(
            <Button onClick={() => void handleGenerateCode()} disabled={generatingCode}>
              <Plus className="mr-2 size-4" /> Thêm máy đầu tiên
            </Button>
          )}
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Danh sách máy vận hành">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onRevoke={() => setRevokeDialogAgent(agent)} />
          ))}
        </section>
      )}

      <Dialog open={showEnrollmentDialog} onOpenChange={setShowEnrollmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mã kích hoạt máy mới</DialogTitle>
            <DialogDescription>
              Nhập mã này vào ứng dụng desktop để kết nối máy với {selectedSite?.name ?? 'bãi xe'}.
            </DialogDescription>
          </DialogHeader>
          {enrollmentCode && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
                <div className="font-mono text-3xl font-bold tracking-[0.16em] text-foreground">
                  {enrollmentCode.code}
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock3 className="mt-0.5 size-4 shrink-0" />
                <p>
                  Mã chỉ dùng một lần và hết hạn lúc{' '}
                  {new Date(enrollmentCode.expiresAt).toLocaleString('vi-VN')}.
                </p>
              </div>
              <Button className="w-full" onClick={() => void copyToClipboard(enrollmentCode.code)}>
                <Copy className="mr-2 size-4" /> Sao chép mã
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(revokeDialogAgent)}
        onOpenChange={(open) => !open && setRevokeDialogAgent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi quyền truy cập?</AlertDialogTitle>
            <AlertDialogDescription>
              Máy <strong>{revokeDialogAgent?.name}</strong> sẽ mất kết nối và các camera do máy này vận hành sẽ dừng cập nhật. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevoke()}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 size-4 animate-spin" />}
              Thu hồi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}

function AgentCard({ agent, onRevoke }: { agent: AgentSummary; onRevoke: () => void }) {
  const status = agent.status.toUpperCase()
  const isOnline = status === 'ONLINE'
  const isRevoked = status === 'REVOKED'

  return (
    <Card className="overflow-hidden border-border bg-card shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{agent.name}</CardTitle>
            <CardDescription className="mt-1 truncate">
              {[agent.platform, agent.version].filter(Boolean).join(' · ') || 'Chưa nhận thông tin thiết bị'}
            </CardDescription>
          </div>
          <AgentStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Camera className="size-3.5" /> Camera được gán
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">{agent.camerasAssigned ?? 0}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />} Lần kết nối cuối
            </dt>
            <dd className="mt-1 font-medium">{formatLastSeen(agent.lastHeartbeatAt)}</dd>
          </div>
        </dl>
        {!isRevoked && (
          <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onRevoke}>
            Thu hồi quyền truy cập
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function AgentStatusBadge({ status }: { status: string }) {
  if (status === 'ONLINE') {
    return <Badge className="border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"><Wifi /> Trực tuyến</Badge>
  }
  if (status === 'REVOKED') return <Badge variant="destructive">Đã thu hồi</Badge>
  if (status === 'PROVISIONING') return <Badge variant="outline">Đang kích hoạt</Badge>
  return <Badge variant="secondary"><WifiOff /> Ngoại tuyến</Badge>
}

function formatLastSeen(lastHeartbeatAt?: string) {
  if (!lastHeartbeatAt) return 'Chưa kết nối'

  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(lastHeartbeatAt).getTime()) / 1000))
  if (diffSeconds < 60) return 'Vừa xong'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`
  return `${Math.floor(diffSeconds / 86400)} ngày trước`
}
