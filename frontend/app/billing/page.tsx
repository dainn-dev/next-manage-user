"use client"

import { useCallback, useEffect, useState } from "react"
import { billingApi, type BillingStatusResponse } from "@/lib/api/billing-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react"

export default function TenantBillingPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState<BillingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await billingApi.getStatus())
    } catch (error) {
      toast({
        title: "Không tải được trạng thái thanh toán",
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

  const openPortal = async () => {
    setOpening(true)
    try {
      const returnUrl = `${window.location.origin}/billing`
      const session = await billingApi.createPortalSession({ returnUrl })
      if (session.url) {
        window.location.href = session.url
        return
      }
      throw new Error("Portal URL missing")
    } catch (error) {
      toast({
        title: "Không mở được cổng thanh toán",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setOpening(false)
    }
  }

  const startCheckout = async () => {
    if (!status?.planId) {
      toast({
        title: "Chưa có gói để thanh toán",
        description: "Liên hệ hỗ trợ nếu bạn cần nâng cấp gói.",
        variant: "destructive",
      })
      return
    }
    setOpening(true)
    try {
      const origin = window.location.origin
      const session = await billingApi.createCheckoutSession({
        planId: status.planId,
        successUrl: `${origin}/billing?checkout=success`,
        cancelUrl: `${origin}/billing?checkout=cancel`,
      })
      if (session.url) {
        window.location.href = session.url
        return
      }
      throw new Error("Checkout URL missing")
    } catch (error) {
      toast({
        title: "Không tạo được phiên thanh toán",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thanh toán</h1>
          <p className="text-sm text-muted-foreground">
            Gói và đăng ký của tổ chức bạn. Quản lý thẻ / hóa đơn qua cổng Stripe.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trạng thái gói</CardTitle>
          <CardDescription>Thông tin từ /api/v1/billing/status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !status ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Gói</div>
                <div className="font-medium">{status?.planName || status?.planCode || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Subscription</div>
                <div className="font-medium">{status?.subscriptionStatus || "Chưa có"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Kỳ hiện tại kết thúc</div>
                <div className="font-medium">
                  {status?.currentPeriodEnd
                    ? new Date(status.currentPeriodEnd).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Sử dụng (sites)</div>
                <div className="font-medium">
                  {status?.usage?.max_sites != null ? status.usage.max_sites : "—"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hành động</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => void openPortal()} disabled={opening}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {opening ? "Đang mở…" : "Mở cổng thanh toán"}
          </Button>
          <Button variant="outline" onClick={() => void startCheckout()} disabled={opening || !status?.planId}>
            <CreditCard className="mr-2 h-4 w-4" />
            Checkout / nâng cấp
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
