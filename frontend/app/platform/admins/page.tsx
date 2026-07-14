"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import {
  platformApi,
  type CreatePlatformAdminRequest,
  type PlatformAdmin,
} from "@/lib/api/platform-api"

const emptyForm: CreatePlatformAdminRequest = {
  username: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
}

function nextStatus(admin: PlatformAdmin): PlatformAdmin["status"] {
  return admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
}

function statusLabel(admin: PlatformAdmin): string {
  switch (admin.status) {
    case "ACTIVE": return "Suspend"
    case "SUSPENDED": return "Reactivate"
    case "LOCKED": return "Reactivate"
    case "INACTIVE": return "Activate"
  }
}

function statusBadgeVariant(status: PlatformAdmin["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default"
  if (status === "SUSPENDED" || status === "LOCKED") return "destructive"
  return "secondary"
}

export default function PlatformAdminsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<"form" | "review">("form")
  const [form, setForm] = useState<CreatePlatformAdminRequest>(emptyForm)
  const [createAuditRef, setCreateAuditRef] = useState<string | null>(null)

  // Status change dialog
  const [statusTarget, setStatusTarget] = useState<PlatformAdmin | null>(null)
  const [statusReason, setStatusReason] = useState("")
  const [statusAuditRef, setStatusAuditRef] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAdmins(await platformApi.listAdmins())
    } catch {
      toast({ title: "Không tải được platform admins", description: "Hãy thử lại.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  // Create flow
  const openCreate = () => {
    setForm(emptyForm)
    setCreateStep("form")
    setCreateAuditRef(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    setSaving(true)
    try {
      const res = await platformApi.createAdmin({
        ...form,
        firstName: form.firstName?.trim() || undefined,
        lastName: form.lastName?.trim() || undefined,
      })
      setCreateAuditRef(res.auditId ?? null)
      await load()
      // Stay open to show audit ref — user closes manually
    } catch (error) {
      toast({
        title: "Tạo platform admin thất bại",
        description: error instanceof Error ? error.message : "Kiểm tra dữ liệu và thử lại.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Status change flow
  const openStatusChange = (admin: PlatformAdmin) => {
    // Self-suspension guard
    if (user && admin.username === user.username && admin.status === "ACTIVE") {
      toast({
        title: "Không thể suspend chính mình",
        description: "Dùng một platform admin khác để thay đổi tài khoản này.",
        variant: "destructive",
      })
      return
    }
    // Last-active-admin client guard
    if (admin.status === "ACTIVE") {
      const activeCount = admins.filter(a => a.status === "ACTIVE").length
      if (activeCount <= 1) {
        toast({
          title: "Không thể deactivate admin cuối cùng",
          description: "Cần ít nhất một platform admin đang active trên platform.",
          variant: "destructive",
        })
        return
      }
    }
    setStatusTarget(admin)
    setStatusReason("")
    setStatusAuditRef(null)
  }

  const confirmStatusChange = async () => {
    if (!statusTarget) return
    if (!statusReason.trim()) {
      toast({ title: "Lý do là bắt buộc", description: "Nhập lý do trước khi thay đổi trạng thái.", variant: "destructive" })
      return
    }
    const next = nextStatus(statusTarget)
    setSaving(true)
    try {
      const res = await platformApi.updateAdmin(statusTarget.id, {
        status: next,
        reason: statusReason.trim(),
      })
      setStatusAuditRef(res.auditId ?? null)
      await load()
      // Stay open to show audit ref — user closes manually
    } catch (error) {
      toast({
        title: "Cập nhật platform admin thất bại",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const canCreateSubmit = form.username.trim() && form.email.trim() && form.password.trim()

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Platform admins</h1>
          <p className="platform-page-description">
            Quản lý tài khoản platform admin — chỉ những tài khoản này mới có quyền control-plane.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}
            data-state={loading ? "loading" : "default"}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
          <Button onClick={openCreate}><Plus aria-hidden="true" />Thêm admin</Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải platform admins" : `${admins.length} platform admin`}
      </p>

      {/* Desktop table */}
      <div className="platform-data-surface hidden overflow-x-auto md:block">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Platform admin directory</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-6">Username</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Đang tải…</td></tr>
            )}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                Chưa có platform admin nào.
              </td></tr>
            )}
            {!loading && admins.map((admin) => (
              <tr key={admin.id} className="border-t border-border">
                <td className="px-4 py-3 sm:px-6">
                  <p className="font-medium">{admin.username}</p>
                  {admin.username === user?.username && (
                    <p className="text-xs text-muted-foreground">(bạn)</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{admin.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(admin.status)}>{admin.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openStatusChange(admin)}>
                    {statusLabel(admin)}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="platform-data-surface md:hidden">
        <div className="platform-mobile-list">
          {loading && <div className="platform-empty-state">Đang tải platform admins…</div>}
          {!loading && admins.length === 0 && (
            <div className="platform-empty-state">Chưa có platform admin nào.</div>
          )}
          {!loading && admins.map((admin) => (
            <article key={admin.id} className="platform-mobile-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{admin.username}</p>
                  <p className="text-sm text-muted-foreground">{admin.email}</p>
                </div>
                <Badge variant={statusBadgeVariant(admin.status)}>{admin.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString("vi-VN") : "Chưa đăng nhập"}
                </p>
                <Button variant="ghost" size="sm" onClick={() => openStatusChange(admin)}>
                  {statusLabel(admin)}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setCreateAuditRef(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createAuditRef ? "Đã tạo platform admin" : createStep === "review" ? "Xác nhận tạo platform admin" : "Thêm platform admin mới"}
            </DialogTitle>
          </DialogHeader>

          {/* Audit outcome */}
          {createAuditRef && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Platform admin đã được tạo và ghi vào audit log.</p>
              <p className="platform-mono rounded bg-muted px-3 py-2 text-xs">
                Audit ref: {createAuditRef}
              </p>
              <DialogFooter>
                <Button onClick={() => { setCreateOpen(false); setCreateAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          )}

          {/* Review step */}
          {!createAuditRef && createStep === "review" && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Xem lại thông tin trước khi tạo:</p>
              <dl className="space-y-1">
                {[["Username", form.username], ["Email", form.email],
                  ["First name", form.firstName || "—"], ["Last name", form.lastName || "—"]].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateStep("form")}>Sửa lại</Button>
                <Button onClick={() => void submitCreate()} disabled={saving}>
                  {saving ? "Đang tạo…" : "Tạo platform admin"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Form step */}
          {!createAuditRef && createStep === "form" && (
            <div className="space-y-4">
              {(["username", "email", "password", "firstName", "lastName"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`create-${field}`} className="capitalize">
                    {field}{["username", "email", "password"].includes(field) ? " *" : ""}
                  </Label>
                  <Input
                    id={`create-${field}`}
                    type={field === "password" ? "password" : "text"}
                    value={form[field] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    autoComplete={field === "password" ? "new-password" : "off"}
                  />
                </div>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
                <Button onClick={() => setCreateStep("review")} disabled={!canCreateSubmit}>
                  Xem lại
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status change dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => {
        if (!open) { setStatusTarget(null); setStatusReason(""); setStatusAuditRef(null) }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAuditRef
                ? "Đã cập nhật trạng thái"
                : `${statusTarget ? statusLabel(statusTarget) : ""} platform admin`}
            </DialogTitle>
          </DialogHeader>

          {statusAuditRef && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Trạng thái đã được cập nhật và ghi vào audit log.</p>
              <p className="platform-mono rounded bg-muted px-3 py-2 text-xs">Audit ref: {statusAuditRef}</p>
              <DialogFooter>
                <Button onClick={() => { setStatusTarget(null); setStatusAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          )}

          {!statusAuditRef && statusTarget && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Thay đổi trạng thái <strong>{statusTarget.username}</strong> từ{" "}
                <Badge variant={statusBadgeVariant(statusTarget.status)} className="text-xs">{statusTarget.status}</Badge>
                {" → "}
                <Badge variant={statusBadgeVariant(nextStatus(statusTarget))} className="text-xs">{nextStatus(statusTarget)}</Badge>
              </p>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Hành động này không ảnh hưởng đến vận hành bãi xe của tenant.
              </div>
              <div className="space-y-1">
                <Label htmlFor="status-reason">Lý do <span className="text-destructive">*</span></Label>
                <textarea
                  id="status-reason"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                  placeholder="Nhập lý do (bắt buộc)…"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setStatusTarget(null); setStatusReason("") }}>Hủy</Button>
                <Button
                  onClick={() => void confirmStatusChange()}
                  disabled={saving || !statusReason.trim()}
                  variant={nextStatus(statusTarget) === "SUSPENDED" ? "destructive" : "default"}
                >
                  {saving ? "Đang cập nhật…" : statusLabel(statusTarget)}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
