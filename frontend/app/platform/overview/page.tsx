"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { platformApi, type PlatformOverview } from "@/lib/api/platform-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Building2,
  CreditCard,
  RefreshCw,
  Shield,
  ScrollText,
} from "lucide-react"

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
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ số platform — tenant lifecycle, billing, admins.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Tenants active
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.tenants.active ?? "—"}
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              / {data?.tenants.total ?? "—"} tổng
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.tenants.suspended ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              Có subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.billing.withSubscription ?? "—"}
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {data?.billing.withoutSubscription ?? "—"} chưa gắn Stripe sub
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Platform admins
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data?.platformAdminCount ?? "—"}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/platform/tenants">Tenants</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/platform/billing">Billing</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/platform/admins">Admins</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/platform/audit">
            <ScrollText className="mr-1 h-3.5 w-3.5" />
            Audit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Đang tải…
                    </td>
                  </tr>
                )}
                {!loading && (data?.recentAudit.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Chưa có audit entry.
                    </td>
                  </tr>
                )}
                {!loading &&
                  data?.recentAudit.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-4 py-3">{entry.actorUsername || "—"}</td>
                      <td className="px-4 py-3 font-medium">{entry.action}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {entry.resourceType}
                        {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
