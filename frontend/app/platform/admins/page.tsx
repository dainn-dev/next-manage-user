"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Plus, RefreshCw } from "lucide-react"

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

export default function PlatformAdminsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreatePlatformAdminRequest>(emptyForm)
  const [statusTarget, setStatusTarget] = useState<PlatformAdmin | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAdmins(await platformApi.listAdmins())
    } catch (error) {
      toast({
        title: "Không tải được platform admins",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const submitCreate = async () => {
    setSaving(true)
    try {
      await platformApi.createAdmin({
        ...form,
        firstName: form.firstName?.trim() || undefined,
        lastName: form.lastName?.trim() || undefined,
      })
      setCreateOpen(false)
      setForm(emptyForm)
      await load()
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

  const openStatusChange = (admin: PlatformAdmin) => {
    const next = admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    if (user && admin.username === user.username && next === "SUSPENDED") {
      toast({
        title: "Không thể suspend chính mình",
        description: "Dùng một platform admin khác để thay đổi tài khoản này.",
        variant: "destructive",
      })
      return
    }
    setStatusTarget(admin)
  }

  const confirmStatusChange = async () => {
    if (!statusTarget) return
    const next = statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    setSaving(true)
    try {
      await platformApi.updateAdmin(statusTarget.id, { status: next })
      setStatusTarget(null)
      await load()
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

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Platform admins</h1>
          <p className="platform-page-description">
            Quản lý tài khoản PLATFORM_ADMIN của control plane — không mời hoặc chỉnh sửa user trong tenant khách.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            data-state={loading ? "loading" : "default"}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            Thêm admin
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải platform admins" : `Đã tải ${admins.length} platform admin`}
      </p>

      <section aria-label="Platform admin accounts" className="platform-data-surface">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="sr-only">Platform admin accounts</caption>
            <thead className="text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Last login</th>
                <th scope="col" className="px-4 py-3 text-right font-medium sm:pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-70" : undefined}>
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Chưa có platform admin.
                  </td>
                </tr>
              )}
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-4 py-3 sm:px-6">
                    <div className="font-semibold">{admin.username}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 break-all">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className="platform-status" data-tone={admin.status === "ACTIVE" ? "good" : "serious"}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-6">
                    <Button variant="ghost" disabled={saving} onClick={() => openStatusChange(admin)}>
                      {admin.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="platform-mobile-list md:hidden">
          {!loading && admins.length === 0 && <div className="platform-empty-state">Chưa có platform admin.</div>}
          {admins.map((admin) => (
            <article key={admin.id} className="platform-mobile-card">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{admin.username}</h2>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{admin.email}</p>
                </div>
                <span className="platform-status" data-tone={admin.status === "ACTIVE" ? "good" : "serious"}>
                  {admin.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Last login: {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("vi-VN") : "—"}
              </p>
              <Button variant="outline" className="w-fit" disabled={saving} onClick={() => openStatusChange(admin)}>
                {admin.status === "ACTIVE" ? "Suspend admin" : "Activate admin"}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm platform admin</DialogTitle>
            <DialogDescription>Tạo một tài khoản có quyền truy cập control plane trên toàn platform.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["username", "Username"],
                ["email", "Email"],
                ["password", "Password"],
                ["firstName", "First name"],
                ["lastName", "Last name"],
              ] as const
            ).map(([key, label]) => {
              const required = key === "username" || key === "email" || key === "password"
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}{required ? " *" : ""}</Label>
                  <Input
                    id={key}
                    type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                    value={form[key] ?? ""}
                    onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
                    required={required}
                    aria-required={required}
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={saving || !form.username.trim() || !form.email.trim() || !form.password.trim()}
              data-state={saving ? "loading" : "default"}
            >
              {saving ? "Đang tạo" : "Tạo admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusTarget?.status === "ACTIVE" ? "Suspend platform admin" : "Activate platform admin"}</DialogTitle>
            <DialogDescription>Xác nhận tài khoản và hệ quả trước khi thay đổi quyền truy cập.</DialogDescription>
          </DialogHeader>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-serious)]" aria-hidden="true" />
              <div>
                <p className="font-semibold">{statusTarget?.username}</p>
                <p className="mt-1 text-muted-foreground">
                  {statusTarget?.status === "ACTIVE"
                    ? "Tài khoản sẽ mất quyền truy cập platform cho đến khi được kích hoạt lại."
                    : "Tài khoản sẽ lấy lại quyền truy cập platform."}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Hủy</Button>
            <Button
              variant={statusTarget?.status === "ACTIVE" ? "destructive" : "default"}
              onClick={() => void confirmStatusChange()}
              disabled={saving}
              data-state={saving ? "loading" : "default"}
            >
              {saving ? "Đang cập nhật" : statusTarget?.status === "ACTIVE" ? "Suspend admin" : "Activate admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
