"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  Clock3,
  DoorOpen,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { ErrorBoundary } from "@/components/error-boundary"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { GateFormDialog, type GateFormValues } from "@/components/gates/gate-form-dialog"
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { gateApi, isGateOnline, type Gate } from "@/lib/api/gate-api"

const REFRESH_INTERVAL_MS = 30000

function GateList() {
  const { selectedSiteId } = useDashboardScope()
  const { toast } = useToast()
  const [gates, setGates] = useState<Gate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editingGate, setEditingGate] = useState<Gate | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Gate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gateApi.getGates()
      setGates(data)
      setError(null)
    } catch {
      setError(
        "Không thể tải danh sách cổng. Bạn cần quyền quản trị (ADMIN) để xem trang này.",
      )
    } finally {
      setLoading(false)
      setNow(Date.now())
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      load()
    }, REFRESH_INTERVAL_MS)
    const tick = setInterval(() => setNow(Date.now()), 15000)
    return () => {
      clearInterval(id)
      clearInterval(tick)
    }
  }, [load])

  const onlineCount = gates.filter((gate) => isGateOnline(gate, now)).length
  const gateOverviewMetrics = [
    {
      label: "Tổng số cổng",
      value: gates.length.toLocaleString("vi-VN"),
      note: "Đã đăng ký trong hệ thống",
      icon: DoorOpen,
      tone: "primary",
    },
    {
      label: "Cổng trực tuyến",
      value: onlineCount.toLocaleString("vi-VN"),
      note: "Có nhịp tim gần đây",
      icon: Radio,
      tone: "success",
    },
    {
      label: "Cần chú ý",
      value: (gates.length - onlineCount).toLocaleString("vi-VN"),
      note: "Ngoại tuyến hoặc vô hiệu",
      icon: Activity,
      tone: "critical",
    },
  ] as const

  function openCreate() {
    setFormMode("create")
    setEditingGate(null)
    setFormOpen(true)
  }

  function openEdit(gate: Gate) {
    setFormMode("edit")
    setEditingGate(gate)
    setFormOpen(true)
  }

  async function handleSubmit(values: GateFormValues) {
    setSubmitting(true)
    try {
      if (formMode === "create") {
        if (!selectedSiteId) {
          throw new Error("Chưa chọn cơ sở vận hành.")
        }
        await gateApi.createGate({
          siteId: selectedSiteId,
          name: values.name,
          location: values.location,
          cameraRtspUrl: values.cameraRtspUrl,
          status: values.status,
        })
        toast({
          title: "Đã tạo cổng",
          description: `${values.name} đã được thêm vào hệ thống.`,
        })
      } else if (editingGate) {
        await gateApi.updateGate(editingGate.id, {
          name: values.name,
          location: values.location,
          cameraRtspUrl: values.cameraRtspUrl,
          status: values.status,
        })
        toast({
          title: "Đã cập nhật cổng",
          description: `${values.name} đã được lưu.`,
        })
      }
      setFormOpen(false)
      await load()
    } catch (reason) {
      toast({
        title: formMode === "create" ? "Không thể tạo cổng" : "Không thể cập nhật cổng",
        description: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await gateApi.deleteGate(deleteTarget.id)
      toast({
        title: "Đã xoá cổng",
        description: `${deleteTarget.name} đã được gỡ khỏi hệ thống.`,
      })
      setDeleteTarget(null)
      await load()
    } catch (reason) {
      toast({
        title: "Không thể xoá cổng",
        description: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AdminPage className="min-h-dvh space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Cổng kiểm soát"
        description="Quản lý cổng, mở kiosk giám sát và điều phối lượt xe ra vào."
        actionList={[
          {
            key: "create",
            content: (
              <Button
                onClick={openCreate}
                disabled={!selectedSiteId}
                className="min-h-11 w-full sm:w-auto"
              >
                <Plus className="size-4" />
                Thêm cổng
              </Button>
            ),
          },
          {
            key: "refresh",
            content: (
              <Button
                variant="outline"
                onClick={load}
                disabled={loading}
                className="min-h-11 w-full sm:w-auto"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            ),
          },
        ]}
      />

      {!selectedSiteId && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          role="status"
        >
          Chưa có cơ sở vận hành để tạo cổng mới. Bạn vẫn có thể xem / sửa / xoá các cổng đã có.
        </div>
      )}

      <DashboardMetricsSection
        id="gate-overview-title"
        title="Tổng quan cổng"
        description="Theo dõi số lượng cổng, trạng thái trực tuyến và các kiosk cần xử lý."
        badge={(
          <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary-container text-on-primary-container">
            <Radio className="size-3" aria-hidden="true" />
            Theo nhịp tim cổng
          </Badge>
        )}
        meta={(
          <time className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" dateTime={new Date(now).toISOString()}>
            <Clock3 className="size-3.5" aria-hidden="true" />
            Cập nhật {new Date(now).toLocaleTimeString("vi-VN")}
          </time>
        )}
        loading={loading && gates.length === 0}
        metricGridClassName="sm:grid-cols-3"
        metrics={gateOverviewMetrics}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800" role="alert">
          {error}
        </div>
      )}

      {loading && gates.length === 0 && !error && (
        <AdminEmptyState
          className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
          icon={<RefreshCw className="size-5 animate-spin" />}
          title="Đang tải danh sách cổng"
          description="Hệ thống đang cập nhật trạng thái mới nhất của các kiosk."
        />
      )}

      {!loading && gates.length === 0 && !error && (
        <AdminEmptyState
          className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
          icon={<DoorOpen className="size-6" />}
          title="Chưa có cổng kiểm soát"
          description="Chưa có cổng nào được đăng ký vào hệ thống."
          action={(
            <Button onClick={openCreate} disabled={!selectedSiteId}>
              <Plus className="size-4" />
              Thêm cổng đầu tiên
            </Button>
          )}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Danh sách cổng">
        {gates.map((gate) => {
          const online = isGateOnline(gate, now)
          const statusLabel = online ? "Trực tuyến" : gate.status === "disabled" ? "Vô hiệu" : "Ngoại tuyến"
          const statusClasses = online
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : gate.status === "disabled"
              ? "border-slate-200 bg-slate-50 text-slate-600"
              : "border-rose-200 bg-rose-50 text-rose-700"
          const iconClasses = online
            ? "bg-emerald-100 text-emerald-700"
            : gate.status === "disabled"
              ? "bg-slate-100 text-slate-600"
              : "bg-rose-100 text-rose-700"

          return (
            <Card key={gate.id} className="border-border bg-card shadow-none transition-shadow hover:shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full flex-col gap-5 p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${iconClasses}`}>
                      <Radio className={`size-5 ${online ? "animate-pulse" : ""}`} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{gate.name}</h2>
                      {gate.location ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{gate.location}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Chưa có vị trí</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${statusClasses}`}>
                    <span className={`mr-1.5 size-1.5 rounded-full ${online ? "bg-emerald-500" : gate.status === "disabled" ? "bg-slate-400" : "bg-rose-500"}`} />
                    {statusLabel}
                  </Badge>
                </div>

                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock3 className="size-4 text-primary" aria-hidden="true" />
                    Lần đồng bộ gần nhất
                  </div>
                  <p className="mt-1.5 break-words text-sm text-foreground">
                    {gate.lastHeartbeatAt
                      ? new Date(gate.lastHeartbeatAt).toLocaleString("vi-VN")
                      : "Chưa nhận được nhịp tim"}
                  </p>
                </div>

                <div className="mt-auto grid gap-2">
                  <Link href={`/gate/${gate.id}`} className="block w-full">
                    <Button className="min-h-11 w-full" variant="outline">
                      <Monitor className="size-4 text-primary" />
                      Mở kiosk giám sát
                    </Button>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => openEdit(gate)}
                    >
                      <Pencil className="size-4" />
                      Sửa
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() => setDeleteTarget(gate)}
                    >
                      <Trash2 className="size-4" />
                      Xoá
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <GateFormDialog
        open={formOpen}
        mode={formMode}
        gate={editingGate}
        submitting={submitting}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cổng?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Bạn sắp xoá “${deleteTarget.name}”. Camera và lịch sử kiểm soát gắn cổng này sẽ giữ lại nhưng mất liên kết cổng.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? "Đang xoá…" : "Xoá cổng"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}

export default function GatePage() {
  return (
    <ErrorBoundary>
      <GateList />
    </ErrorBoundary>
  )
}
