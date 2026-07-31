import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, Loader2, LogIn, LogOut, MapPin, RefreshCw, X } from 'lucide-react'
import type { GateInfo, GateAssignment, AssignedGate } from './types'

interface AgentCredentials {
  agent_id: string
  site_id: string
  tenant_id: string
  access_token: string
  refresh_token: string
  expires_at: number
  api_url: string
}

interface GateSettingsProps {
  credentials: AgentCredentials
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (assignment: GateAssignment) => void
}

export default function GateSettings({ credentials, open, onOpenChange, onSave }: GateSettingsProps) {
  const [gates, setGates] = useState<GateInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    loadData()
  }, [open])

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [fetchedGates, existingAssignment] = await Promise.all([
        invoke<GateInfo[]>('fetch_site_gates', {
          apiUrl: credentials.api_url,
          accessToken: credentials.access_token,
        }),
        invoke<GateAssignment>('load_gate_assignment').catch(() => null),
      ])

      setGates(fetchedGates)

      if (existingAssignment && existingAssignment.siteId === credentials.site_id) {
        setSelectedIds(new Set(existingAssignment.assignedGates.map(g => g.gateId)))
      } else {
        setSelectedIds(new Set())
      }
    } catch {
      setError('Không thể tải danh sách cổng. Kiểm tra kết nối rồi thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const toggleGate = (gateId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(gateId)) {
        next.delete(gateId)
      } else {
        next.add(gateId)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const assignedGates: AssignedGate[] = gates
        .filter(g => selectedIds.has(g.id))
        .map(g => ({ gateId: g.id, gateName: g.name, gateType: g.gateType }))

      const assignment: GateAssignment = {
        version: 1,
        siteId: credentials.site_id,
        assignedGates,
        updatedAt: new Date().toISOString(),
      }

      await invoke('save_gate_assignment', { assignment })
      onSave(assignment)
      onOpenChange(false)
    } catch {
      setError('Không thể lưu cài đặt. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const entranceGates = gates.filter(g => g.gateType === 'ENTRANCE')
  const exitGates = gates.filter(g => g.gateType === 'EXIT')
  const unclassifiedGates = gates.filter(g => !g.gateType)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[85vh] w-[calc(100vw-48px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl focus:outline-none">
          <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Cài đặt cổng</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Chọn cổng mà thiết bị này quản lý
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Đóng">
              <X className="size-5" />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách cổng...</span>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">{error}</p>
                  <button
                    type="button"
                    onClick={loadData}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive underline underline-offset-2"
                  >
                    <RefreshCw className="size-3.5" /> Thử lại
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && gates.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-medium">Chưa có cổng nào</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hãy thêm cổng trên website quản lý trước.
                </p>
              </div>
            )}

            {!loading && gates.length > 0 && (
              <div className="space-y-5">
                {entranceGates.length > 0 && (
                  <GateGroup
                    title="Cổng vào"
                    icon={<LogIn className="size-4 text-emerald-600" />}
                    gates={entranceGates}
                    selectedIds={selectedIds}
                    onToggle={toggleGate}
                  />
                )}
                {exitGates.length > 0 && (
                  <GateGroup
                    title="Cổng ra"
                    icon={<LogOut className="size-4 text-sky-600" />}
                    gates={exitGates}
                    selectedIds={selectedIds}
                    onToggle={toggleGate}
                  />
                )}
                {unclassifiedGates.length > 0 && (
                  <GateGroup
                    title="Chưa phân loại"
                    icon={<MapPin className="size-4 text-muted-foreground" />}
                    gates={unclassifiedGates}
                    selectedIds={selectedIds}
                    onToggle={toggleGate}
                  />
                )}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `Đã chọn ${selectedIds.size} cổng`
                : 'Chưa chọn cổng nào'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Lưu cài đặt
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function GateGroup({
  title,
  icon,
  gates,
  selectedIds,
  onToggle,
}: {
  title: string
  icon: React.ReactNode
  gates: GateInfo[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
        <span className="text-xs">({gates.length})</span>
      </div>
      <div className="space-y-1">
        {gates.map(gate => (
          <GateRow
            key={gate.id}
            gate={gate}
            selected={selectedIds.has(gate.id)}
            onToggle={() => onToggle(gate.id)}
          />
        ))}
      </div>
    </div>
  )
}

function GateRow({
  gate,
  selected,
  onToggle,
}: {
  gate: GateInfo
  selected: boolean
  onToggle: () => void
}) {
  const statusConfig = {
    online: { label: 'Online', color: 'bg-emerald-500' },
    offline: { label: 'Offline', color: 'bg-slate-400' },
    disabled: { label: 'Disabled', color: 'bg-red-500' },
  }
  const status = statusConfig[gate.status]

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-primary/50 bg-primary/5'
          : 'border-transparent bg-muted/40 hover:bg-muted/70'
      }`}
    >
      <div className={`grid size-5 shrink-0 place-items-center rounded border transition-colors ${
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background'
      }`}>
        {selected && <Check className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{gate.name}</span>
        {gate.location && (
          <span className="ml-2 truncate text-xs text-muted-foreground">{gate.location}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${status.color}`} />
        <span className="text-xs text-muted-foreground">{status.label}</span>
      </div>
    </button>
  )
}
