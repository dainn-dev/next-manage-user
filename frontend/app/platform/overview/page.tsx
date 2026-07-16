"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Building2, CreditCard, RefreshCw, ScrollText, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { platformApi, type PlatformOverview } from "@/lib/api/platform-api"
import { useToast } from "@/hooks/use-toast"

export default function PlatformOverviewPage() {
  const { toast } = useToast()
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await platformApi.overview())
    } catch (error) {
      toast({
        title: "Không tải được overview",
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

  const recentAudit = data?.recentAudit ?? []

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
        {loading ? "Đang cập nhật chỉ số platform" : "Đã cập nhật chỉ số platform"}
      </p>

      <section aria-label="Platform metrics" className={loading ? "platform-stat-strip opacity-70" : "platform-stat-strip"}>
        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Tenants active</p>
          </div>
          <p className="platform-stat-value">{data?.tenants.active ?? "—"}</p>
          <p className="platform-stat-note">trên {data?.tenants.total ?? "—"} tenant</p>
        </div>
        <div className="platform-stat">
          <p className="platform-stat-label">Suspended tenants</p>
          <p className="platform-stat-value">{data?.tenants.suspended ?? "—"}</p>
          <p className="platform-stat-note">cần theo dõi lifecycle</p>
        </div>
        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Subscriptions linked</p>
          </div>
          <p className="platform-stat-value">{data?.billing.withSubscription ?? "—"}</p>
          <p className="platform-stat-note">{data?.billing.withoutSubscription ?? "—"} chưa gắn subscription</p>
        </div>
        <div className="platform-stat">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="size-4" aria-hidden="true" />
            <p className="platform-stat-label">Platform admins</p>
          </div>
          <p className="platform-stat-value">{data?.platformAdminCount ?? "—"}</p>
          <p className="platform-stat-note">tài khoản control-plane</p>
        </div>
      </section>

      <nav aria-label="Platform shortcuts" className="platform-toolbar">
        <span className="px-2 text-xs font-semibold text-muted-foreground">Đi tới</span>
        <Button asChild variant="ghost">
          <Link href="/platform/tenants">Tenants</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/platform/billing">Billing</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/platform/admins">Admins</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/platform/audit">
            <ScrollText aria-hidden="true" />
            Audit
          </Link>
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
            <tbody className={loading ? "opacity-70" : undefined}>
              {!loading && recentAudit.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    Chưa có audit entry. Các thay đổi platform sẽ xuất hiện ở đây.
                  </td>
                </tr>
              )}
              {recentAudit.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-muted-foreground sm:px-6">
                    {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">{entry.actorUsername || "—"}</td>
                  <td className="platform-mono px-4 py-3 text-xs font-medium">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground sm:pr-6">
                    {entry.resourceType}
                    {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="platform-mobile-list md:hidden">
          {!loading && recentAudit.length === 0 && (
            <div className="platform-empty-state">
              <ScrollText className="size-5" aria-hidden="true" />
              <p>Chưa có audit entry. Các thay đổi platform sẽ xuất hiện ở đây.</p>
            </div>
          )}
          {recentAudit.map((entry) => (
            <article key={entry.id} className="platform-mobile-card">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="platform-mono truncate text-xs font-semibold">{entry.action}</p>
                  <p className="mt-1 truncate text-sm">{entry.actorUsername || "—"}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                </time>
              </div>
              <p className="break-words text-xs text-muted-foreground">
                {entry.resourceType}
                {entry.resourceId ? ` · ${entry.resourceId}` : ""}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
