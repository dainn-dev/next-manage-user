"use client"

import { useCallback, useEffect, useState } from "react"
import {
  platformApi,
  type CreatePlatformAdminRequest,
  type PlatformAdmin,
} from "@/lib/api/platform-api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, RefreshCw } from "lucide-react"

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
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAdmins(await platformApi.listAdmins())
    } catch (error) {
      toast({
        title: "Không tải được admins",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
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
      toast({ title: "Đã tạo platform admin" })
      setCreateOpen(false)
      setForm(emptyForm)
      await load()
    } catch (error) {
      toast({
        title: "Tạo thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSuspend = async (admin: PlatformAdmin) => {
    const next = admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    if (user && admin.username === user.username && next !== "ACTIVE") {
      toast({ title: "Không thể suspend chính mình", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await platformApi.updateAdmin(admin.id, { status: next })
      toast({ title: next === "SUSPENDED" ? "Đã suspend" : "Đã kích hoạt lại" })
      await load()
    } catch (error) {
      toast({
        title: "Cập nhật thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform admins</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ quản lý tài khoản PLATFORM_ADMIN (không invite user trong tenant khách).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm admin
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có platform admin.
                </td>
              </tr>
            )}
            {!loading &&
              admins.map((admin) => (
                <tr key={admin.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{admin.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{admin.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={admin.status === "ACTIVE" ? "default" : "secondary"}>
                      {admin.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => void toggleSuspend(admin)}
                    >
                      {admin.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm platform admin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["username", "Username *"],
                ["email", "Email *"],
                ["password", "Password *"],
                ["firstName", "First name"],
                ["lastName", "Last name"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={
                saving ||
                !form.username.trim() ||
                !form.email.trim() ||
                !form.password.trim()
              }
            >
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
