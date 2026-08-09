"use client"

import * as React from "react"
import { Activity, Eye, EyeOff, Loader2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  cameraApi,
  type Camera,
  type CameraPanelType,
  type CameraProbeResult,
  type CameraRole,
  type CameraSourceType,
  type CameraWriteRequest,
} from "@/lib/api/camera-api"
import type { Zone } from "@/lib/api/zone-api"

export type CameraFormValues = {
  name: string
  role: CameraRole
  panelType: CameraPanelType | ""
  zoneId: string
  sourceType: CameraSourceType
  sourceUrl: string
  issueKey: boolean
}

const EMPTY_VALUES: CameraFormValues = {
  name: "",
  role: "OVERVIEW",
  panelType: "",
  zoneId: "",
  sourceType: "rtsp",
  sourceUrl: "",
  issueKey: true,
}

type CameraFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  siteId: string
  zones: Zone[]
  camera?: Camera | null
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CameraFormValues) => Promise<void> | void
}

function inferSourceType(camera: Camera): CameraSourceType {
  if (camera.sourceType === "http" || camera.sourceType === "rtsp") {
    return camera.sourceType
  }
  const url = (camera.sourceUrl || camera.rtspUrl || "").trim().toLowerCase()
  if (url.startsWith("http://") || url.startsWith("https://")) return "http"
  return "rtsp"
}

export function cameraFormToWriteRequest(
  siteId: string,
  values: CameraFormValues,
): CameraWriteRequest {
  const role = values.role
  const sourceUrl = values.sourceUrl.trim() || null
  return {
    siteId,
    name: values.name.trim(),
    role,
    sourceType: values.sourceType,
    sourceUrl,
    rtspUrl: values.sourceType === "rtsp" ? sourceUrl : null,
    zoneId: role === "ANPR_GATE" && values.zoneId ? values.zoneId : null,
    panelType: role === "ANPR_GATE" && values.panelType ? values.panelType : null,
  }
}

export function formatProbeSummary(probe: CameraProbeResult): string {
  if (!probe.reachable) {
    return probe.errorMessage || "Không kết nối được nguồn từ server."
  }
  const parts: string[] = []
  if (probe.codec) parts.push(probe.codec)
  if (probe.width && probe.height) parts.push(`${probe.width}×${probe.height}`)
  if (probe.fps != null) parts.push(`${probe.fps} fps`)
  return parts.length > 0 ? parts.join(" · ") : "Nguồn phản hồi OK"
}

function ProbeResultPanel({ probe }: { probe: CameraProbeResult }) {
  return (
    <div className="rounded-[var(--radius-input)] border border-border bg-muted/30 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={probe.reachable
            ? "border-[var(--color-success)]/30 bg-[var(--color-success-surface)] text-[var(--color-success)]"
            : "border-[var(--color-warning)]/30 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
        >
          {probe.reachable ? "Nguồn hoạt động" : "Nguồn không phản hồi"}
        </Badge>
        {probe.probeMethod && (
          <span className="text-xs text-muted-foreground">via {probe.probeMethod}</span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:text-sm">
        <div>
          <dt className="text-muted-foreground">Host</dt>
          <dd className="font-medium text-foreground">{probe.host || "—"}{probe.port ? `:${probe.port}` : ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">TCP</dt>
          <dd className="font-medium text-foreground">{probe.tcpOpen ? "Mở" : "Đóng"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Codec</dt>
          <dd className="font-medium text-foreground">{probe.codec || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Độ phân giải</dt>
          <dd className="font-medium text-foreground">
            {probe.width && probe.height ? `${probe.width}×${probe.height}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">FPS</dt>
          <dd className="font-medium text-foreground">{probe.fps != null ? String(probe.fps) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stream</dt>
          <dd className="font-medium text-foreground">{probe.streamOk ? "OK" : "Chưa xác nhận"}</dd>
        </div>
      </dl>
      {!probe.reachable && probe.errorMessage && (
        <p className="mt-2 text-xs text-[var(--color-serious)]">{probe.errorMessage}</p>
      )}
    </div>
  )
}

export function CameraFormDialog({
  open,
  mode,
  siteId: _siteId,
  zones,
  camera,
  submitting = false,
  onOpenChange,
  onSubmit,
}: CameraFormDialogProps) {
  const [values, setValues] = React.useState<CameraFormValues>(EMPTY_VALUES)
  const [error, setError] = React.useState<string | null>(null)
  const [showSourceUrl, setShowSourceUrl] = React.useState(false)
  const [probing, setProbing] = React.useState(false)
  const [probeResult, setProbeResult] = React.useState<CameraProbeResult | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setShowSourceUrl(false)
    setProbeResult(null)
    if (mode === "edit" && camera) {
      const sourceType = inferSourceType(camera)
      setValues({
        name: camera.name || "",
        role: camera.role || "OVERVIEW",
        panelType: camera.panelType || "",
        zoneId: camera.zoneId || "",
        sourceType,
        sourceUrl: camera.sourceUrl || camera.rtspUrl || "",
        issueKey: false,
      })
    } else {
      setValues(EMPTY_VALUES)
    }
  }, [open, mode, camera])

  const gateRole = values.role === "ANPR_GATE"
  const httpSource = values.sourceType === "http"
  const busy = submitting || probing

  async function handleProbe() {
    const sourceUrl = values.sourceUrl.trim()
    if (!sourceUrl) {
      setError(httpSource ? "Nhập HTTP URL (DroidCam) trước khi kiểm tra." : "Nhập RTSP URL trước khi kiểm tra.")
      return
    }
    setError(null)
    setProbing(true)
    try {
      const result = await cameraApi.probe(sourceUrl, values.sourceType)
      setProbeResult(result)
    } catch (reason) {
      setProbeResult(null)
      setError(reason instanceof Error ? reason.message : "Không kiểm tra được nguồn camera.")
    } finally {
      setProbing(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError("Vui lòng nhập tên camera.")
      return
    }
    if (gateRole && !values.panelType) {
      setError("Camera cổng cần chọn hướng vào hoặc ra.")
      return
    }
    setError(null)
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm camera" : "Cập nhật camera"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Đăng ký nguồn RTSP hoặc HTTP (DroidCam). Có thể kiểm tra kết nối và cấp API key ngay."
              : "Chỉnh nguồn camera. Agent nhận source.type / source.url từ cấu hình này."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="camera-name">Tên camera</Label>
            <Input
              id="camera-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ví dụ: Gate Entry Cam"
              disabled={busy}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Vai trò</Label>
            <Select
              value={values.role}
              onValueChange={(role: CameraRole) =>
                setValues((current) => ({
                  ...current,
                  role,
                  panelType: role === "OVERVIEW" ? "" : current.panelType || "entry",
                  zoneId: role === "OVERVIEW" ? "" : current.zoneId,
                }))
              }
              disabled={busy}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OVERVIEW">Tổng quan bãi (OVERVIEW)</SelectItem>
                <SelectItem value="ANPR_GATE">Cổng ANPR (ANPR_GATE)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {gateRole && (
            <>
              <div className="grid gap-2">
                <Label>Hướng cổng</Label>
                <Select
                  value={values.panelType || undefined}
                  onValueChange={(panelType: CameraPanelType) =>
                    setValues((current) => ({ ...current, panelType }))
                  }
                  disabled={busy}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn hướng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Vào (entry)</SelectItem>
                    <SelectItem value="exit">Ra (exit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Khu vực (tuỳ chọn)</Label>
                <Select
                  value={values.zoneId || "__none__"}
                  onValueChange={(zoneId) =>
                    setValues((current) => ({
                      ...current,
                      zoneId: zoneId === "__none__" ? "" : zoneId,
                    }))
                  }
                  disabled={busy}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Không gắn zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Không gắn zone</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Loại nguồn</Label>
            <Select
              value={values.sourceType}
              onValueChange={(sourceType: CameraSourceType) => {
                setProbeResult(null)
                setValues((current) => ({ ...current, sourceType }))
              }}
              disabled={busy}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn loại nguồn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rtsp">RTSP (camera IP)</SelectItem>
                <SelectItem value="http">HTTP / DroidCam (MJPEG)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="camera-source-url">
              {httpSource ? "HTTP URL (DroidCam)" : "RTSP URL"} (tuỳ chọn)
            </Label>
            <div className="relative">
              <Input
                id="camera-source-url"
                type={showSourceUrl ? "text" : "password"}
                autoComplete="off"
                className="pr-12"
                value={values.sourceUrl}
                onChange={(event) => {
                  setProbeResult(null)
                  setValues((current) => ({ ...current, sourceUrl: event.target.value }))
                }}
                placeholder={
                  httpSource
                    ? "http://192.168.0.199:4747/video/force/1280x720"
                    : "rtsp://user:pass@192.168.1.10/stream1"
                }
                disabled={busy}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[var(--radius-input)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => setShowSourceUrl((visible) => !visible)}
                aria-label={showSourceUrl ? "Ẩn URL nguồn" : "Hiện URL nguồn"}
                disabled={busy}
              >
                {showSourceUrl ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {httpSource && (
              <p className="text-xs text-muted-foreground">
                DroidCam Wi‑Fi: mở app trên điện thoại, dùng URL dạng{" "}
                <code className="rounded bg-muted px-1">http://IP:4747/video</code>.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleProbe()}
              disabled={busy || !values.sourceUrl.trim()}
            >
              {probing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Radio className="mr-2 size-4" />}
              {httpSource ? "Kiểm tra HTTP / DroidCam" : "Kiểm tra tình trạng RTSP"}
            </Button>
          </div>

          {probeResult && <ProbeResultPanel probe={probeResult} />}

          {mode === "create" && (
            <label className="flex items-start gap-3 rounded-[var(--radius-input)] border border-border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={values.issueKey}
                onChange={(event) =>
                  setValues((current) => ({ ...current, issueKey: event.target.checked }))
                }
                disabled={busy}
              />
              <span>
                <span className="font-medium text-foreground">Cấp API key ngay sau khi tạo</span>
                <span className="mt-1 block text-muted-foreground">
                  Key chỉ hiện một lần — dùng cho heartbeat và ingest từ edge/agent.
                </span>
              </span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" disabled={busy}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Activity className="mr-2 size-4" />}
              {mode === "create" ? "Tạo camera" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ProbeResultPanel }
