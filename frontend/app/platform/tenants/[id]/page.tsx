"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, PauseCircle, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { managementModelLabel } from "@/lib/management-models"
import { tenantApi, type TenantDetail, type TenantStatus } from "@/lib/api/tenant-api"
import { platformApi, type PlatformAuditEntry } from "@/lib/api/platform-api"

const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
}

function statusVariant(s: TenantStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default"
  if (s === "suspended") return "secondary"
  if (s === "pending_deletion") return "destructive"
  return "outline"
}

export default function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { toast } = useToast()

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Audit tab
  const [auditRows, setAuditRows] = useState<PlatformAuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // Rename dialog
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [renameAuditRef, setRenameAuditRef] = useState<string | null>(null)

  // Status dialog
  const [statusOpen, setStatusOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<TenantStatus>("suspended")
  const [statusReason, setStatusReason] = useState("")
  const [statusAuditRef, setStatusAuditRef] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setTenant(await tenantApi.get(id))
    } catch {
      toast({ title: "Không tải được tenant", description: "Hãy thử lại.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { void load() }, [load])

  // Lazy-load audit when the tab is first opened
  const loadAudit = useCallback(async () => {
    if (!id) return
    setAuditLoading(true)
    try {
      const res = await platformApi.listAudit({ page: 0, size: 30, resourceType: "tenant", resourceId: id })
      setAuditRows(res.content)
      setAuditLoaded(true)
    } catch {
      toast({ title: "Không tải được audit log", variant: "destructive" })
    } finally {
      setAuditLoading(false)
    }
  }, [id, toast])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === "audit" && !auditLoaded) {
      void loadAudit()
    }
  }

  // ─── Rename ───────────────────────────────────────────────────────────────
  const openRename = () => {
    setRenameValue(tenant?.name ?? "")
    setRenameAuditRef(null)
    setRenameOpen(true)
  }

  const submitRename = async () => {
    if (!renameValue.trim()) return
    setSaving(true)
    try {
      const res = await tenantApi.rename(id, renameValue.trim())
      setRenameAuditRef(res.auditId ?? null)
      setTenant(res.tenant)
    } catch (error) {
      toast({ title: "Đổi tên thất bại", description: error instanceof Error ? error.message : "Lỗi không xác định", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ─── Status change ────────────────────────────────────────────────────────
  const openStatus = (status: TenantStatus) => {
    setNextStatus(status); setStatusReason(""); setStatusAuditRef(null); setStatusOpen(true)
  }

  const submitStatus = async () => {
    if (!statusReason.trim()) {
      toast({ title: "Lý do là bắt buộc", description: "Nhập lý do trước khi thay đổi trạng thái.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await tenantApi.updateStatus(id, nextStatus, statusReason.trim())
      setStatusAuditRef(res.auditId ?? null)
      setTenant(res.tenant)
    } catch (error) {
      toast({ title: "Cập nhật trạng thái thất bại", description: error instanceof Error ? error.message : "Lỗi không xác định", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="platform-page">
        <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground sm:px-6">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
          Đang tải thông tin tenant…
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="platform-page">
        <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
          Không tìm thấy tenant. <Link href="/platform/tenants" className="underline">Quay lại danh sách</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="platform-page">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 pb-1 text-sm text-muted-foreground sm:px-6">
        <Link href="/platform/tenants" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Tenant registry
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground font-medium truncate">{tenant.name}</span>
      </div>

      {/* Header */}
      <header className="platform-page-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="platform-page-title">{tenant.name}</h1>
            <Badge variant={statusVariant(tenant.status)}>{STATUS_LABEL[tenant.status]}</Badge>
          </div>
          <p className="platform-mono text-xs text-muted-foreground mt-1">{tenant.slug}</p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}
            data-state={loading ? "loading" : "default"}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            Làm mới
          </Button>
          <Button variant="outline" onClick={openRename}>Đổi tên</Button>
          {tenant.status === "active" && (
            <Button variant="outline" onClick={() => openStatus("suspended")}>
              <PauseCircle className="mr-1 h-4 w-4" />Suspend
            </Button>
          )}
          {tenant.status === "suspended" && (
            <Button variant="outline" onClick={() => openStatus("active")}>Reactivate</Button>
          )}
          {tenant.status !== "pending_deletion" && (
            <Button variant="destructive" onClick={() => openStatus("pending_deletion")}>
              <Trash2 className="mr-1 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="px-4 sm:px-6">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="admins">Admins ({tenant.tenantAdmins.length})</TabsTrigger>
          <TabsTrigger value="sites">Sites ({tenant.sites.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="platform-data-surface">
            <div className="border-b border-border px-4 py-3 sm:px-6">
              <h2 className="font-semibold">Thông tin tenant</h2>
            </div>
            <dl className="divide-y divide-border text-sm">
              {[
                ["Tên", tenant.name],
                ["Slug", tenant.slug],
                ["Trạng thái", STATUS_LABEL[tenant.status]],
                ["Model quản lý", managementModelLabel(tenant.managementModel)],
                ["Số khu vực dự kiến", tenant.areaCount != null ? String(tenant.areaCount) : "—"],
                ["Ngày tạo", new Date(tenant.createdAt).toLocaleString("vi-VN")],
                ["Cập nhật lần cuối", new Date(tenant.updatedAt).toLocaleString("vi-VN")],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-2 px-4 py-3 sm:px-6">
                  <dt className="w-44 shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="font-medium break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsContent>

        {/* Admins */}
        <TabsContent value="admins" className="mt-4">
          <div className="platform-data-surface overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Tenant admin directory</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">Username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody>
                {tenant.tenantAdmins.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    Chưa có tenant admin nào.
                  </td></tr>
                )}
                {tenant.tenantAdmins.map((admin) => (
                  <tr key={admin.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium sm:px-6">{admin.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{admin.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {admin.fullName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {admin.status ? (
                        <Badge variant={admin.status === "ACTIVE" ? "default" : "secondary"}>
                          {admin.status}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Sites */}
        <TabsContent value="sites" className="mt-4">
          <div className="platform-data-surface overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Tenant sites</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">Tên site</th>
                  <th className="px-4 py-3 font-medium">Địa chỉ</th>
                  <th className="px-4 py-3 font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {tenant.sites.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-10 text-center text-muted-foreground">
                    Tenant chưa có site nào.
                  </td></tr>
                )}
                {tenant.sites.map((site) => (
                  <tr key={site.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium sm:px-6">{site.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{site.location || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {site.createdAt ? new Date(site.createdAt).toLocaleDateString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="mt-4">
          <div className="platform-data-surface overflow-x-auto">
            {auditLoading && (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
                Đang tải audit log…
              </div>
            )}
            {!auditLoading && auditLoaded && (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
                  <p className="text-sm text-muted-foreground">{auditRows.length} entry gần nhất</p>
                  <Button variant="ghost" size="sm" onClick={() => void loadAudit()}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />Làm mới
                  </Button>
                </div>
                <table className="w-full min-w-[44rem] text-sm">
                  <caption className="sr-only">Tenant audit log</caption>
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-6">Time</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                        Chưa có audit entry cho tenant này.
                      </td></tr>
                    )}
                    {auditRows.map((entry) => (
                      <tr key={entry.id} className="border-t border-border">
                        <td className="px-4 py-3 text-muted-foreground sm:px-6 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3">
                          {entry.actorUsername || (entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—")}
                        </td>
                        <td className="platform-mono px-4 py-3 text-xs font-medium">{entry.action}</td>
                        <td className="px-4 py-3">
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Xem</summary>
                            <pre className="platform-mono mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all text-xs">
                              {entry.detail ? JSON.stringify(JSON.parse(entry.detail), null, 2) : "{}"}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Rename dialog ─────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={(open) => { if (!open) { setRenameOpen(false); setRenameAuditRef(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{renameAuditRef ? "Đã đổi tên" : "Đổi tên tenant"}</DialogTitle></DialogHeader>
          {renameAuditRef ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Tên tenant đã được cập nhật và ghi vào audit log.</p>
              <p className="platform-mono rounded bg-muted px-3 py-2 text-xs">Audit ref: {renameAuditRef}</p>
              <DialogFooter>
                <Button onClick={() => { setRenameOpen(false); setRenameAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rename-val">Tên mới</Label>
                <Input id="rename-val" value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submitRename()} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenameOpen(false)}>Hủy</Button>
                <Button onClick={() => void submitRename()} disabled={saving || !renameValue.trim()}>
                  {saving ? "Đang lưu…" : "Đổi tên"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Status dialog ─────────────────────────────────────────────────── */}
      <Dialog open={statusOpen} onOpenChange={(open) => {
        if (!open) { setStatusOpen(false); setStatusReason(""); setStatusAuditRef(null) }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAuditRef ? "Đã cập nhật trạng thái" : `${STATUS_LABEL[nextStatus]} tenant`}
            </DialogTitle>
          </DialogHeader>
          {statusAuditRef ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Trạng thái đã được cập nhật và ghi vào audit log.</p>
              <p className="platform-mono rounded bg-muted px-3 py-2 text-xs">Audit ref: {statusAuditRef}</p>
              <DialogFooter>
                <Button onClick={() => { setStatusOpen(false); setStatusAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Thay đổi trạng thái <strong>{tenant.name}</strong> sang{" "}
                <Badge variant={statusVariant(nextStatus)}>{STATUS_LABEL[nextStatus]}</Badge>.
              </p>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Hành động này không ảnh hưởng đến vận hành bãi xe của tenant.
              </div>
              <div className="space-y-1">
                <Label htmlFor="detail-status-reason">Lý do <span className="text-destructive">*</span></Label>
                <textarea
                  id="detail-status-reason"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                  placeholder="Nhập lý do (bắt buộc)…"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setStatusOpen(false); setStatusReason("") }}>Hủy</Button>
                <Button
                  onClick={() => void submitStatus()}
                  disabled={saving || !statusReason.trim()}
                  variant={nextStatus === "pending_deletion" ? "destructive" : "default"}
                >
                  {saving ? "Đang cập nhật…" : STATUS_LABEL[nextStatus]}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
