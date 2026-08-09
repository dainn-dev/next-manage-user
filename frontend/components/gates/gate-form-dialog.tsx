"use client"

import * as React from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"

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
import type { Camera } from "@/lib/api/camera-api"
import type { Gate, GateStatus, GateType } from "@/lib/api/gate-api"

export type GateFormValues = {
  name: string
  gateType: GateType
  location: string
  status: GateStatus
  /** One camera id per lane; empty string = lane row without selection yet. */
  laneCameraIds: string[]
}

const EMPTY_VALUES: GateFormValues = {
  name: "",
  gateType: "ENTRANCE",
  location: "",
  status: "offline",
  laneCameraIds: [""],
}

type GateFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  gate?: Gate | null
  cameras: Camera[]
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: GateFormValues) => Promise<void> | void
}

export function GateFormDialog({
  open,
  mode,
  gate,
  cameras,
  submitting = false,
  onOpenChange,
  onSubmit,
}: GateFormDialogProps) {
  const [values, setValues] = React.useState<GateFormValues>(EMPTY_VALUES)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === "edit" && gate) {
      const lanes = (gate.lanes ?? []).map((lane) => lane.cameraId)
      setValues({
        name: gate.name ?? "",
        gateType: gate.gateType ?? "ENTRANCE",
        location: gate.location ?? "",
        status: gate.status ?? "offline",
        laneCameraIds: lanes.length > 0 ? lanes : [""],
      })
    } else {
      setValues(EMPTY_VALUES)
    }
  }, [open, mode, gate])

  function setLaneCamera(index: number, cameraId: string) {
    setValues((prev) => {
      const next = [...prev.laneCameraIds]
      next[index] = cameraId
      return { ...prev, laneCameraIds: next }
    })
  }

  function addLane() {
    setValues((prev) => ({ ...prev, laneCameraIds: [...prev.laneCameraIds, ""] }))
  }

  function removeLane(index: number) {
    setValues((prev) => {
      const next = prev.laneCameraIds.filter((_, i) => i !== index)
      return { ...prev, laneCameraIds: next.length > 0 ? next : [""] }
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = values.name.trim()
    if (!name) {
      setError("Tên cổng là bắt buộc.")
      return
    }
    if (!values.gateType) {
      setError("Chọn loại cổng (vào hoặc ra).")
      return
    }
    const cameraIds = values.laneCameraIds.map((id) => id.trim()).filter(Boolean)
    if (new Set(cameraIds).size !== cameraIds.length) {
      setError("Mỗi lối đi phải dùng một camera khác nhau.")
      return
    }
    if (values.laneCameraIds.some((id) => !id.trim()) && values.laneCameraIds.length > 1) {
      setError("Chọn camera cho mọi lối đi, hoặc xoá lối còn trống.")
      return
    }
    setError(null)
    await onSubmit({
      ...values,
      name,
      location: values.location.trim(),
      laneCameraIds: cameraIds,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm cổng kiểm soát" : "Sửa cổng kiểm soát"}</DialogTitle>
            <DialogDescription>
              Cổng vào hoặc ra có thể có nhiều lối đi; mỗi lối gắn đúng một camera.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-type">Loại cổng</Label>
              <Select
                value={values.gateType}
                onValueChange={(gateType: GateType) => setValues((prev) => ({ ...prev, gateType }))}
              >
                <SelectTrigger id="gate-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRANCE">Cổng vào</SelectItem>
                  <SelectItem value="EXIT">Cổng ra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-name">Tên cổng</Label>
              <Input
                id="gate-name"
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={values.gateType === "EXIT" ? "Ví dụ: Cổng ra A" : "Ví dụ: Cổng vào chính"}
                maxLength={100}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-location">Vị trí</Label>
              <Input
                id="gate-location"
                value={values.location}
                onChange={(event) => setValues((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Ví dụ: Lối A — tầng hầm"
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-status">Trạng thái</Label>
              <Select
                value={values.status}
                onValueChange={(status: GateStatus) => setValues((prev) => ({ ...prev, status }))}
              >
                <SelectTrigger id="gate-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Ngoại tuyến</SelectItem>
                  <SelectItem value="online">Trực tuyến</SelectItem>
                  <SelectItem value="disabled">Vô hiệu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Lối đi</p>
                  <p className="text-xs text-muted-foreground">Mỗi lối chọn một camera ANPR.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLane}>
                  <Plus className="size-4" />
                  Thêm lối
                </Button>
              </div>

              {cameras.length === 0 ? (
                <p className="text-sm text-amber-800">
                  Chưa có camera trong cơ sở. Tạo camera ở mục Camera trước khi gắn lối đi.
                </p>
              ) : (
                <ul className="space-y-2">
                  {values.laneCameraIds.map((cameraId, index) => {
                    const taken = new Set(
                      values.laneCameraIds.filter((id, i) => i !== index && id.trim()),
                    )
                    return (
                      <li key={`lane-${index}`} className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label htmlFor={`gate-lane-${index}`}>Lối {index + 1}</Label>
                          <Select
                            value={cameraId || undefined}
                            onValueChange={(value) => setLaneCamera(index, value)}
                          >
                            <SelectTrigger id={`gate-lane-${index}`}>
                              <SelectValue placeholder="Chọn camera" />
                            </SelectTrigger>
                            <SelectContent>
                              {cameras.map((camera) => {
                                const disabled = taken.has(camera.id)
                                const linkedElsewhere =
                                  camera.gateId
                                  && camera.gateId !== gate?.id
                                  && !disabled
                                return (
                                  <SelectItem
                                    key={camera.id}
                                    value={camera.id}
                                    disabled={disabled}
                                  >
                                    {camera.name}
                                    {linkedElsewhere ? " (đang gắn cổng khác)" : ""}
                                    {camera.panelType === "entry"
                                      ? " · vào"
                                      : camera.panelType === "exit"
                                        ? " · ra"
                                        : ""}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 text-rose-700"
                          onClick={() => removeLane(index)}
                          aria-label={`Xoá lối ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {error && (
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Tạo cổng" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
