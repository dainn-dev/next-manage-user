"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, DoorOpen, MapPin, RefreshCw, Radio, Monitor, Clock3 } from "lucide-react"
import { gateApi, isGateOnline, type Gate } from "@/lib/api/gate-api"
import { ErrorBoundary } from "@/components/error-boundary"
import { AdminPage } from "@/components/layout/admin-page"

const REFRESH_INTERVAL_MS = 30000

function GateList() {
  const [gates, setGates] = useState<Gate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [currentTime, setCurrentTime] = useState<string>("")

  // Realtime clock for high-tech header
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gateApi.getGates()
      setGates(data)
      setError(null)
    } catch {
      setError(
        "Không thể tải danh sách cổng. Bạn cần quyền quản trị (ADMIN) để xem trang này.",
      )
    } finally {
      setLoading(false)
      setNow(Date.now())
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      load()
    }, REFRESH_INTERVAL_MS)
    // Re-tick the clock every 15s so the online/offline badge decays even between
    // full refreshes.
    const tick = setInterval(() => setNow(Date.now()), 15000)
    return () => {
      clearInterval(id)
      clearInterval(tick)
    }
  }, [load])

  const onlineCount = gates.filter((g) => isGateOnline(g, now)).length

  return (
    <AdminPage className="space-y-6 bg-background text-foreground p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Visual background decorations matching other Technology-style pages */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.01]"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-1/3 left-10 w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      {/* High-Tech custom page header with operations glow */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6 shadow-[var(--shadow-card)]">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/20" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/20" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500/20" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500/20" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[9px] font-mono font-medium text-cyan-700">
                <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {"SYSTEM_MONITOR // GATES"}
              </span>
              <span className="text-slate-300 font-mono text-[10px]">|</span>
              <span className="text-slate-500 font-mono text-[9px] tracking-wider uppercase">KIOSK REALTID_ACCESS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono uppercase">
              CỔNG KIỂM SOÁT <span className="text-cyan-600">{"// GATE CHANNELS"}</span>
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Chọn một cổng bên dưới để kích hoạt giao diện Kiosk giám sát và điều phối lượt xe ra vào trong thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg border border-border bg-muted/50 font-mono text-xs">
              <span className="text-muted-foreground text-[8px] uppercase tracking-wider">Hệ thống thời gian</span>
              <span className="text-cyan-600 font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/gate/health" className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-mono text-xs hover:border-cyan-500/20"
                  title="Sức khỏe cổng"
                >
                  <Activity className="h-3.5 w-3.5 mr-1.5 text-cyan-600" />
                  <span>SỨC KHỎE CỔNG</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
                className="h-10 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-mono text-xs hover:border-cyan-500/20"
                title="Làm mới"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                <span>NẠP LẠI</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Overview Stat Widgets */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Thông số cổng">
        {[
          { 
            label: "TỔNG SỐ CỔNG", 
            value: loading && gates.length === 0 ? "..." : gates.length, 
            icon: DoorOpen, 
            id: "TOTAL_GATES", 
            color: "text-cyan-600", 
            glow: "rgba(6,182,212,0.04)", 
            border: "border-cyan-100",
            bg: "bg-cyan-50/20"
          },
          { 
            label: "CỔNG TRỰC TUYẾN", 
            value: loading && gates.length === 0 ? "..." : onlineCount, 
            icon: Radio, 
            id: "ONLINE_GATES", 
            color: "text-emerald-600", 
            glow: "rgba(16,185,129,0.04)", 
            border: "border-emerald-100",
            bg: "bg-emerald-50/20"
          },
          { 
            label: "CỔNG NGOẠI TUYẾN", 
            value: loading && gates.length === 0 ? "..." : gates.length - onlineCount, 
            icon: Activity, 
            id: "OFFLINE_GATES", 
            color: "text-rose-600", 
            glow: "rgba(244,63,94,0.04)", 
            border: "border-rose-100",
            bg: "bg-rose-50/20",
            className: "col-span-2 sm:col-span-1" 
          },
        ].map(({ label, value, icon: Icon, id, color, glow, border, bg, className }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border ${border} ${bg || "bg-card"} p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-muted/10 ${className ?? ""}`}
            style={{
              boxShadow: `inset 0 0 12px ${glow}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-muted-foreground/80">[{id}]</span>
              <span className="text-[8px] font-mono text-muted-foreground/60">ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                <Icon className={`size-4.5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide truncate">
                  {label}
                </p>
                <p className={`font-mono text-sm sm:text-lg font-black leading-none tracking-tight mt-1 ${color}`}>
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-mono">
          <span className="text-[9px] block text-rose-600 mb-1">{"[ERROR_OCCURRED]"}</span>
          {error}
        </div>
      )}

      {loading && gates.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 font-mono text-xs text-muted-foreground border border-border rounded-xl bg-muted/20">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-600" />
          <span className="animate-pulse">LOADING_PORTAL_STREAMS...</span>
        </div>
      )}

      {!loading && gates.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center font-mono text-muted-foreground border border-border rounded-xl bg-muted/20">
          <span className="grid size-12 place-items-center rounded-xl bg-muted border border-border text-muted-foreground mb-3">
            <DoorOpen className="size-6" />
          </span>
          <p className="text-xs font-bold text-slate-500 uppercase">Không tìm thấy dữ liệu cổng</p>
          <p className="text-[10px] mt-1 text-slate-400">Chưa có cổng kiểm soát nào được đăng ký vào hệ thống.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {gates.map((gate) => {
          const online = isGateOnline(gate, now)
          return (
            <Card 
              key={gate.id} 
              className="relative overflow-hidden border border-border bg-card hover:bg-muted/30 transition-all duration-300 hover:scale-[1.01] shadow-sm group"
            >
              {/* Highlight top border when online vs offline */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 ${
                online 
                  ? "bg-emerald-500 group-hover:bg-emerald-400" 
                  : gate.status === "disabled"
                    ? "bg-slate-300"
                    : "bg-rose-500 group-hover:bg-rose-400"
              }`} />

              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                        online 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                          : gate.status === "disabled"
                            ? "bg-slate-50 border-slate-200 text-slate-400"
                            : "bg-rose-50 border-rose-200 text-rose-600"
                      }`}
                    >
                      <Radio className={`h-5 w-5 ${online ? "animate-pulse" : ""}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-mono text-slate-400 block">{"[CHANNEL_NODE]"}</span>
                      <h3 className="truncate font-mono text-sm font-black text-foreground group-hover:text-cyan-600 transition-colors uppercase leading-none mt-0.5">
                        {gate.name}
                      </h3>
                      {gate.location ? (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 font-mono">
                          <MapPin className="h-3 w-3 shrink-0 text-cyan-600" />
                          <span className="truncate">{gate.location}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">Chưa định vị</p>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`shrink-0 font-mono text-[9px] font-bold tracking-wider px-2 py-0.5 rounded uppercase border transition-all ${
                      online
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : gate.status === "disabled"
                          ? "border-slate-200 bg-slate-50 text-slate-500"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                        online
                          ? "bg-emerald-500 animate-pulse"
                          : gate.status === "disabled"
                            ? "bg-slate-400"
                            : "bg-rose-500"
                      }`}
                    />
                    {online
                      ? "ONLINE"
                      : gate.status === "disabled"
                        ? "VÔ HIỆU"
                        : "OFFLINE"}
                  </Badge>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border p-3 flex items-center justify-between font-mono text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock3 className="size-3 text-cyan-600" />
                    Đồng bộ cuối
                  </span>
                  <span className="text-foreground font-bold">
                    {gate.lastHeartbeatAt ? (
                      new Date(gate.lastHeartbeatAt).toLocaleString("vi-VN")
                    ) : (
                      <span className="text-muted-foreground/60">CHƯA CÓ NHỊP TIM</span>
                    )}
                  </span>
                </div>

                <Link href={`/gate/${gate.id}`} className="block w-full">
                  <Button 
                    className="w-full h-10 font-mono text-xs font-bold tracking-wider uppercase border border-border bg-background hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 rounded-lg transition-all duration-200" 
                    size="sm"
                  >
                    <Monitor className="h-3.5 w-3.5 mr-2 text-cyan-600 group-hover:scale-105 transition-transform" />
                    MỞ KIOSK GIÁM SÁT
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </AdminPage>
  )
}

export default function GatePage() {
  return (
    <ErrorBoundary>
      <GateList />
    </ErrorBoundary>
  )
}
