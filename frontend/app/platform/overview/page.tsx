"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Building2, CreditCard, RefreshCw, ScrollText, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { platformApi, type PlatformAuditEntry, type PlatformBillingSummary } from "@/lib/api/platform-api"
import type { TenantStatistics } from "@/lib/api/tenant-api"

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-2 py-1">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-12 rounded bg-muted" />
      <div className="h-3 w-32 rounded bg-muted" />
    </div>
  )
}

function PanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <span>Lỗi tải</span>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}

function AuditTableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 px-6 py-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-6">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export default function PlatformOverviewPage() {
  // Each panel has its own loading / error / data state
  const [tenants, setTenants] = useState<TenantStatistics | null>(null)
  const [tenantsLoading, setTenantsLoading] = useState(true)
  const [tenantsError, setTenantsError] = useState(false)

  const [billing, setBilling] = useState<PlatformBillingSummary | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError] = useState(false)

  const [adminCount, setAdminCount] = useState<number | null>(null)
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState(false)

  const [recentAudit, setRecentAudit] = useState<PlatformAuditEntry[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState(false)

  const loadTenantsBillingAdmins = useCallback(async () => {
    setTenantsLoading(true); setTenantsError(false)
    setBillingLoading(true); setBillingError(false)
    setAdminLoading(true); setAdminError(false)
    try {
      const overview = await platformApi.overview()
      setTenants(overview.tenants)
      setBilling(overview.billing)
      setAdminCount(overview.platformAdminCount)
    } catch {
      setTenantsError(true)
      setBillingError(true)
      setAdminError(true)
    } finally {
      setTenantsLoading(false); setBillingLoading(false); setAdminLoading(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    setAuditLoading(true); setAuditError(false)
    try {
      const res = await platformApi.listAudit({ page: 0, size: 8 })
      setRecentAudit(res.content)
    } catch {
      setAuditError(true)
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTenantsBillingAdmins()
    void loadAudit()
  }, [loadTenantsBillingAdmins, loadAudit])

  const refreshAll = () => {
    void loadTenantsBillingAdmins()
    void loadAudit()
  }

  const anyLoading = tenantsLoading || billingLoading || adminLoading || auditLoading

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Platform overview</h1>
          <p className="platform-page-description">
            Trạng thái control plane — tenant lifecycle, subscription coverage và quyền platform admin.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={anyLoading}
            data-state={anyLoading ? "loading" : "default"}
          >
            <RefreshCw className={anyLoading ? "animate-spin" : undefined} aria-hidden="true" />
            {anyLoading ? "Đang tải" : "Làm mới"}
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {anyLoading ? "Đang cập nhật chỉ số platform" : "Đã cập nhật chỉ số platform"}
      </p>

      {/* Stat panels — each loads and fails independently */}
      <section aria-label="Platform metrics" className="platform-stat-strip">
        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Tenants active</p>
          </div>
          {tenantsLoading ? <PanelSkeleton /> : tenantsError ? (
            <PanelError onRetry={loadTenantsBillingAdmins} />
          ) : (
            <>
              <p className="platform-stat-value">{tenants?.active ?? 0}</p>
              <p className="platform-stat-note">
                {(tenants?.total ?? 0) === 0 ? "Chưa có tenant nào" : `trên ${tenants?.total} tenant`}
              </p>
            </>
          )}
        </div>

        <div className="platform-stat">
          <p className="platform-stat-label">Suspended tenants</p>
          {tenantsLoading ? <PanelSkeleton /> : tenantsError ? (
            <PanelError onRetry={loadTenantsBillingAdmins} />
          ) : (
            <>
              <p className="platform-stat-value">{tenants?.suspended ?? 0}</p>
              <p className="platform-stat-note">
                {(tenants?.suspended ?? 0) === 0 ? "Không có tenant bị suspend" : "cần theo dõi lifecycle"}
              </p>
            </>
          )}
        </div>

        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Subscriptions linked</p>
          </div>
          {billingLoading ? <PanelSkeleton /> : billingError ? (
            <PanelError onRetry={loadTenantsBillingAdmins} />
          ) : (
            <>
              <p className="platform-stat-value">{billing?.withSubscription ?? 0}</p>
              <p className="platform-stat-note">
                {(billing?.withoutSubscription ?? 0) === 0
                  ? "Tất cả đã gắn subscription"
                  : `${billing?.withoutSubscription} chưa gắn subscription`}
              </p>
            </>
          )}
        </div>

        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Platform admins</p>
          </div>
          {adminLoading ? <PanelSkeleton /> : adminError ? (
            <PanelError onRetry={loadTenantsBillingAdmins} />
          ) : (
            <>
              <p className="platform-stat-value">{adminCount ?? 0}</p>
              <p className="platform-stat-note">
                {(adminCount ?? 0) === 0 ? "Chưa có platform admin" : "tài khoản control-plane"}
              </p>
            </>
          )}
        </div>
      </section>

      <nav aria-label="Platform shortcuts" className="platform-toolbar">
        <span className="px-2 text-xs font-semibold text-muted-foreground">Đi tới</span>
        <Button asChild variant="ghost"><Link href="/platform/tenants">Tenants</Link></Button>
        <Button asChild variant="ghost"><Link href="/platform/billing">Billing</Link></Button>
        <Button asChild variant="ghost"><Link href="/platform/admins">Admins</Link></Button>
        <Button asChild variant="ghost">
          <Link href="/platform/audit"><ScrollText aria-hidden="true" />Audit</Link>
        </Button>
      </nav>

      <section aria-labelledby="recent-activity-heading" className="platform-data-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 id="recent-activity-heading" className="text-lg font-bold tracking-[-0.02em]">
              Hoạt động gần đây
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Các thay đổi mới nhất trên control plane.</p>
          </div>
          <Button asChild variant="link" className="px-0">
            <Link href="/platform/audit">Mở audit log</Link>
          </Button>
        </div>

        {auditLoading && <AuditTableSkeleton />}

        {!auditLoading && auditError && (
          <div className="flex items-center gap-3 px-6 py-8 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>Không tải được dữ liệu audit.</span>
            <Button variant="ghost" size="sm" onClick={loadAudit}>Thử lại</Button>
          </div>
        )}

        {!auditLoading && !auditError && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] text-sm">
                <caption className="sr-only">Các hoạt động platform gần đây</caption>
                <thead className="text-left">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium sm:px-6">Time</th>
                    <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                    <th scope="col" className="px-4 py-3 font-medium">Action</th>
                    <th scope="col" className="px-4 py-3 font-medium sm:pr-6">Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudit?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                        Chưa có audit entry. Các thay đổi platform sẽ xuất hiện ở đây.
                      </td>
                    </tr>
                  )}
                  {recentAudit?.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-muted-foreground sm:px-6">
                        {new Date(entry.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-4 py-3">
                        {entry.actorUsername || (entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—")}
                      </td>
                      <td className="platform-mono px-4 py-3 text-xs font-medium">{entry.action}</td>
                      <td className="px-4 py-3 text-muted-foreground sm:pr-6">
                        {entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="platform-mobile-list md:hidden">
              {recentAudit?.length === 0 && (
                <div className="platform-empty-state">
                  <ScrollText className="size-5" aria-hidden="true" />
                  <p>Chưa có audit entry. Các thay đổi platform sẽ xuất hiện ở đây.</p>
                </div>
              )}
              {recentAudit?.map((entry) => (
                <article key={entry.id} className="platform-mobile-card">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="platform-mono truncate text-xs font-semibold">{entry.action}</p>
                      <p className="mt-1 truncate text-sm">
                        {entry.actorUsername || (entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—")}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                    </time>
                  </div>
                  <p className="break-words text-xs text-muted-foreground">
                    {entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
