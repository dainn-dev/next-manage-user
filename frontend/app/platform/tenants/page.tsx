"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
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

function statusVariant(s: TenantStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default"
  if (s === "suspended") return "secondary"
  if (s === "pending_deletion") return "destructive"
  return "outline"
}

const emptyCreate: TenantOnboardingRequest = {
  tenantName: "", tenantSlug: "", facilityName: "", facilityLocation: "",
  managementModel: "other", areaCount: 1,
  adminUsername: "", adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: "",
}

export default function PlatformTenantsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [stats, setStats] = useState<TenantStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "all">("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<TenantSummary | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameAuditRef, setRenameAuditRef] = useState<string | null>(null)

  // Status dialog
  const [statusTarget, setStatusTarget] = useState<TenantSummary | null>(null)
  const [nextStatus, setNextStatus] = useState<TenantStatus>("suspended")
  const [statusReason, setStatusReason] = useState("")
  const [statusAuditRef, setStatusAuditRef] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<"form" | "review">("form")
  const [createForm, setCreateForm] = useState<TenantOnboardingRequest>(emptyCreate)

  const [saving, setSaving] = useState(false)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      setSearchTerm(value.trim())
    }, 250)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pageData, summary] = await Promise.all([
        tenantApi.list({ page, size: 20, searchTerm: searchTerm || undefined, status: statusFilter }),
        tenantApi.summary(),
      ])
      setTenants(pageData.content)
      setTotalPages(pageData.totalPages)
      setTotalElements(pageData.totalElements)
      setStats(summary)
    } catch {
      toast({ title: "Không tải được danh sách tenant", description: "Lỗi không xác định", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, statusFilter, toast])

  useEffect(() => { void load() }, [load])

  // ─── Rename ───────────────────────────────────────────────────────────────
  const openRename = (t: TenantSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameTarget(t); setRenameValue(t.name); setRenameAuditRef(null)
  }

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    setSaving(true)
    try {
      const res = await tenantApi.rename(renameTarget.id, renameValue.trim())
      setRenameAuditRef(res.auditId ?? null)
      await load()
    } catch (error) {
      toast({ title: "Đổi tên thất bại", description: error instanceof Error ? error.message : "Lỗi không xác định", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ─── Status change ────────────────────────────────────────────────────────
  const openStatus = (t: TenantSummary, status: TenantStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setStatusTarget(t); setNextStatus(status); setStatusReason(""); setStatusAuditRef(null)
  }

  const submitStatus = async () => {
    if (!statusTarget) return
    if (!statusReason.trim()) {
      toast({ title: "Lý do là bắt buộc", description: "Nhập lý do trước khi thay đổi trạng thái.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await tenantApi.updateStatus(statusTarget.id, nextStatus, statusReason.trim())
      setStatusAuditRef(res.auditId ?? null)
      await load()
    } catch (error) {
      toast({ title: "Cập nhật trạng thái thất bại", description: error instanceof Error ? error.message : "Lỗi không xác định", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ─── Create ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateForm(emptyCreate); setCreateStep("form"); setCreateOpen(true)
  }

  const submitCreate = async () => {
    setSaving(true)
    try {
      const payload: TenantOnboardingRequest = {
        ...createForm,
        tenantSlug: createForm.tenantSlug?.trim() || undefined,
        facilityLocation: createForm.facilityLocation?.trim() || undefined,
        adminFirstName: createForm.adminFirstName?.trim() || undefined,
        adminLastName: createForm.adminLastName?.trim() || undefined,
        areaCount: Number(createForm.areaCount) || 1,
      }
      const created = await tenantApi.create(payload)
      setCreateOpen(false)
      setCreateForm(emptyCreate)
      router.push(`/platform/tenants/${created.tenantId}`)
    } catch (error) {
      toast({ title: "Tạo tenant thất bại", description: error instanceof Error ? error.message : "Lỗi không xác định", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const canCreateSubmit = createForm.tenantName.trim() && createForm.facilityName.trim() &&
    createForm.adminUsername.trim() && createForm.adminEmail.trim() && createForm.adminPassword.trim()

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Tenant registry</h1>
          <p className="platform-page-description">
            Quản lý lifecycle tenant trên toàn platform — không truy cập vận hành bãi xe của khách.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}
            data-state={loading ? "loading" : "default"}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
          <Button onClick={openCreate}><Plus aria-hidden="true" />Tạo tenant</Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải tenant registry" : `Đã tải ${totalElements} tenant`}
      </p>

      {/* Stats */}
      <section aria-label="Tenant lifecycle metrics" className={loading ? "platform-stat-strip opacity-70" : "platform-stat-strip"}>
        {[
          { label: "Tổng tenant", value: stats?.total },
          { label: "Active", value: stats?.active },
          { label: "Suspended", value: stats?.suspended },
          { label: "Pending deletion", value: stats?.pendingDeletion },
        ].map(({ label, value }) => (
          <Card key={label} className="platform-stat rounded-none border-0 bg-transparent shadow-none">
            <CardHeader className="p-0"><CardTitle className="platform-stat-label">{label}</CardTitle></CardHeader>
            <CardContent className="platform-stat-value p-0">{value ?? "—"}</CardContent>
          </Card>
        ))}
      </section>

      {/* Filters */}
      <div className="platform-toolbar">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm theo tên hoặc slug…"
            value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setPage(0); setStatusFilter(v as TenantStatus | "all") }}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending_deletion">Pending deletion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="platform-data-surface hidden overflow-x-auto md:block">
        <table className="w-full min-w-[68rem] text-sm">
          <caption className="sr-only">Tenant registry</caption>
          <thead className="text-left text-muted-foreground">
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
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Đang tải…</td></tr>}
            {!loading && tenants.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Không có tenant nào khớp bộ lọc."
                  : "Chưa có tenant nào trên platform."}
              </td></tr>
            )}
            {!loading && tenants.map((t) => (
              <tr key={t.id} className="cursor-pointer hover:bg-muted/40"
                onClick={() => router.push(`/platform/tenants/${t.id}`)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="max-w-[18rem] truncate font-semibold">{t.name}</p>
                      <p className="platform-mono truncate text-xs text-muted-foreground">{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={statusVariant(t.status)}>{STATUS_LABEL[t.status]}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{managementModelLabel(t.managementModel)}</td>
                <td className="px-4 py-3">{t.areaCount ?? "—"}</td>
                <td className="px-4 py-3">{t.siteCount ?? "—"}</td>
                <td className="px-4 py-3">{t.tenantAdminCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.updatedAt ? new Date(t.updatedAt).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => openRename(t, e)}>Đổi tên</Button>
                    {t.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={(e) => openStatus(t, "suspended", e)}>
                        <PauseCircle className="mr-1 h-3.5 w-3.5" />Suspend
                      </Button>
                    )}
                    {t.status === "suspended" && (
                      <Button variant="ghost" size="sm" onClick={(e) => openStatus(t, "active", e)}>Reactivate</Button>
                    )}
                    {t.status !== "pending_deletion" && (
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={(e) => openStatus(t, "pending_deletion", e)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="platform-data-surface md:hidden">
        <div className="platform-mobile-list">
          {loading && <div className="platform-empty-state">Đang tải tenant…</div>}
          {!loading && tenants.length === 0 && (
            <div className="platform-empty-state">Không có tenant nào khớp bộ lọc.</div>
          )}
          {!loading && tenants.map((t) => (
            <article key={t.id} className="platform-mobile-card cursor-pointer"
              onClick={() => router.push(`/platform/tenants/${t.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="platform-mono text-xs text-muted-foreground">{t.slug}</p>
                </div>
                <Badge variant={statusVariant(t.status)} className="shrink-0">{STATUS_LABEL[t.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={(e) => openRename(t, e)}>Đổi tên</Button>
                {t.status === "active" && (
                  <Button variant="ghost" size="sm" onClick={(e) => openStatus(t, "suspended", e)}>Suspend</Button>
                )}
                {t.status === "suspended" && (
                  <Button variant="ghost" size="sm" onClick={(e) => openStatus(t, "active", e)}>Reactivate</Button>
                )}
                {t.status !== "pending_deletion" && (
                  <Button variant="ghost" size="sm" className="text-destructive"
                    onClick={(e) => openStatus(t, "pending_deletion", e)}>Delete</Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">{totalElements} tenants</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trước</Button>
            <span className="flex items-center px-2 text-sm">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sau</Button>
          </div>
        </div>
      )}

      {/* ─── Rename dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameAuditRef(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{renameAuditRef ? "Đã đổi tên" : "Đổi tên tenant"}</DialogTitle></DialogHeader>
          {renameAuditRef ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Tên tenant đã được cập nhật và ghi vào audit log.</p>
              <p className="platform-mono rounded bg-muted px-3 py-2 text-xs">Audit ref: {renameAuditRef}</p>
              <DialogFooter>
                <Button onClick={() => { setRenameTarget(null); setRenameAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rename-value">Tên mới</Label>
                <Input id="rename-value" value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submitRename()} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenameTarget(null)}>Hủy</Button>
                <Button onClick={() => void submitRename()} disabled={saving || !renameValue.trim()}>
                  {saving ? "Đang lưu…" : "Đổi tên"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Status dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => {
        if (!open) { setStatusTarget(null); setStatusReason(""); setStatusAuditRef(null) }
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
                <Button onClick={() => { setStatusTarget(null); setStatusAuditRef(null) }}>Đóng</Button>
              </DialogFooter>
            </div>
          ) : statusTarget && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Thay đổi trạng thái <strong>{statusTarget.name}</strong> sang{" "}
                <Badge variant={statusVariant(nextStatus)}>{STATUS_LABEL[nextStatus]}</Badge>.
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

      {/* ─── Create dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{createStep === "review" ? "Xác nhận tạo tenant" : "Tạo tenant mới"}</DialogTitle>
          </DialogHeader>

          {createStep === "review" ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">Xem lại thông tin trước khi tạo:</p>
              <dl className="space-y-1 rounded-md border border-border p-3">
                {[
                  ["Tên tenant", createForm.tenantName],
                  ["Slug", createForm.tenantSlug || "(tự động)"],
                  ["Facility", createForm.facilityName],
                  ["Location", createForm.facilityLocation || "—"],
                  ["Model", managementModelLabel(createForm.managementModel)],
                  ["Số khu vực dự kiến", String(createForm.areaCount)],
                  ["Admin username", createForm.adminUsername],
                  ["Admin email", createForm.adminEmail],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-40 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="font-medium break-all">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                * Onboarding tạo đúng 1 site ban đầu. <code>areaCount</code> là capacity dự kiến, không tạo thêm zone.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateStep("form")}>Sửa lại</Button>
                <Button onClick={() => void submitCreate()} disabled={saving}>
                  {saving ? "Đang tạo…" : "Tạo tenant"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {[
                { id: "tenantName", label: "Tên tenant *", field: "tenantName" as const },
                { id: "tenantSlug", label: "Slug (tuỳ chọn)", field: "tenantSlug" as const },
                { id: "facilityName", label: "Tên facility/site *", field: "facilityName" as const },
                { id: "facilityLocation", label: "Địa chỉ (tuỳ chọn)", field: "facilityLocation" as const },
                { id: "adminUsername", label: "Admin username *", field: "adminUsername" as const },
                { id: "adminEmail", label: "Admin email *", field: "adminEmail" as const },
                { id: "adminPassword", label: "Admin password *", field: "adminPassword" as const },
                { id: "adminFirstName", label: "First name (tuỳ chọn)", field: "adminFirstName" as const },
                { id: "adminLastName", label: "Last name (tuỳ chọn)", field: "adminLastName" as const },
              ].map(({ id, label, field }) => (
                <div key={id} className="space-y-1">
                  <Label htmlFor={id}>{label}</Label>
                  <Input id={id} type={field === "adminPassword" ? "password" : "text"}
                    value={String(createForm[field] ?? "")}
                    onChange={(e) => setCreateForm(f => ({ ...f, [field]: e.target.value }))}
                    autoComplete={field === "adminPassword" ? "new-password" : "off"}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="managementModel">Management model</Label>
                <Select value={createForm.managementModel}
                  onValueChange={(v) => setCreateForm(f => ({ ...f, managementModel: v }))}>
                  <SelectTrigger id="managementModel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANAGEMENT_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="areaCount">Số khu vực dự kiến</Label>
                <Input id="areaCount" type="number" min={1}
                  value={createForm.areaCount}
                  onChange={(e) => setCreateForm(f => ({ ...f, areaCount: Number(e.target.value) || 1 }))} />
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
                <Button onClick={() => setCreateStep("review")} disabled={!canCreateSubmit}>Xem lại</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
