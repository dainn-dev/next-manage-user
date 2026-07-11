"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  platformApi,
  type PlatformBillingSummary,
  type PlatformSubscription,
} from "@/lib/api/platform-api"
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
import { useToast } from "@/hooks/use-toast"
import { ExternalLink, RefreshCw, Search } from "lucide-react"

export default function PlatformBillingPage() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<PlatformBillingSummary | null>(null)
  const [rows, setRows] = useState<PlatformSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search")
    if (q) setSearchTerm(q)
  }, [])

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

  const statusEntries = Object.entries(summary?.byStatus ?? {})

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Subscription cross-tenant. Stripe portal vẫn thuộc TENANT_ADMIN.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Có Stripe subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary?.withSubscription ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chưa có subscription (free/default)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary?.withoutSubscription ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Theo status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {statusEntries.length === 0 && "—"}
            {statusEntries.map(([status, count]) => (
              <Badge key={status} variant="secondary">
                {status}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm tenant…"
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
            setStatusFilter(value)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Subscription status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
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

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Sub status</th>
              <th className="px-4 py-3 font-medium">Period end</th>
              <th className="px-4 py-3 font-medium text-right">Lifecycle</th>
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
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Không có dữ liệu.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.tenantId} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.tenantName}</div>
                    <div className="text-xs text-muted-foreground">{row.tenantSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.planName || "—"}
                    <div className="text-xs text-muted-foreground">{row.planCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.subscriptionStatus === "active" ? "default" : "secondary"}>
                      {row.subscriptionStatus}
                    </Badge>
                    {row.cancelAtPeriodEnd && (
                      <div className="mt-1 text-xs text-muted-foreground">cancel at period end</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.currentPeriodEnd
                      ? new Date(row.currentPeriodEnd).toLocaleString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/platform/tenants/${row.tenantId}`}>
                        Tenant
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalElements} · trang {page + 1}/{Math.max(totalPages, 1)}
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
    </div>
  )
}
