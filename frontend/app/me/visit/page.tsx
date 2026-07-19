"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { memberApi } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  QrCode,
  Loader2,
  KeyRound,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Info
} from "lucide-react"

export default function MemberVisitPage() {
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const onClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const session = await memberApi.claimSession(code.trim())
      toast({
        title: "Đã gắn phiên gửi xe thành công",
        description: `${session.licensePlate} · ${session.tenantName || "ParkVision"}`,
      })
      router.push(`/me/visit/${session.sessionId}`)
    } catch (err) {
      toast({
        title: "Không claim được mã QR",
        description: err instanceof Error ? err.message : "Mã không hợp lệ hoặc đã hết hạn",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sci-Fi Page Header */}
      <div className="border-b border-border pb-5">
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            MEMBER // VISIT_CLAIM_GATEWAY
          </span>
          <h1 className="text-2xl font-bold tracking-wider text-foreground font-mono uppercase">
            {"VISIT / QR TICKET"}
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase leading-relaxed max-w-xl">
            {"Gắn mã phiên gửi xe in từ vé giấy (QR Code) tại các bãi gửi xe công cộng hoặc siêu thị để kích hoạt tính năng định vị xe thông minh."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5 items-start">
        {/* Main Claim Box */}
        <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-6 relative overflow-hidden backdrop-blur-xl md:col-span-3 group">
          {/* Brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-200" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-200" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-200" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-200" />

          <div className="mb-4 pb-3 border-b border-border">
            <h2 className="text-xs font-mono tracking-widest text-cyan-600 uppercase flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-cyan-600" />
              {"RESOLVE_QR_SESSION // NHẬP MÃ ĐỂ LIÊN KẾT"}
            </h2>
          </div>

          <form onSubmit={onClaim} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="qr-code" className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                {"QR SESSION CODE // MÃ THẺ GỬI XE"}
              </Label>
              <Input
                id="qr-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Dán mã ID từ vé hoặc link QR..."
                autoComplete="off"
                disabled={submitting}
                required
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-11 px-4 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-11 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <QrCode className="h-4 w-4 text-white" />
              )}
              <span>{submitting ? "CLAIMING_SESSION..." : "CLAIM // KÍCH HOẠT THEO DÕI"}</span>
              {!submitting && <ArrowRight className="h-3.5 w-3.5 text-white" />}
            </Button>
          </form>
        </div>

        {/* Informative Instructions Card */}
        <div className="border border-border bg-muted/10 text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl md:col-span-2 space-y-4">
          <div className="flex items-center gap-2 text-cyan-600 border-b border-border pb-2">
            <Info className="h-4 w-4 shrink-0 text-cyan-600" />
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider">
              {"SYS_GUIDELINES // HƯỚNG DẪN"}
            </h3>
          </div>

          <div className="space-y-3.5 text-[11px] font-mono text-muted-foreground uppercase leading-relaxed">
            <div className="space-y-1">
              <span className="text-cyan-600 font-bold">{"01 // QUÉT QR HOẶC NHẬP MÃ"}</span>
              <p className="text-slate-500 pl-4">
                {"Mỗi khi đỗ xe tại các bãi công cộng, hệ thống kiosk sẽ in phiếu có mã vạch / QR. Bạn chỉ cần sao chép mã số phía dưới QR Code."}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-cyan-600 font-bold">{"02 // ĐỊNH VỊ THỜI GIAN THỰC"}</span>
              <p className="text-slate-500 pl-4">
                {"Khi đã liên kết thành công, hệ thống camera AI trong bãi sẽ tự động nhận diện và cập nhật ô đỗ hiện tại của bạn trực tuyến."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
