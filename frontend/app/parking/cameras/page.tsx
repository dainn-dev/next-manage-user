"use client"

import * as React from "react"
import {
  AlertCircle,
  Camera,
  Copy,
  RefreshCw,
  Radio,
  Activity,
  WifiOff,
  Loader2,
  Plus,
} from "lucide-react"

import { CameraTile } from "@/components/dashboard/camera-tile"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import {
  CameraFormDialog,
  ProbeResultPanel,
  cameraFormToWriteRequest,
  formatProbeSummary,
  type CameraFormValues,
} from "@/components/cameras/camera-form-dialog"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/layout/admin-page"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cameraApi, type Camera as CameraRecord, type CameraProbeResult } from "@/lib/api/camera-api"
import type { DashboardCamera } from "@/lib/api/dashboard-api"

export default function LiveCamerasPage() {
  const { cameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId, zones } = useDashboardScope()
  const { toast } = useToast()
  const [currentTime, setCurrentTime] = React.useState<string>("")
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create")
  const [editingCamera, setEditingCamera] = React.useState<CameraRecord | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DashboardCamera | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [issuedKey, setIssuedKey] = React.useState<{ name: string; key: string } | null>(null)
  const [detail, setDetail] = React.useState<{
    camera: CameraRecord
    probe: CameraProbeResult | null
    mode: "create" | "edit"
  } | null>(null)

  React.useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
    const interval = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString("vi-VN")), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const onlineCount = React.useMemo(
    () => cameras.filter((camera) => camera.status === "ONLINE" || camera.status === "ACTIVE").length,
    [cameras],
  )
  const offlineCount = cameras.length - onlineCount
  const loading = status === "loading" || status === "idle"
  const scopeLabel = selectedZoneId ? "khu vực đang chọn" : "site đang chọn"

  const metrics = [
    {
      label: "Tổng camera",
      value: cameras.length.toLocaleString("vi-VN"),
      note: `Trong ${scopeLabel}`,
      icon: Camera,
      tone: "primary",
    },
    {
      label: "Đang trực tuyến",
      value: onlineCount.toLocaleString("vi-VN"),
      note: realtime === "live" ? "Cập nhật realtime" : "Sẵn sàng truyền hình ảnh",
      icon: Radio,
      tone: "success",
    },
    {
      label: "Ngoại tuyến",
      value: offlineCount.toLocaleString("vi-VN"),
      note: "Cần kiểm tra kết nối",
      icon: WifiOff,
      tone: "critical",
    },
  ] as const

  function openCreate() {
    setFormMode("create")
    setEditingCamera(null)
    setFormOpen(true)
  }

  async function openEdit(camera: DashboardCamera) {
    try {
      const detail = await cameraApi.get(camera.id)
      setFormMode("edit")
      setEditingCamera(detail)
      setFormOpen(true)
    } catch (reason) {
      toast({
        title: "Không thể mở form sửa",
        description: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  async function handleSubmit(values: CameraFormValues) {
    if (!selectedSiteId) return
    setSubmitting(true)
    try {
      const body = cameraFormToWriteRequest(selectedSiteId, values)
      let probe: CameraProbeResult | null = null
      if (body.sourceUrl) {
        try {
          probe = await cameraApi.probe(body.sourceUrl, body.sourceType)
        } catch {
          probe = {
            reachable: false,
            tcpOpen: false,
            streamOk: false,
            errorCode: "PROBE_FAILED",
            errorMessage: "Không gọi được API kiểm tra nguồn camera.",
          }
        }
      }

      let saved: CameraRecord
      if (formMode === "create") {
        saved = await cameraApi.create(body)
        if (values.issueKey) {
          const credential = await cameraApi.issueCredential(saved.id)
          setIssuedKey({ name: saved.name, key: credential.ingestKey })
        }
      } else if (editingCamera) {
        saved = await cameraApi.update(editingCamera.id, body)
      } else {
        return
      }

      setFormOpen(false)
      setDetail({ camera: saved, probe, mode: formMode })
      toast({
        title: formMode === "create" ? "Đã tạo camera" : "Đã cập nhật camera",
        description: probe
          ? `${saved.name} · ${formatProbeSummary(probe)}`
          : `${saved.name} đã được lưu.`,
      })
      await refresh()
    } catch (reason) {
      toast({
        title: formMode === "create" ? "Không thể tạo camera" : "Không thể cập nhật camera",
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
      await cameraApi.delete(deleteTarget.id)
      toast({
        title: "Đã xoá camera",
        description: `${deleteTarget.name} đã được gỡ khỏi bãi.`,
      })
      setDeleteTarget(null)
      await refresh()
    } catch (reason) {
      toast({
        title: "Không thể xoá camera",
        description: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  async function copyKey() {
    if (!issuedKey) return
    await navigator.clipboard.writeText(issuedKey.key)
    toast({ title: "Đã sao chép API key" })
  }

  return (
    <AdminPage className="space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Camera trực tuyến"
        description="Theo dõi nguồn hình ảnh thuộc site và khu vực đang chọn với dữ liệu được cập nhật tự động."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 text-sm shadow-sm sm:min-w-36">
              <span className="text-muted-foreground">Giờ hệ thống</span>
              <span className="font-semibold tabular-nums text-foreground">{currentTime || "00:00:00"}</span>
            </div>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
              className="min-h-11 rounded-2xl border-border bg-card px-4 text-foreground hover:bg-muted"
            >
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin text-primary" : ""}`} />
              Làm mới
            </Button>
            <Button
              onClick={openCreate}
              disabled={!selectedSiteId}
              className="min-h-11 rounded-2xl px-4"
            >
              <Plus className="mr-2 size-4" />
              Thêm camera
            </Button>
          </div>
        }
      />

      <DashboardMetricsSection
        id="camera-metrics-title"
        title="Thông số camera"
        description={`Tổng quan trạng thái kết nối camera trong ${scopeLabel}.`}
        badge={(
          <Badge
            variant="outline"
            className={realtime === "live"
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-[var(--color-warning)]/25 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
          >
            <Activity className={`size-3 ${realtime === "live" ? "animate-pulse" : ""}`} aria-hidden="true" />
            {realtime === "live" ? "Đang nhận realtime" : "Đồng bộ định kỳ"}
          </Badge>
        )}
        loading={loading && cameras.length === 0}
        metricGridClassName="sm:grid-cols-3"
        metrics={metrics}
      />

      {realtime !== "live" && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-foreground sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-2">
              <Activity className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Đang đồng bộ định kỳ trạng thái kết nối camera từ Gateway.</span>
            </div>
            {lastUpdatedAt && <Badge variant="secondary" className="w-fit sm:ml-auto">Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}</Badge>}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50 shadow-none">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-medium">Không thể tải camera</p><p className="mt-1 text-rose-700">{error}</p></div>
          </CardContent>
        </Card>
      )}

      {!selectedSiteId ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Chưa chọn site"
          description="Chọn một site ở bộ điều phối phía trên để xem các camera tương ứng."
        />
      ) : loading && cameras.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden border-border bg-card shadow-sm">
              <CardContent className="flex aspect-video items-center justify-center gap-2 bg-muted/40 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Đang tải camera
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Không tìm thấy camera"
          description={selectedZoneId ? "Khu vực đang chọn chưa có nguồn camera giám sát." : "Site đang chọn chưa thiết lập nguồn camera giám sát."}
          action={(
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Thêm camera đầu tiên
            </Button>
          )}
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Danh sách camera trực tuyến">
          {cameras.map((camera) => (
            <CameraTile
              key={camera.id}
              camera={camera}
              onEdit={(item) => void openEdit(item)}
              onDelete={setDeleteTarget}
            />
          ))}
        </section>
      )}

      {selectedSiteId && (
        <CameraFormDialog
          open={formOpen}
          mode={formMode}
          siteId={selectedSiteId}
          zones={zones}
          camera={editingCamera}
          submitting={submitting}
          onOpenChange={setFormOpen}
          onSubmit={handleSubmit}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá camera?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Camera “${deleteTarget.name}” sẽ bị gỡ khỏi bãi. Thao tác này không thể hoàn tác.`
                : "Thao tác này không thể hoàn tác."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Xoá camera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!issuedKey} onOpenChange={(open) => !open && setIssuedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key đã được cấp</DialogTitle>
            <DialogDescription>
              Lưu key cho camera {issuedKey?.name}. Key chỉ hiện một lần — dùng header X-Camera-Id / X-Camera-Key.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-[var(--radius-input)] border border-border bg-muted/40 p-3 text-xs">
            {issuedKey?.key}
          </code>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIssuedKey(null)}>Đóng</Button>
            <Button type="button" onClick={() => void copyKey()}>
              <Copy className="mr-2 size-4" />
              Sao chép key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detail?.mode === "create" ? "Chi tiết camera vừa tạo" : "Chi tiết camera vừa cập nhật"}
            </DialogTitle>
            <DialogDescription>
              Thông tin đã lưu và kết quả kiểm tra tình trạng hoạt động RTSP từ server.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <dt className="text-muted-foreground">Tên</dt>
                  <dd className="font-medium">{detail.camera.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Trạng thái đăng ký</dt>
                  <dd className="font-medium uppercase">{detail.camera.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vai trò</dt>
                  <dd className="font-medium">{detail.camera.role}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Heartbeat</dt>
                  <dd className="font-medium">
                    {detail.camera.lastHeartbeatAt
                      ? new Date(detail.camera.lastHeartbeatAt).toLocaleString("vi-VN")
                      : "Chưa có"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="break-all font-mono text-xs">{detail.camera.id}</dd>
                </div>
              </dl>
              {detail.probe ? (
                <ProbeResultPanel probe={detail.probe} />
              ) : (
                <p className="rounded-[var(--radius-input)] border border-border bg-muted/30 p-3 text-muted-foreground">
                  Không có URL nguồn — bỏ qua kiểm tra kết nối.
                </p>
              )}
              {detail.camera.sourceType && (
                <p className="text-xs text-muted-foreground">
                  Loại nguồn agent: <span className="font-medium text-foreground">{detail.camera.sourceType}</span>
                  {detail.camera.sourceUrl ? ` · ${detail.camera.sourceUrl}` : ""}
                </p>
              )}
              {detail.probe && !detail.probe.reachable && (
                <p className="text-xs text-muted-foreground">
                  Camera vẫn được lưu. Server có thể không cùng mạng với nguồn; edge/agent trên LAN sẽ kết nối và gửi heartbeat để báo ONLINE.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setDetail(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}
