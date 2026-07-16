"use client"

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 * page: tenant billing · data-form: subscription state + focused actions
 */

import { useCallback, useEffect, useState } from "react"
import { billingApi, type BillingStatusResponse } from "@/lib/api/billing-api"
import { Button } from "@/components/ui/button"
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
    <div className="platform-page max-w-5xl">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Thanh toán</h1>
          <p className="platform-page-description">
            Gói và đăng ký của tổ chức bạn. Quản lý thẻ / hóa đơn qua cổng Stripe.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </header>

      <section className="platform-data-surface" aria-label="Trạng thái gói">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold">Trạng thái gói</h2>
          <p className="mt-1 text-sm text-muted-foreground">Thông tin đăng ký hiện tại của tổ chức.</p>
        </div>
        <div className="p-4 sm:p-6">
          {loading && !status ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : (
            <dl className="grid divide-y divide-border border-y border-border text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {[
                ["Gói", status?.planName || status?.planCode || "—"],
                ["Subscription", status?.subscriptionStatus || "Chưa có"],
                ["Kỳ hiện tại kết thúc", status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleString() : "—"],
                ["Giới hạn khu vực", status?.usage?.max_sites != null ? status.usage.max_sites : "—"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 px-4 py-4">
                  <dt className="platform-stat-label">{label}</dt>
                  <dd className="mt-2 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="platform-data-surface" aria-label="Hành động thanh toán">
        <div className="border-b border-border px-4 py-4 sm:px-6"><h2 className="text-base font-semibold">Hành động</h2></div>
        <div className="flex flex-wrap gap-3 p-4 sm:p-6">
          <Button onClick={() => void openPortal()} disabled={opening}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {opening ? "Đang mở…" : "Mở cổng thanh toán"}
          </Button>
          <Button variant="outline" onClick={() => void startCheckout()} disabled={opening || !status?.planId}>
            <CreditCard className="mr-2 h-4 w-4" />
            Checkout / nâng cấp
          </Button>
        </div>
      </section>
    </div>
  )
}
