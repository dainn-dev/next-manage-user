"use client"

import { useCallback, useEffect, useState } from "react"
import { memberApi, type MemberVehicleGarageItem } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Car,
  RefreshCw,
  Cpu,
  Layers,
  Building2,
  ShieldCheck,
  Loader2,
  Info,
  Calendar,
  Zap,
  BookmarkCheck
} from "lucide-react"

export default function MemberGaragePage() {
  const [items, setItems] = useState<MemberVehicleGarageItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await memberApi.listVehicles()
      setItems(data)
    } catch (e) {
      toast({
        title: "Không tải được danh sách xe",
        description: e instanceof Error ? e.message : "Lỗi không xác định",
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
    <div className="space-y-6">
      {/* Sci-Fi Page Header */}
      <div className="border-b border-slate-900 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              MEMBER // GARAGE_NODE_STATUS
            </span>
            <h1 className="text-2xl font-bold tracking-wider text-white font-mono uppercase">
              {"XE CỦA TÔI"}
            </h1>
            <p className="text-xs font-mono text-slate-400 uppercase leading-relaxed max-w-xl">
              {"Hồ sơ xe cá nhân đã đăng ký trên ParkVision. Giám sát các tổ chức (trọ, trường, công ty) đang liên kết quyền đỗ xe với biển số của bạn."}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            className="h-10 w-10 border-slate-800 bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl transition-all shadow-none self-start sm:self-center"
            aria-label="Làm mới"
            title="Làm mới"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900">
          <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">
              {"FETCHING_GARAGE_DATA..."}
            </span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-slate-850 bg-slate-950/20 rounded-xl p-8 text-center relative overflow-hidden backdrop-blur-xl">
          {/* Tech ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800" />
          
          <div className="mx-auto p-3 max-w-fit rounded-lg bg-slate-950/80 border border-slate-900 text-slate-500 mb-3 shadow-[0_0_12px_rgba(255,255,255,0.02)]">
            <Car className="h-5 w-5" />
          </div>
          <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            {"[!] CHƯA PHÁT HIỆN HỒ SƠ PHƯƠNG TIỆN"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 uppercase mt-2 max-w-md mx-auto leading-relaxed">
            {"Khi ban quản lý tòa nhà, nhà trọ hoặc cơ quan đăng ký biển số của bạn vào hệ thống, phương tiện sẽ xuất hiện tự động tại Node này."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((v) => (
            <div
              key={v.vehicleId}
              className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 hover:border-slate-700/60 group"
            >
              {/* Tech corner ticks */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

              {/* Header inside Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/60 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.08)]">
                    <Car className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] tracking-widest text-slate-500 uppercase">
                      {"NODE_VEHICLE_ID // "}{v.vehicleId.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-sm font-mono font-bold tracking-wider text-slate-300">
                      {[v.brand, v.model, v.color].filter(Boolean).join(" · ") || "Hồ sơ không xác định"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-950 border border-slate-850 hover:bg-slate-950 text-slate-400 font-mono text-[9px] tracking-wider uppercase h-6 px-2 rounded">
                    {v.vehicleType || "UNKNOWN_TYPE"}
                  </Badge>
                  <Badge className={cn(
                    "font-mono text-[9px] tracking-wider uppercase h-6 px-2 rounded border hover:opacity-90",
                    v.status === "active" || v.status === "ACTIVE"
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-850"
                  )}>
                    {v.status || "UNKNOWN"}
                  </Badge>
                </div>
              </div>

              {/* License Plate Display block */}
              <div className="mb-4">
                <span className="block font-mono text-[9px] tracking-widest text-slate-500 uppercase mb-1">
                  {"LICENSE_PLATE_NODE"}
                </span>
                <span className="font-mono text-xl tracking-widest font-bold text-white bg-slate-950 border border-slate-900 py-1.5 px-4 rounded-lg inline-block shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
                  {v.licensePlate}
                </span>
              </div>

              {/* Organization list */}
              <div className="mt-4 pt-3 border-t border-slate-900/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="h-3 w-3 text-cyan-500/80" />
                  <span className="font-mono text-[9px] tracking-widest text-slate-400 uppercase">
                    {"SYS_TENANT_BINDINGS // ĐĂNG KÝ TẠI TỔ CHỨC"}
                  </span>
                </div>

                {v.registeredAt?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {v.registeredAt.map((org) => (
                      <div
                        key={`${v.vehicleId}-${org.tenantId}`}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-900 text-xs font-mono text-slate-300"
                      >
                        <BookmarkCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate" title={org.tenantName || org.tenantId}>
                          {org.tenantName || org.tenantId}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/20 border border-dashed border-slate-900 text-xs font-mono text-slate-500">
                    <Info className="h-3 w-3 shrink-0" />
                    <span>{"CHƯA LIÊN KẾT VỚI TỔ CHỨC NÀO TRÊN HỆ THỐNG"}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
