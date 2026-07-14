"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, AlertTriangle, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  platformApi,
  type PlatformBillingSummary,
  type PlatformSubscription,
} from "@/lib/api/platform-api"

type ExceptionLevel = "normal" | "attention" | "action_required"

function exceptionLevel(row: PlatformSubscription): ExceptionLevel {
  const s = row.subscriptionStatus
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "action_required"
  if (row.cancelAtPeriodEnd || s === "paused") return "attention"
  return "normal"
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") return "default"
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "destructive"
  return "secondary"
}

export default function PlatformBillingPage() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<PlatformBillingSummary | null>(null)
  const [rows, setRows] = useState<PlatformSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("search") || ""
    setSearchInput(query)
    setSearchTerm(query)
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0)
      setSearchTerm(searchInput.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const [pageData, billingSummary] = await Promise.all([
        platformApi.listSubscriptions({
          page,
          size: 20,
          searchTerm: searchTerm || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        platformApi.billingSummary(),
      ])
      setRows(pageData.content)
      setTotalPages(pageData.totalPages)
      setTotalElements(pageData.totalElements)
      setSummary(billingSummary)
    } catch {
      setHasError(true)
      toast({ title: "Không tải được billing", description: "Hãy thử lại.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, statusFilter, toast])

  useEffect(() => { void load() }, [load])

  const actionRequired = rows.filter(r => exceptionLevel(r) === "action_required")
  const statusEntries = Object.entries(summary?.byStatus ?? {})

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Cross-tenant billing</h1>
          <p className="platform-page-description">
            Theo dõi subscription trên toàn platform. Stripe portal và phương thức thanh toán vẫn thuộc tenant admin.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}
            data-state={loading ? "loading" : "default"}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải billing" : `${totalElements} subscription record`}
      </p>

      {/* Unavailable state — never show stale as healthy */}
      {!loading && hasError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2 mx-0">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Không tải được dữ liệu billing. Dữ liệu hiển thị có thể không còn chính xác.
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void load()}>Thử lại</Button>
        </div>
      )}

      {/* Action-required banner */}
      {!loading && !hasError && actionRequired.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{actionRequired.length}</strong> subscription cần xử lý (past_due / unpaid / incomplete).
          </span>
        </div>
      )}

      {/* Summary stats */}
      <section aria-label="Billing summary" className={loading ? "platform-stat-strip opacity-70" : "platform-stat-strip"}>
        <div className="platform-stat">
          <p className="platform-stat-label">Tenant records</p>
          <p className="platform-stat-value">{hasError ? "—" : (summary?.withSubscription ?? 0) + (summary?.withoutSubscription ?? 0)}</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Linked subscriptions</p>
          <p className="platform-stat-value">{hasError ? "—" : summary?.withSubscription ?? 0}</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Without subscription</p>
          <p className="platform-stat-value">{hasError ? "—" : summary?.withoutSubscription ?? 0}</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Past due</p>
          <p className="platform-stat-value">{hasError ? "—" : summary?.byStatus?.past_due ?? 0}</p>
          {(summary?.byStatus?.past_due ?? 0) > 0 && (
            <p className="platform-stat-note text-amber-600">cần kiểm tra</p>
          )}
        </div>
      </section>

      {/* Status breakdown chips */}
      {!hasError && statusEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-6">
          {statusEntries.map(([status, count]) => (
            <Badge key={status} variant={statusBadgeVariant(status)} className="gap-1 font-mono text-xs">
              {status} · {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="platform-toolbar">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Tìm theo tên hoặc slug tenant…"
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setPage(0); setStatusFilter(v) }}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="trialing">trialing</SelectItem>
            <SelectItem value="past_due">past_due</SelectItem>
            <SelectItem value="unpaid">unpaid</SelectItem>
            <SelectItem value="incomplete">incomplete</SelectItem>
            <SelectItem value="canceled">canceled</SelectItem>
            <SelectItem value="none">none (no subscription)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="platform-data-surface hidden overflow-x-auto md:block">
        <table className="w-full min-w-[62rem] text-sm">
          <caption className="sr-only">Cross-tenant subscription list</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Tenant status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Subscription</th>
              <th className="px-4 py-3 font-medium">Period end</th>
              <th className="px-4 py-3 font-medium">Past due since</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Đang tải…</td></tr>
            )}
            {!loading && rows.length === 0 && !hasError && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                Không có subscription nào khớp bộ lọc.
              </td></tr>
            )}
            {!loading && rows.map((row) => {
              const level = exceptionLevel(row)
              return (
                <tr key={row.tenantId}
                  className={level === "action_required" ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                  <td className="px-4 py-3">
                    <Link href={`/platform/tenants/${row.tenantId}`}
                      className="font-medium hover:underline">{row.tenantName}</Link>
                    <div className="platform-mono text-xs text-muted-foreground">{row.tenantSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.tenantStatus === "active" ? "default" : "secondary"}>
                      {row.tenantStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.planName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(row.subscriptionStatus)}>
                      {row.subscriptionStatus}
                    </Badge>
                    {row.cancelAtPeriodEnd && (
                      <span className="ml-2 text-xs text-amber-600">cancel at period end</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.pastDueSince ? (
                      <span className="text-amber-600 font-medium">
                        {new Date(row.pastDueSince).toLocaleDateString("vi-VN")}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="platform-data-surface md:hidden">
        <div className="platform-mobile-list">
          {loading && <div className="platform-empty-state">Đang tải…</div>}
          {!loading && rows.length === 0 && !hasError && (
            <div className="platform-empty-state">Không có subscription nào khớp bộ lọc.</div>
          )}
          {!loading && rows.map((row) => {
            const level = exceptionLevel(row)
            return (
              <article key={row.tenantId} className="platform-mobile-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/platform/tenants/${row.tenantId}`} className="font-semibold hover:underline">
                      {row.tenantName}
                    </Link>
                    <div className="platform-mono text-xs text-muted-foreground">{row.tenantSlug}</div>
                  </div>
                  <Badge variant={statusBadgeVariant(row.subscriptionStatus)}>{row.subscriptionStatus}</Badge>
                </div>
                {level === "action_required" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Cần xử lý
                  </p>
                )}
                {row.pastDueSince && (
                  <p className="text-xs text-amber-600">
                    Past due từ: {new Date(row.pastDueSince).toLocaleDateString("vi-VN")}
                  </p>
                )}
                {row.cancelAtPeriodEnd && (
                  <p className="text-xs text-amber-600">Sẽ hủy khi hết kỳ</p>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">{totalElements} records</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trước</Button>
            <span className="flex items-center px-2 text-sm">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sau</Button>
          </div>
        </div>
      )}
    </div>
  )
}
