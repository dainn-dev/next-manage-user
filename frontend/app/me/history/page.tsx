"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  History,
  RefreshCw,
  Cpu,
  Layers,
  ArrowLeftRight,
  Loader2,
  Building2,
  ArrowUpRight,
  Search,
  X,
  PlayCircle,
  CheckCircle2,
  MapPin
} from "lucide-react"

interface MetricCardProps {
  label: string
  code: string
  value: string | number
  note: string
  icon: any
  color?: "cyan" | "emerald" | "amber" | "slate"
}

function MetricCard({
  label,
  code,
  value,
  note,
  icon: Icon,
  color = "cyan"
}: MetricCardProps) {
  const colorMap = {
    cyan: {
      text: "text-cyan-600",
      border: "border-cyan-200 hover:border-cyan-300",
      bg: "bg-cyan-50",
      glow: "shadow-sm"
    },
    emerald: {
      text: "text-emerald-700",
      border: "border-emerald-200 hover:border-emerald-300",
      bg: "bg-emerald-50",
      glow: "shadow-sm"
    },
    amber: {
      text: "text-amber-700",
      border: "border-amber-200 hover:border-amber-300",
      bg: "bg-amber-50",
      glow: "shadow-sm"
    },
    slate: {
      text: "text-muted-foreground",
      border: "border-border hover:border-slate-700",
      bg: "bg-background/10",
      glow: ""
    }
  }

  const activeColor = colorMap[color]

  return (
    <div
      className={cn(
        "border bg-card text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 group",
        activeColor.border
      )}
    >
      {/* Sci-fi tech corner ticks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">{code}</p>
          <p className="text-[11px] font-mono tracking-wide text-slate-700 uppercase">{label}</p>
        </div>
        <div className={cn("p-2 rounded-lg bg-muted/80 border border-border", activeColor.text, activeColor.glow)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      <p className="text-xl font-mono font-bold text-foreground tracking-tight truncate select-all">
        {value}
      </p>
      <p className="text-[10px] font-mono text-slate-500 mt-1 leading-normal uppercase">
        {note}
      </p>
    </div>
  )
}

export default function MemberHistoryPage() {
  const [sessions, setSessions] = useState<MemberParkingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await memberApi.listSessions()
      setSessions(data)
    } catch (e) {
      toast({
        title: "Không tải được lịch sử",
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

  // Statistics calculation
  const stats = useMemo(() => {
    const total = sessions.length
    const active = sessions.filter(s => s.status === "active" || s.status === "ACTIVE").length
    const completed = total - active
    const latestTenant = sessions[0]?.tenantName || "CHƯA CÓ"

    return {
      total,
      active,
      completed,
      latestTenant
    }
  }, [sessions])

  // Search filtering
  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions
    const query = searchTerm.toLowerCase().trim()
    return sessions.filter(s => {
      const plateMatch = s.licensePlate?.toLowerCase().includes(query)
      const tenantMatch = s.tenantName?.toLowerCase().includes(query)
      const sessionMatch = s.sessionId?.toLowerCase().includes(query)
      return plateMatch || tenantMatch || sessionMatch
    })
  }, [sessions, searchTerm])

  return (
    <div className="space-y-6">
      {/* Sci-Fi Page Header */}
      <div className="border-b border-border pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              {"MEMBER // HISTORIC_TRANSIT_REGISTRY"}
            </span>
            <h1 className="text-2xl font-bold tracking-wider text-foreground font-mono uppercase">
              {"LỊCH SỬ GỬI XE"}
            </h1>
            <p className="text-xs font-mono text-muted-foreground uppercase leading-relaxed max-w-xl">
              {"Bản ghi đầy đủ về lịch sử đỗ xe và lưu thông của bạn qua các trạm đỗ xe thông minh. Cho phép truy vấn tọa độ và vị trí đỗ trước đó."}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            className="h-10 w-10 border-border bg-card text-slate-700 hover:text-foreground hover:bg-muted rounded-xl transition-all shadow-none self-start sm:self-center"
            aria-label="Làm mới"
            title="Làm mới"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="flex min-h-[35vh] items-center justify-center bg-muted/10 rounded-xl border border-border">
          <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-600">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
            <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">
              {"COMPILING_TRANSIT_HISTORY..."}
            </span>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="border border-border bg-muted/10 rounded-xl p-8 text-center relative overflow-hidden backdrop-blur-xl">
          {/* Tech ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border" />
          
          <div className="mx-auto p-3 max-w-fit rounded-lg bg-muted/80 border border-border text-slate-500 mb-3 shadow-sm">
            <History className="h-5 w-5" />
          </div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {"[!] CHƯA PHÁT HIỆN LỊCH SỬ GỬI XE"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 uppercase mt-2 max-w-md mx-auto leading-relaxed">
            {"Tài khoản chưa lưu nhận lịch sử đỗ xe hoặc claim thẻ gửi xe công cộng nào từ hệ thống ParkVision."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: History Metrics Cards Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Tổng số lượt gửi"
              code="SYS_TRANSIT_COUNT"
              value={stats.total}
              note="Tổng số phiên gửi xe ghi nhận"
              icon={History}
              color="cyan"
            />
            <MetricCard
              label="Đang trong bãi"
              code="ACTIVE_PARK_NODES"
              value={stats.active}
              note="Phương tiện đang gửi thực tế"
              icon={PlayCircle}
              color="emerald"
            />
            <MetricCard
              label="Đã hoàn thành"
              code="COMPLETED_TRANSITS"
              value={stats.completed}
              note="Lượt gửi xe đã rời bãi"
              icon={CheckCircle2}
              color="slate"
            />
            <MetricCard
              label="Bãi đỗ gần nhất"
              code="LATEST_RESOLVED_GATE"
              value={stats.latestTenant}
              note="Tổ chức liên kết gần đây"
              icon={Building2}
              color="amber"
            />
          </div>

          {/* Section 2: Advanced Filter Toolbar */}
          <div className="border border-border bg-muted/50 p-4 rounded-xl relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row items-center gap-4 group">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-700 group-hover:border-cyan-200 transition-colors" />
            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-700 group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-700 group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-700 group-hover:border-cyan-200 transition-colors" />

            <div className="relative min-w-0 flex-1 w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <Input
                aria-label="Tìm kiếm lịch sử"
                placeholder="TÌM THEO BIỂN SỐ, TÊN BÃI ĐỖ HOẶC MÃ PHIÊN..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-11 pl-10 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs"
              />
            </div>

            {searchTerm && (
              <Button
                variant="outline"
                onClick={() => setSearchTerm("")}
                className="w-full md:w-auto border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted font-mono text-xs h-11 px-4 rounded-lg flex items-center justify-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                <span>{"CLEAR"}</span>
              </Button>
            )}
          </div>

          {/* Section 3: Main Logs registry */}
          <div className="border border-border bg-card text-foreground shadow-xl rounded-xl relative overflow-hidden backdrop-blur-xl">
            {/* Tech corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border" />

            {/* Cyber grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />

            <div className="border-b border-border px-5 py-4 flex items-center justify-between relative z-10">
              <h2 className="text-xs font-mono tracking-wider text-cyan-600 uppercase">
                {"TRANSIT_LOGS // NHẬT KÝ ĐỖ XE THỰC TẾ"}
              </h2>
              <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                {"[RECORDS: "}{filteredSessions.length}{" / "}{sessions.length}{"]"}
              </span>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center relative z-10">
                <p className="font-mono text-xs text-slate-500 uppercase">
                  {"[!] KHÔNG TÌM THẤY BẢN GHI PHÙ HỢP VỚI BỘ LỌC"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-900 relative z-10">
                {filteredSessions.map((s) => (
                  <div key={s.sessionId} className="hover:bg-muted/50 transition-colors">
                    <Link href={`/me/visit/${s.sessionId}`} className="block p-5 relative group">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-foreground bg-background border border-border py-1 px-2.5 rounded shadow-sm">
                            {s.licensePlate}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                            <Building2 className="h-3 w-3 text-slate-600 shrink-0" />
                            <span>{s.tenantName || "ParkVision System"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "font-mono text-[9px] tracking-wider uppercase h-5 px-1.5 rounded border hover:opacity-90",
                            s.status === "active" || s.status === "ACTIVE"
                              ? "bg-emerald-100/50 text-emerald-700 border-emerald-200 animate-pulse"
                              : "bg-background text-muted-foreground border-border"
                          )}>
                            {s.status || "COMPLETED"}
                          </Badge>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-cyan-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500 uppercase">
                        <span>
                          {s.startedAt ? `START: ${new Date(s.startedAt).toLocaleString("vi-VN")}` : "TIMESTAMP: —"}
                        </span>
                        <span className="text-slate-600 group-hover:text-cyan-600/50 transition-colors">
                          {"LOG_ID // "}{s.sessionId.slice(0, 10).toUpperCase()}
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
