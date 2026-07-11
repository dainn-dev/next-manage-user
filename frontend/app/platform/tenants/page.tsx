"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  tenantApi,
  type TenantOnboardingRequest,
  type TenantStatistics,
  type TenantStatus,
  type TenantSummary,
} from "@/lib/api/tenant-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Building2, PauseCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { MANAGEMENT_MODELS, managementModelLabel } from "@/lib/management-models"

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
}

function statusVariant(status: TenantStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default"
    case "suspended":
      return "secondary"
    case "pending_deletion":
      return "destructive"
    default:
      return "outline"
  }
}

const emptyCreate: TenantOnboardingRequest = {
  tenantName: "",
  tenantSlug: "",
  siteName: "",
  siteLocation: "",
  managementModel: "other",
  areaCount: 1,
  adminUsername: "",
  adminEmail: "",
  adminPassword: "",
  adminFirstName: "",
  adminLastName: "",
}

export default function PlatformTenantsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [stats, setStats] = useState<TenantStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "all">("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [renameTarget, setRenameTarget] = useState<TenantSummary | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [statusTarget, setStatusTarget] = useState<TenantSummary | null>(null)
  const [nextStatus, setNextStatus] = useState<TenantStatus>("suspended")
  const [statusReason, setStatusReason] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TenantOnboardingRequest>(emptyCreate)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pageData, summary] = await Promise.all([
        tenantApi.list({
          page,
          size: 20,
          searchTerm: searchTerm || undefined,
          status: statusFilter,
        }),
        tenantApi.summary(),
      ])
      setTenants(pageData.content)
      setTotalPages(pageData.totalPages)
      setTotalElements(pageData.totalElements)
      setStats(summary)
    } catch (error) {
      toast({
        title: "Không tải được danh sách tenant",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  const openRename = (tenant: TenantSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameTarget(tenant)
    setRenameValue(tenant.name)
  }

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    setSaving(true)
    try {
      await tenantApi.rename(renameTarget.id, renameValue.trim())
      toast({ title: "Đã đổi tên tenant" })
      setRenameTarget(null)
      await load()
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

  const openStatus = (tenant: TenantSummary, status: TenantStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setStatusTarget(tenant)
    setNextStatus(status)
    setStatusReason("")
  }

  const submitStatus = async () => {
    if (!statusTarget) return
    setSaving(true)
    try {
      await tenantApi.updateStatus(statusTarget.id, nextStatus, statusReason || undefined)
      toast({ title: "Đã cập nhật trạng thái tenant" })
      setStatusTarget(null)
      await load()
    } catch (error) {
      toast({
        title: "Cập nhật trạng thái thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const submitCreate = async () => {
    setSaving(true)
    try {
      const payload: TenantOnboardingRequest = {
        ...createForm,
        tenantSlug: createForm.tenantSlug?.trim() || undefined,
        siteLocation: createForm.siteLocation?.trim() || undefined,
        adminFirstName: createForm.adminFirstName?.trim() || undefined,
        adminLastName: createForm.adminLastName?.trim() || undefined,
        managementModel: createForm.managementModel,
        areaCount: Number(createForm.areaCount) || 1,
      }
      const created = await tenantApi.create(payload)
      toast({ title: "Đã tạo tenant", description: created.tenantName })
      setCreateOpen(false)
      setCreateForm(emptyCreate)
      router.push(`/platform/tenants/${created.tenantId}`)
    } catch (error) {
      toast({
        title: "Tạo tenant thất bại",
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
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Lifecycle registry cho toàn platform — không phải vận hành bãi xe của khách.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo tenant
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng tenant</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats?.total ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats?.active ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats?.suspended ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending deletion</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats?.pendingDeletion ?? "—"}</CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên hoặc slug…"
            value={searchTerm}
            onChange={(e) => {
              setPage(0)
              setSearchTerm(e.target.value)
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setPage(0)
            setStatusFilter(value as TenantStatus | "all")
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending_deletion">Pending deletion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Areas</th>
              <th className="px-4 py-3 font-medium">Sites</th>
              <th className="px-4 py-3 font-medium">Admins</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Không có tenant nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {!loading &&
              tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="cursor-pointer border-t hover:bg-muted/40"
                  onClick={() => router.push(`/platform/tenants/${tenant.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(tenant.status)}>
                      {STATUS_LABEL[tenant.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {managementModelLabel(tenant.managementModel)}
                  </td>
                  <td className="px-4 py-3">{tenant.areaCount ?? "—"}</td>
                  <td className="px-4 py-3">{tenant.siteCount}</td>
                  <td className="px-4 py-3">{tenant.tenantAdminCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={(e) => openRename(tenant, e)}>
                        Đổi tên
                      </Button>
                      {tenant.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => openStatus(tenant, "suspended", e)}
                        >
                          <PauseCircle className="mr-1 h-3.5 w-3.5" />
                          Suspend
                        </Button>
                      )}
                      {tenant.status === "suspended" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => openStatus(tenant, "active", e)}
                        >
                          Reactivate
                        </Button>
                      )}
                      {tenant.status !== "pending_deletion" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={(e) => openStatus(tenant, "pending_deletion", e)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalElements} tenant · trang {page + 1}/{Math.max(totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Tên mới</Label>
            <Input
              id="tenant-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={150}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Hủy
            </Button>
            <Button onClick={() => void submitRename()} disabled={saving || !renameValue.trim()}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi trạng thái → {STATUS_LABEL[nextStatus]}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tenant: <span className="font-medium text-foreground">{statusTarget?.name}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="status-reason">Lý do {nextStatus === "pending_deletion" ? "(bắt buộc)" : "(tuỳ chọn)"}</Label>
            <Input
              id="status-reason"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              maxLength={500}
              placeholder="Ghi chú hỗ trợ / audit"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo tenant thủ công</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["tenantName", "Tên tenant *"],
                ["tenantSlug", "Slug (tuỳ chọn)"],
                ["siteName", "Site đầu tiên *"],
                ["siteLocation", "Địa điểm site"],
                ["adminUsername", "Admin username *"],
                ["adminEmail", "Admin email *"],
                ["adminPassword", "Admin password *"],
                ["adminFirstName", "Admin first name"],
                ["adminLastName", "Admin last name"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={key === "adminPassword" ? "password" : key === "adminEmail" ? "email" : "text"}
                  value={createForm[key] ?? ""}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Mô hình quản lý *</Label>
              <Select
                value={createForm.managementModel}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, managementModel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mô hình" />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="areaCount">Số khu vực ước lượng *</Label>
              <Input
                id="areaCount"
                type="number"
                min={1}
                max={999}
                value={createForm.areaCount}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    areaCount: Number.parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Intent only — vẫn chỉ tạo 1 site từ tên site ở trên.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={
                saving ||
                !createForm.tenantName.trim() ||
                !createForm.siteName.trim() ||
                !createForm.managementModel ||
                !createForm.areaCount ||
                !createForm.adminUsername.trim() ||
                !createForm.adminEmail.trim() ||
                !createForm.adminPassword.trim()
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
