"use client"

import { useCallback, useEffect, useState } from "react"
import { billingApi, type BillingStatusResponse } from "@/lib/api/billing-api"
import { Button } from "@/components/ui/button"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị"
        title="Thanh toán"
        description="Gói và đăng ký của tổ chức bạn. Quản lý thẻ và hóa đơn qua cổng Stripe."
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        actions={
          <div className="flex shrink-0 items-start justify-end">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              className="!h-8 !min-h-8 !w-8 shrink-0 rounded-lg !p-0 shadow-none sm:!h-10 sm:!min-h-10 sm:!w-auto sm:px-3"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only sm:not-sr-only sm:ml-2">Làm mới</span>
            </Button>
          </div>
        }
      />

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
                  <dd className="mt-2 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="platform-data-surface" aria-label="Hành động thanh toán">
        <div className="border-b border-border px-4 py-4 sm:px-6"><h2 className="text-base font-semibold">Hành động</h2></div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:flex sm:flex-wrap sm:p-6">
          <Button className="w-full sm:w-auto" onClick={() => void openPortal()} disabled={opening}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {opening ? "Đang mở…" : "Mở cổng thanh toán"}
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => void startCheckout()} disabled={opening || !status?.planId}>
            <CreditCard className="mr-2 h-4 w-4" />
            Checkout / nâng cấp
          </Button>
        </div>
      </section>
    </AdminPage>
  )
}
