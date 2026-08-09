"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

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
import type { Gate } from "@/lib/api/gate-api"

export type GateFormValues = {
  name: string
  location: string
  cameraRtspUrl: string
  status: Gate["status"]
}

const EMPTY_VALUES: GateFormValues = {
  name: "",
  location: "",
  cameraRtspUrl: "",
  status: "offline",
}

type GateFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  gate?: Gate | null
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: GateFormValues) => Promise<void> | void
}

export function GateFormDialog({
  open,
  mode,
  gate,
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
      setValues({
        name: gate.name ?? "",
        location: gate.location ?? "",
        cameraRtspUrl: gate.cameraRtspUrl ?? "",
        status: gate.status ?? "offline",
      })
    } else {
      setValues(EMPTY_VALUES)
    }
  }, [open, mode, gate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = values.name.trim()
    if (!name) {
      setError("Tên cổng là bắt buộc.")
      return
    }
    setError(null)
    await onSubmit({
      ...values,
      name,
      location: values.location.trim(),
      cameraRtspUrl: values.cameraRtspUrl.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm cổng kiểm soát" : "Sửa cổng kiểm soát"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Tạo cổng mới trong cơ sở đang chọn để gắn kiosk và camera."
                : "Cập nhật tên, vị trí, RTSP và trạng thái vận hành của cổng."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-name">Tên cổng</Label>
              <Input
                id="gate-name"
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ví dụ: Cổng chính"
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
              <Label htmlFor="gate-rtsp">Camera RTSP (tuỳ chọn)</Label>
              <Input
                id="gate-rtsp"
                value={values.cameraRtspUrl}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, cameraRtspUrl: event.target.value }))
                }
                placeholder="rtsp://..."
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-status">Trạng thái</Label>
              <Select
                value={values.status}
                onValueChange={(status: Gate["status"]) =>
                  setValues((prev) => ({ ...prev, status }))
                }
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
