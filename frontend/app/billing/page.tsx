"use client"

import { useCallback, useEffect, useState } from "react"
import { billingApi, type BillingStatusResponse } from "@/lib/api/billing-api"
import { Button } from "@/components/ui/button"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  ExternalLink,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  Loader2,
  CalendarDays,
  Lock
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

  return (
    <AdminPage className="min-h-dvh">
      <AdminPageHeader
        eyebrow="MODULE // QUẢN TRỊ"
        title="THANH TOÁN & DỊCH VỤ"
        description="Gói dịch vụ và chu kỳ đăng ký của tổ chức. Quản lý phương thức thanh toán, thẻ tín dụng và hóa đơn bảo mật qua cổng Stripe API."
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        actions={
          <div className="flex shrink-0 items-start justify-end gap-2.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 w-10 border-slate-800 bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl p-0 transition-all shadow-none shrink-0"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {/* Section 1: Subscription Metrics */}
        <section className="space-y-4" aria-label="Trạng thái gói">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              01 // THÔNG TIN ĐĂNG KÝ HIỆN TẠI (SUBSCRIPTION_PROFILE)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              PLATFORM_BILLING_NODE
            </span>
          </div>

          {loading && !status ? (
            <div className="flex min-h-[25vh] items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900">
              <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-400">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">FETCHING_BILLING_STATE...</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Gói Dịch Vụ",
                  value: status?.planName || status?.planCode || "CHƯA CÓ",
                  code: "PLAN_NAME_CODE",
                  icon: Cpu,
                  color: "cyan"
                },
                {
                  label: "Trạng Thái Đăng Ký",
                  value: status?.subscriptionStatus || "CHƯA KÍCH HOẠT",
                  code: "SUBSCRIPTION_STATUS",
                  icon: ShieldCheck,
                  color: isSubActive ? "emerald" : "amber",
                  badge: true
                },
                {
                  label: "Kỳ Hiện Tại Kết Thúc",
                  value: status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString("vi-VN") : "—",
                  sub: status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleTimeString("vi-VN") : undefined,
                  code: "PERIOD_RENEWAL_EPOCH",
                  icon: CalendarDays,
                  color: "cyan"
                },
                {
                  label: "Giới Hạn Khu Vực (Max Sites)",
                  value: status?.usage?.max_sites != null ? `${status.usage.max_sites} Site` : "KHÔNG GIỚI HẠN",
                  code: "SITE_QUOTA_CAP",
                  icon: Layers,
                  color: "slate"
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 hover:border-slate-700/60 group"
                >
                  {/* Tech corner ticks */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

                  <div className="flex items-center justify-between gap-2 border-b border-slate-900/60 pb-3 mb-3">
                    <div className="space-y-0.5">
                      <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">{item.code}</p>
                      <p className="text-[11px] font-mono tracking-wide text-slate-300 uppercase">{item.label}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    {item.badge ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${item.color === "emerald" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                        <span className={`text-sm font-mono font-bold tracking-wide break-words select-all uppercase ${item.color === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
                          {item.value}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-mono font-bold text-white tracking-wide break-words select-all uppercase">
                        {item.value}
                      </p>
                    )}
                    {item.sub && (
                      <p className="text-[10px] font-mono text-slate-500 mt-1 leading-normal uppercase">
                        {item.sub}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Billing & Plan Actions */}
        <section className="space-y-4" aria-label="Hành động thanh toán">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              02 // ĐIỀU PHỐI GIAO DỊCH & CỔNG THANH TOÁN (SECURE_TRANSACTIONS)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              SECURE_WRITE_GATEWAY
            </span>
          </div>

          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
            {/* Tech brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-500/30" />

            <div className="mb-6 border-b border-slate-900 pb-4">
              <h2 className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-cyan-500" />
                STRIPE_SECURE_API_INTEGRATION // KÊNH THANH TOÁN AN TOÀN
              </h2>
              <p className="mt-1.5 font-mono text-[10px] text-slate-400 leading-relaxed uppercase">
                Mọi giao dịch và thông tin thẻ tín dụng của bạn đều được mã hóa hoàn toàn và xử lý trực tiếp bởi Stripe. Hệ thống không lưu trữ bất kỳ thông tin nhạy cảm nào liên quan đến phương thức thanh toán của doanh nghiệp.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                onClick={() => void openPortal()}
                disabled={opening}
                className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-11 px-6 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                {opening ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-slate-950" />
                )}
                <span>{opening ? "CONNECTING..." : "MỞ CỔNG THANH TOÁN"}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => void startCheckout()}
                disabled={opening || !status?.planId}
                className="w-full sm:w-auto border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white font-mono text-xs uppercase h-11 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4 text-cyan-400" />
                <span>CHECKOUT // NÂNG CẤP GÓI</span>
              </Button>
            </div>

            {!status?.planId && (
              <p className="mt-3 font-mono text-[9px] text-amber-500 uppercase leading-normal tracking-wide">
                [!] CHƯA PHÁT HIỆN MÃ GÓI DỊCH VỤ LIÊN KẾT ĐỂ THỰC HIỆN CHECKOUT TRỰC TIẾP. VUI LÒNG LIÊN HỆ ĐỘI NGŨ QUẢN TRỊ VIÊN HỆ THỐNG ĐỂ ĐƯỢC PHÊ DUYỆT CẤP ĐỘ GÓI RIÊNG.
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminPage>
  )
}
