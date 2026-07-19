"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { memberApi, type MemberVehicleGarageItem } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Building2,
  RefreshCw,
  Cpu,
  Layers,
  ShieldCheck,
  Loader2,
  BookmarkCheck,
  Info,
  QrCode,
  Network
} from "lucide-react"

export default function MemberOrgsPage() {
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
        title: "Không tải được đăng ký",
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

  const byOrg = useMemo(() => {
    const map = new Map<string, { name: string; plates: string[] }>()
    for (const v of items) {
      for (const org of v.registeredAt || []) {
        const key = org.tenantId
        const entry = map.get(key) || { name: org.tenantName || key, plates: [] }
        entry.plates.push(v.licensePlate)
        map.set(key, entry)
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
  }, [items])

  return (
    <div className="space-y-6">
      {/* Sci-Fi Page Header */}
      <div className="border-b border-slate-900 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              MEMBER // ORG_CONNECTIONS
            </span>
            <h1 className="text-2xl font-bold tracking-wider text-white font-mono uppercase">
              {"ĐĂNG KÝ TẠI TỔ CHỨC"}
            </h1>
            <p className="text-xs font-mono text-slate-400 uppercase leading-relaxed max-w-xl">
              {"Tra cứu các tổ chức (chung cư, cơ quan, trường học...) nơi phương tiện của bạn được cấp quyền ra vào bãi đỗ xe nội bộ."}
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
              {"FETCHING_ORGANIZATIONS..."}
            </span>
          </div>
        </div>
      ) : byOrg.length === 0 ? (
        <div className="border border-slate-850 bg-slate-950/20 rounded-xl p-8 text-center relative overflow-hidden backdrop-blur-xl">
          {/* Tech ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800" />
          
          <div className="mx-auto p-3 max-w-fit rounded-lg bg-slate-950/80 border border-slate-900 text-slate-500 mb-3 shadow-[0_0_12px_rgba(255,255,255,0.02)]">
            <Building2 className="h-5 w-5" />
          </div>
          <p className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            {"[!] CHƯA PHÁT HIỆN LIÊN KẾT TỔ CHỨC"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 uppercase mt-2 max-w-md mx-auto leading-relaxed">
            {"Tài khoản của bạn hiện chưa được ghi nhận trong danh sách thành viên của bất kỳ tổ chức nào trên hệ thống."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {byOrg.map((org) => (
            <div
              key={org.id}
              className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 hover:border-slate-700/60 group"
            >
              {/* Tech corner ticks */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

              <div className="flex items-start justify-between gap-3 border-b border-slate-900/60 pb-3 mb-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">
                    {"TENANT_NODE_ID // "}{org.id.toUpperCase()}
                  </p>
                  <p className="text-sm font-mono font-bold text-white tracking-wide uppercase">
                    {org.name}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>

              <div>
                <span className="block font-mono text-[9px] tracking-widest text-slate-500 uppercase mb-2">
                  {"AUTHORIZED_LICENSE_PLATES // BIỂN SỐ CHO PHÉP"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {org.plates.map((plate) => (
                    <span
                      key={plate}
                      className="font-mono text-[11px] font-bold text-cyan-400 bg-slate-950 border border-slate-900 py-1 px-2.5 rounded-md shadow-sm"
                    >
                      {plate}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-900/40 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Network className="h-3 w-3 text-emerald-500" />
                  {"CONNECTION_ACTIVE"}
                </span>
                <span>{"ROUTER: PORT_8080"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
