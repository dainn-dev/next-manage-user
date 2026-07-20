"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, ExternalLink, PauseCircle, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { managementModelLabel } from "@/lib/management-models"
import { tenantApi, type TenantDetail, type TenantStatus } from "@/lib/api/tenant-api"

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
}

const STATUS_TONE: Record<TenantStatus, "good" | "serious" | "critical"> = {
  active: "good",
  suspended: "serious",
  pending_deletion: "critical",
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
        description: error instanceof Error ? error.message : "Hãy thử lại.",
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
    } catch (error) {
      toast({
        title: "Đổi tên thất bại",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
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
    } catch (error) {
      toast({
        title: "Cập nhật trạng thái thất bại",
        description: error instanceof Error ? error.message : "Kiểm tra lý do và thử lại.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const openStatusDialog = (status: TenantStatus) => {
    setNextStatus(status)
    setStatusReason("")
    setStatusOpen(true)
  }

  if (loading || !tenant) {
    return (
      <div className="platform-page" aria-live="polite">
        <div className="platform-empty-state min-h-[40vh]">
          <p>Đang tải tenant…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-3">
            <Button asChild variant="link" className="h-auto px-0 text-muted-foreground">
              <Link href="/platform/tenants">
                <ArrowLeft aria-hidden="true" />
                Tenants
              </Link>
            </Button>
          </nav>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="platform-page-title">{tenant.name}</h1>
            <span className="platform-status" data-tone={STATUS_TONE[tenant.status]}>
              {STATUS_LABEL[tenant.status]}
            </span>
          </div>
          <p className="platform-page-description platform-mono mt-2 break-all">{tenant.slug}</p>
          <p className="platform-page-description mt-2">
            {managementModelLabel(tenant.managementModel)} · khai báo {tenant.areaCount ?? "—"} khu vực · 1 bãi xe vận hành
          </p>
        </div>

        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Làm mới
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRenameValue(tenant.name)
              setRenameOpen(true)
            }}
          >
            Đổi tên
          </Button>
          {tenant.status === "active" && (
            <Button variant="outline" onClick={() => openStatusDialog("suspended")}>
              <PauseCircle aria-hidden="true" />
              Suspend
            </Button>
          )}
          {tenant.status === "suspended" && (
            <Button variant="outline" onClick={() => openStatusDialog("active")}>
              Reactivate
            </Button>
          )}
          {tenant.status !== "pending_deletion" && (
            <Button variant="destructive" onClick={() => openStatusDialog("pending_deletion")}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        Tenant {tenant.name} đang ở trạng thái {STATUS_LABEL[tenant.status]}.
      </p>

      <Tabs defaultValue="overview" className="min-w-0 gap-5">
        <div className="pb-1">
          <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 justify-start rounded-[var(--radius-card)] border border-border bg-card p-1 [&_[data-slot=tabs-trigger]]:min-w-0 [&_[data-slot=tabs-trigger]]:px-2 [&_[data-slot=tabs-trigger]]:text-xs [&_[data-slot=tabs-trigger]:last-child]:col-span-2 sm:grid-cols-5 sm:[&_[data-slot=tabs-trigger]]:px-2 sm:[&_[data-slot=tabs-trigger]]:text-sm sm:[&_[data-slot=tabs-trigger]:last-child]:col-span-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sites">Bãi xe vận hành</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="admins">Admin contacts</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="platform-data-surface p-4 sm:p-6">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Registration profile</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Management model</dt>
              <dd className="mt-1 text-sm font-semibold">{managementModelLabel(tenant.managementModel)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Area count intent</dt>
              <dd className="mt-1 text-sm font-semibold">{tenant.areaCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-sm">{new Date(tenant.createdAt).toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Updated</dt>
              <dd className="mt-1 text-sm">{new Date(tenant.updatedAt).toLocaleString("vi-VN")}</dd>
            </div>
          </dl>
          <p className="mt-6 max-w-3xl border-t border-border pt-4 text-sm text-muted-foreground">
            Area count mô tả quy mô lúc đăng ký; mỗi tenant được giới hạn một bãi xe vận hành.
          </p>
        </TabsContent>

        <TabsContent value="sites" className="platform-data-surface">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Bãi xe vận hành</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tenant chỉ có một bãi xe vận hành và không thể thêm chi nhánh khác.</p>
          </div>
          {tenant.sites.length === 0 ? (
            <div className="platform-empty-state">Chưa có bãi xe vận hành trong tenant này.</div>
          ) : (
            <div className="platform-mobile-list">
              {tenant.sites.map((site) => (
                <article key={site.id} className="platform-mobile-card sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)] sm:items-center">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{site.name}</h3>
                    <p className="platform-mono mt-1 truncate text-xs text-muted-foreground">{site.id}</p>
                  </div>
                  <p className="text-sm text-muted-foreground sm:text-right">{site.location || "Chưa khai báo vị trí"}</p>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscription" className="platform-data-surface p-4 sm:p-6">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Subscription</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Billing là nguồn dữ liệu cross-tenant cho plan, trạng thái subscription và kỳ hiện tại.
          </p>
          <Button asChild className="mt-5">
            <Link href={`/platform/billing?search=${encodeURIComponent(tenant.slug)}`}>
              Mở billing record
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        </TabsContent>

        <TabsContent value="admins" className="platform-data-surface">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Admin contacts ({tenant.tenantAdmins.length})</h2>
            <p className="mt-1 text-sm text-muted-foreground">Các tenant admin hiện được gắn với tenant.</p>
          </div>
          {tenant.tenantAdmins.length === 0 ? (
            <div className="platform-empty-state">Chưa có tenant admin.</div>
          ) : (
            <div className="platform-mobile-list">
              {tenant.tenantAdmins.map((admin) => (
                <article key={admin.id} className="platform-mobile-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{admin.fullName || admin.username}</h3>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{admin.email}</p>
                  </div>
                  <Badge variant="outline" className="w-fit">{admin.status || "Unknown"}</Badge>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="platform-data-surface p-4 sm:p-6">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Tenant audit</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mở audit log ở phạm vi tenant resource. Resource ID đầy đủ vẫn hiển thị trong từng entry.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/platform/audit?resourceType=tenant">
              Mở audit log
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        </TabsContent>
      </Tabs>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tenant</DialogTitle>
            <DialogDescription>Tên mới sẽ xuất hiện trong registry và các liên kết control-plane.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">Tên mới</Label>
            <Input
              id="rename"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              aria-required="true"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Hủy</Button>
            <Button
              onClick={() => void submitRename()}
              disabled={saving || !renameValue.trim()}
              data-state={saving ? "loading" : "default"}
            >
              {saving ? "Đang lưu" : "Lưu tên"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi trạng thái → {STATUS_LABEL[nextStatus]}</DialogTitle>
            <DialogDescription>
              Xác nhận tenant, hệ quả và lý do trước khi cập nhật lifecycle.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-serious)]" aria-hidden="true" />
              <div>
                <p className="font-semibold">{tenant.name}</p>
                <p className="mt-1 text-muted-foreground">
                  {nextStatus === "active" && "Khôi phục quyền truy cập tenant theo trạng thái active."}
                  {nextStatus === "suspended" && "Tạm dừng tenant; hoạt động tenant có thể bị giới hạn."}
                  {nextStatus === "pending_deletion" && "Đánh dấu tenant chờ xoá. Đây là thay đổi lifecycle có mức ảnh hưởng cao."}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">
              Lý do {nextStatus === "pending_deletion" ? "(bắt buộc)" : "(tuỳ chọn)"}
            </Label>
            <Input
              id="reason"
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Ghi chú hỗ trợ hoặc audit"
              aria-required={nextStatus === "pending_deletion"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Hủy</Button>
            <Button
              variant={nextStatus === "pending_deletion" ? "destructive" : "default"}
              onClick={() => void submitStatus()}
              disabled={saving || (nextStatus === "pending_deletion" && !statusReason.trim())}
              data-state={saving ? "loading" : "default"}
            >
              {saving ? "Đang cập nhật" : `Xác nhận ${STATUS_LABEL[nextStatus]}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
