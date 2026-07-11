"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  tenantApi,
  type TenantDetail,
  type TenantStatus,
} from "@/lib/api/tenant-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, PauseCircle, RefreshCw, Trash2 } from "lucide-react"
import { managementModelLabel } from "@/lib/management-models"

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
}

export default function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { toast } = useToast()
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [statusOpen, setStatusOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<TenantStatus>("suspended")
  const [statusReason, setStatusReason] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setTenant(await tenantApi.get(id))
    } catch (error) {
      toast({
        title: "Không tải được tenant",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
      router.replace("/platform/tenants")
    } finally {
      setLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    void load()
  }, [load])

  const submitRename = async () => {
    if (!tenant || !renameValue.trim()) return
    setSaving(true)
    try {
      const updated = await tenantApi.rename(tenant.id, renameValue.trim())
      setTenant(updated)
      setRenameOpen(false)
      toast({ title: "Đã đổi tên tenant" })
    } catch (error) {
      toast({
        title: "Đổi tên thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const submitStatus = async () => {
    if (!tenant) return
    setSaving(true)
    try {
      const updated = await tenantApi.updateStatus(tenant.id, nextStatus, statusReason || undefined)
      setTenant(updated)
      setStatusOpen(false)
      toast({ title: "Đã cập nhật trạng thái" })
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

  if (loading || !tenant) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/platform/tenants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Tenants
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
            <Badge>{STATUS_LABEL[tenant.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
          <p className="text-sm text-muted-foreground">
            Model: {managementModelLabel(tenant.managementModel)}
            {" · "}
            Khai báo ~{tenant.areaCount ?? "—"} khu vực
            {" · "}
            {tenant.sites.length} site thực tế
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRenameValue(tenant.name)
              setRenameOpen(true)
            }}
          >
            Đổi tên
          </Button>
          {tenant.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNextStatus("suspended")
                setStatusReason("")
                setStatusOpen(true)
              }}
            >
              <PauseCircle className="mr-1 h-3.5 w-3.5" />
              Suspend
            </Button>
          )}
          {tenant.status === "suspended" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNextStatus("active")
                setStatusReason("")
                setStatusOpen(true)
              }}
            >
              Reactivate
            </Button>
          )}
          {tenant.status !== "pending_deletion" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                setNextStatus("pending_deletion")
                setStatusReason("")
                setStatusOpen(true)
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/platform/billing?search=${encodeURIComponent(tenant.slug)}`}>
              Billing
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Management model</div>
              <div className="font-medium">{managementModelLabel(tenant.managementModel)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Area count (intent)</div>
              <div className="font-medium">{tenant.areaCount ?? "—"}</div>
            </div>
            <div className="sm:col-span-2 text-xs text-muted-foreground">
              areaCount là ước lượng quy mô lúc đăng ký/onboard — không tự tạo N site. Site ≠ Gate.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sites ({tenant.sites.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tenant.sites.length === 0 && (
              <p className="text-muted-foreground">Chưa có site.</p>
            )}
            {tenant.sites.map((site) => (
              <div key={site.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">{site.name}</div>
                <div className="text-xs text-muted-foreground">{site.location || "—"}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tenant admins ({tenant.tenantAdmins.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tenant.tenantAdmins.length === 0 && (
              <p className="text-muted-foreground">Chưa có tenant admin.</p>
            )}
            {tenant.tenantAdmins.map((admin) => (
              <div key={admin.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">{admin.fullName || admin.username}</div>
                <div className="text-xs text-muted-foreground">
                  {admin.email} · {admin.status || "—"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Tạo: {new Date(tenant.createdAt).toLocaleString("vi-VN")} · Cập nhật:{" "}
        {new Date(tenant.updatedAt).toLocaleString("vi-VN")}
      </p>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">Tên mới</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void submitRename()} disabled={saving || !renameValue.trim()}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi trạng thái → {STATUS_LABEL[nextStatus]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">
              Lý do {nextStatus === "pending_deletion" ? "(bắt buộc)" : "(tuỳ chọn)"}
            </Label>
            <Input
              id="reason"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => void submitStatus()}
              disabled={saving || (nextStatus === "pending_deletion" && !statusReason.trim())}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
