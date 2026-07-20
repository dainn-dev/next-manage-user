"use client"

import { useCallback, useEffect, useState } from "react"
import { billingApi, type BillingStatusResponse } from "@/lib/api/billing-api"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

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

  const isSubActive = status?.subscriptionStatus === "active"
  const subscriptionMetrics = [
    {
      label: "Trạng thái đăng ký",
      value: status?.subscriptionStatus || "Chưa kích hoạt",
      note: "Tình trạng dịch vụ hiện tại",
      icon: ShieldCheck,
      tone: isSubActive ? "success" : "serious",
    },
    {
      label: "Gói dịch vụ",
      value: status?.planName || status?.planCode || "Chưa có gói",
      note: "Gói đang được áp dụng cho tổ chức",
      icon: Sparkles,
      tone: "primary",
    },
    {
      label: "Chu kỳ hiện tại kết thúc",
      value: status?.currentPeriodEnd
        ? new Date(status.currentPeriodEnd).toLocaleDateString("vi-VN")
        : "Chưa xác định",
      note: status?.currentPeriodEnd
        ? `Gia hạn lúc ${new Date(status.currentPeriodEnd).toLocaleTimeString("vi-VN")}`
        : "Không có ngày gia hạn được cung cấp",
      icon: CalendarDays,
      tone: "warning",
    },
    {
      label: "Giới hạn khu vực",
      value: status?.usage?.max_sites != null ? `${status.usage.max_sites} khu vực` : "Không giới hạn",
      note: "Số khu vực có thể khai báo trong gói",
      icon: Layers,
      tone: "serious",
    },
  ] as const

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị tổ chức"
        title="Thanh toán và dịch vụ"
        description="Theo dõi gói dịch vụ, chu kỳ đăng ký và quản lý phương thức thanh toán an toàn qua Stripe."
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới"
            title="Làm mới"
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        }
      />

      {loading && !status ? (
        <Card className="min-h-64 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Đang tải thông tin thanh toán</p>
              <p className="mt-1 text-sm text-muted-foreground">Vui lòng chờ trong giây lát.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <DashboardMetricsSection
            id="billing-overview"
            title="Tổng quan đăng ký"
            description="Thông tin hiện tại về dịch vụ của tổ chức."
            badge={(
              <Badge variant={isSubActive ? "default" : "secondary"}>
                {isSubActive ? "Dịch vụ đang hoạt động" : "Cần kiểm tra đăng ký"}
              </Badge>
            )}
            metrics={subscriptionMetrics}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5 text-primary" aria-hidden="true" />
                Quản lý thanh toán
              </CardTitle>
              <CardDescription>
                Stripe xử lý trực tiếp giao dịch, thẻ và hóa đơn. Hệ thống không lưu thông tin thẻ của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Button onClick={() => void openPortal()} disabled={opening}>
                  {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                  {opening ? "Đang kết nối" : "Mở cổng thanh toán"}
                </Button>
                <Button
                  variant="tonal"
                  onClick={() => void startCheckout()}
                  disabled={opening || !status?.planId}
                >
                  <CreditCard />
                  Thanh toán hoặc nâng cấp gói
                </Button>
              </div>
              {!status?.planId && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                  Chưa có gói dịch vụ được liên kết để thanh toán trực tiếp. Vui lòng liên hệ đội ngũ quản trị để được hỗ trợ.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AdminPage>
  )
}
