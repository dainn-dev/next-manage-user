/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 * page: billing · data-form: KPI strip + responsive subscription ledger · enrichment: none
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
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

function billingTone(status: string): "good" | "warning" | "serious" | "critical" {
  if (status === "active" || status === "trialing") return "good"
  if (status === "past_due" || status === "paused") return "warning"
  if (status === "unpaid" || status === "incomplete") return "serious"
  return "critical"
}

export default function PlatformBillingPage() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<PlatformBillingSummary | null>(null)
  const [rows, setRows] = useState<PlatformSubscription[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0)
      setSearchTerm(searchInput.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
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
    } catch (error) {
      toast({
        title: "Không tải được billing",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  const statusEntries = Object.entries(summary?.byStatus ?? {})
  const tenantCount = (summary?.withSubscription ?? 0) + (summary?.withoutSubscription ?? 0)
  const pastDue = summary?.byStatus?.past_due ?? 0

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
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            data-state={loading ? "loading" : "default"}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải billing" : `Đã tải ${totalElements} billing record`}
      </p>

      <section aria-label="Billing metrics" className={loading ? "platform-stat-strip opacity-70" : "platform-stat-strip"}>
        <div className="platform-stat">
          <p className="platform-stat-label">Tenant records</p>
          <p className="platform-stat-value">{summary ? tenantCount : "—"}</p>
          <p className="platform-stat-note">trong billing summary</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Subscriptions linked</p>
          <p className="platform-stat-value">{summary?.withSubscription ?? "—"}</p>
          <p className="platform-stat-note">có Stripe subscription</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Without subscription</p>
          <p className="platform-stat-value">{summary?.withoutSubscription ?? "—"}</p>
          <p className="platform-stat-note">free hoặc default plan</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Past due</p>
          <p className="platform-stat-value">{summary ? pastDue : "—"}</p>
          <p className="platform-stat-note">cần kiểm tra billing state</p>
        </div>
      </section>

      {statusEntries.length > 0 && (
        <section aria-label="Subscription status summary" className="flex flex-wrap gap-2">
          {statusEntries.map(([status, count]) => (
            <span key={status} className="platform-status" data-tone={billingTone(status)}>
              {status}: {count}
            </span>
          ))}
        </section>
      )}

      <div className="platform-toolbar">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            aria-label="Tìm tenant trong billing"
            placeholder="Tìm tenant…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setPage(0)
            setStatusFilter(value)
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Lọc subscription status">
            <SelectValue placeholder="Subscription status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả status</SelectItem>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="trialing">trialing</SelectItem>
            <SelectItem value="past_due">past_due</SelectItem>
            <SelectItem value="canceled">canceled</SelectItem>
            <SelectItem value="unpaid">unpaid</SelectItem>
            <SelectItem value="paused">paused</SelectItem>
            <SelectItem value="incomplete">incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section aria-label="Subscription records" className="platform-data-surface">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[54rem] text-sm">
            <caption className="sr-only">Cross-tenant subscription records</caption>
            <thead className="text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">Tenant</th>
                <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                <th scope="col" className="px-4 py-3 font-medium">Sub status</th>
                <th scope="col" className="px-4 py-3 font-medium">Period end</th>
                <th scope="col" className="px-4 py-3 text-right font-medium sm:pr-6">Lifecycle</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-70" : undefined}>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Không có billing record khớp bộ lọc.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.tenantId}>
                  <td className="px-4 py-3 sm:px-6">
                    <div className="font-semibold">{row.tenantName}</div>
                    <div className="platform-mono mt-1 text-xs text-muted-foreground">{row.tenantSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.planName || "—"}
                    <div className="platform-mono mt-1 text-xs text-muted-foreground">{row.planCode || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="platform-status" data-tone={billingTone(row.subscriptionStatus)}>
                      {row.subscriptionStatus}
                    </span>
                    {row.cancelAtPeriodEnd && (
                      <div className="mt-2 text-xs text-muted-foreground">cancel at period end</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-6">
                    <Button asChild variant="ghost">
                      <Link href={`/platform/tenants/${row.tenantId}`}>
                        Tenant
                        <ExternalLink aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="platform-mobile-list md:hidden">
          {!loading && rows.length === 0 && (
            <div className="platform-empty-state">Không có billing record khớp bộ lọc.</div>
          )}
          {rows.map((row) => (
            <article key={row.tenantId} className="platform-mobile-card">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{row.tenantName}</h2>
                  <p className="platform-mono mt-1 truncate text-xs text-muted-foreground">{row.tenantSlug}</p>
                </div>
                <span className="platform-status" data-tone={billingTone(row.subscriptionStatus)}>
                  {row.subscriptionStatus}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Plan</dt>
                  <dd className="mt-1 font-medium">{row.planName || row.planCode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Period end</dt>
                  <dd className="mt-1 text-xs">
                    {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString("vi-VN") : "—"}
                  </dd>
                </div>
              </dl>
              <Button asChild variant="outline" className="w-fit">
                <Link href={`/platform/tenants/${row.tenantId}`}>
                  Mở tenant
                  <ExternalLink aria-hidden="true" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <div className="platform-pagination">
        <span>{totalElements} record · trang {page + 1}/{Math.max(totalPages, 1)}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Trước
          </Button>
          <Button variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  )
}
