"use client"

import * as React from "react"
import {
  LayoutGrid,
  RefreshCw,
  Search,
  Filter,
  Activity,
  Car,
  Sliders,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Ban,
  Loader2,
  Info,
  Clock,
  Terminal,
  ArrowRightLeft,
  ChevronRight,
  Eye,
  Settings,
  Flame,
  ShieldCheck,
  Zap,
  Map,
  X,
  Play,
  RotateCcw
} from "lucide-react"

import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { AdminPage } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export default function ParkingSlotsPage() {
  const { slots: rawSlots, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId, zones } = useDashboardScope()
  const { toast } = useToast()

  // High-Tech Digital Clock
  const [currentTime, setCurrentTime] = React.useState<string>("")
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  // Local state for simulator overrides & mock session variables
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [activeTab, setActiveTab] = React.useState<"grid" | "table">("grid")
  const [selectedSlot, setSelectedSlot] = React.useState<any | null>(null)
  
  // IoT Simulation State
  const [simulatedSlots, setSimulatedSlots] = React.useState<Record<string, { status: string; plate: string | null; lastSeenAt: string | null }>>({})
  const [simulationLogs, setSimulationLogs] = React.useState<Array<{ time: string; msg: string; type: "info" | "success" | "warn" | "error" }>>([
    { time: new Date().toLocaleTimeString("vi-VN"), msg: "SYS_SLOT_MONITOR // CORE_LOADED", type: "info" },
    { time: new Date().toLocaleTimeString("vi-VN"), msg: "Đang nhận tín hiệu cảm biến không dây từ IoT Gateway...", type: "info" }
  ])
  
  const [customPlate, setCustomPlate] = React.useState("")
  const [selectedSimulationSlotId, setSelectedSimulationSlotId] = React.useState("")

  // Log message helper
  const addLog = React.useCallback((msg: string, type: "info" | "success" | "warn" | "error" = "info") => {
    setSimulationLogs((prev) => [
      { time: new Date().toLocaleTimeString("vi-VN"), msg, type },
      ...prev.slice(0, 19)
    ])
  }, [])

  // Merge live slots with simulation modifications
  const slots = React.useMemo(() => {
    return rawSlots.map(slot => {
      const simulated = simulatedSlots[slot.id]
      if (simulated) {
        return {
          ...slot,
          status: simulated.status,
          plate: simulated.plate,
          lastSeenAt: simulated.lastSeenAt
        }
      }
      return slot
    })
  }, [rawSlots, simulatedSlots])

  // Stats computation
  const stats = React.useMemo(() => {
    const total = slots.length
    const available = slots.filter(s => s.status === "AVAILABLE" || s.status === "FREE").length
    const occupied = slots.filter(s => s.status === "OCCUPIED").length
    const reserved = slots.filter(s => s.status === "RESERVED").length
    const disabled = slots.filter(s => s.status === "DISABLED").length
    return { total, available, occupied, reserved, disabled }
  }, [slots])

  // Filter slots
  const filteredSlots = React.useMemo(() => {
    return slots.filter((slot) => {
      const matchesSearch =
        slot.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (slot.plate && slot.plate.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "AVAILABLE" && (slot.status === "AVAILABLE" || slot.status === "FREE")) ||
        (statusFilter === "OCCUPIED" && slot.status === "OCCUPIED") ||
        (statusFilter === "RESERVED" && slot.status === "RESERVED") ||
        (statusFilter === "DISABLED" && slot.status === "DISABLED")

      return matchesSearch && matchesStatus
    })
  }, [slots, searchQuery, statusFilter])

  // Random plates generator
  const handleRandomPlateGen = () => {
    const cities = ["30F", "29A", "30H", "51G", "51K", "43A", "37B", "15B"]
    const city = cities[Math.floor(Math.random() * cities.length)]
    const num1 = Math.floor(Math.random() * 900) + 100
    const num2 = Math.floor(Math.random() * 90) + 10
    setCustomPlate(`${city}-${num1}.${num2}`)
  }

  // Action: Simulate Parking Vehicle
  const handleSimulateCheckIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSimulationSlotId) {
      toast({
        title: "Simulation Error",
        description: "Vui lòng chọn ô đỗ trống cần kiểm thử.",
        variant: "destructive"
      })
      return
    }
    const targetSlot = slots.find(s => s.id === selectedSimulationSlotId)
    if (!targetSlot) return

    const plateStr = customPlate.trim().toUpperCase() || "30F-555.55"
    const timestamp = new Date().toISOString()

    setSimulatedSlots(prev => ({
      ...prev,
      [selectedSimulationSlotId]: {
        status: "OCCUPIED",
        plate: plateStr,
        lastSeenAt: timestamp
      }
    }))

    addLog(`Ô đỗ ${targetSlot.code} đã được cảm biến phát hiện phương tiện: ${plateStr}`, "success")
    toast({
      title: "IOT_SIMULATED_CHECKIN",
      description: `Đã giả lập xe ${plateStr} đỗ thành công vào ô ${targetSlot.code}.`,
    })

    setCustomPlate("")
    setSelectedSimulationSlotId("")
  }

  // Action: Simulate Vehicle Exit
  const handleSimulateCheckOut = (slotId: string) => {
    const targetSlot = slots.find(s => s.id === slotId)
    if (!targetSlot) return

    setSimulatedSlots(prev => ({
      ...prev,
      [slotId]: {
        status: "AVAILABLE",
        plate: null,
        lastSeenAt: new Date().toISOString()
      }
    }))

    addLog(`Cảm biến phát hiện phương tiện rời khỏi ô đỗ ${targetSlot.code}. Trạng thái: trống`, "warn")
    toast({
      title: "IOT_SIMULATED_CHECKOUT",
      description: `Đã giả lập giải phóng ô đỗ ${targetSlot.code} thành công.`,
    })

    if (selectedSlot && selectedSlot.id === slotId) {
      setSelectedSlot((prev: any) => ({
        ...prev,
        status: "AVAILABLE",
        plate: null,
        lastSeenAt: new Date().toISOString()
      }))
    }
  }

  // Action: Modify Override Status (ACTIVE/DISABLED/RESERVED)
  const handleAdminStatusOverride = (slotId: string, nextStatus: string) => {
    const targetSlot = slots.find(s => s.id === slotId)
    if (!targetSlot) return

    setSimulatedSlots(prev => ({
      ...prev,
      [slotId]: {
        status: nextStatus,
        plate: nextStatus === "OCCUPIED" ? (prev[slotId]?.plate || "30F-999.99") : null,
        lastSeenAt: new Date().toISOString()
      }
    }))

    addLog(`Lệnh ghi đè quản trị: Cập nhật ${targetSlot.code} thành: ${nextStatus}`, "info")
    toast({
      title: "ADMIN_OVERRIDE_SUCCESS",
      description: `Đã thay đổi trạng thái quản trị ô ${targetSlot.code} thành ${nextStatus}.`,
    })

    if (selectedSlot && selectedSlot.id === slotId) {
      setSelectedSlot((prev: any) => ({
        ...prev,
        status: nextStatus,
        plate: nextStatus === "OCCUPIED" ? (prev.plate || "30F-999.99") : null,
        lastSeenAt: new Date().toISOString()
      }))
    }
  }

  // Action: Reset Simulations
  const handleResetSimulations = () => {
    setSimulatedSlots({})
    addLog("Đã thiết lập lại trạng thái cảm biến. Đang tải dữ liệu thực tế từ API.", "warn")
    toast({
      title: "SYSTEM_SIMULATOR_RESET",
      description: "Đã xóa toàn bộ dữ liệu giả lập, tải lại dữ liệu thật từ máy chủ.",
    })
  }

  const loading = status === "loading" || status === "idle"
  const activeZoneName = React.useMemo(() => {
    if (!selectedZoneId) return "TẤT CẢ KHU VỰC"
    const matched = zones.find(z => z.id === selectedZoneId)
    return matched ? matched.name.toUpperCase() : "ZONE_NODE"
  }, [selectedZoneId, zones])

  return (
    <AdminPage className="space-y-6 bg-[#020617] text-slate-100 p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Visual Tech Corner Accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/20 pointer-events-none" />

      {/* Futuristic Backdrop Matrix Grids */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      {/* Sci-Fi Tech Header Banner */}
      <header className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 shadow-[0_0_25px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[9px] font-mono font-bold text-cyan-400">
                <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {"SENSOR_ARRAY // PARKING_SLOT_MONITOR"}
              </span>
              <span className="text-slate-800 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-widest uppercase">
                {activeZoneName}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white font-mono uppercase flex items-center gap-2">
              QUẢN LÝ Ô ĐỖ XE <span className="text-cyan-400">{"// DETECTOR_CELLS"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Trạng thái bận/trống thực tế của bãi xe được kết nối trực tiếp với cảm biến IoT thông minh và AI Camera. Tự động phản hồi ra/vào tức thì.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live real-time clock */}
            <div className="flex flex-col items-end px-3 py-1 rounded-lg border border-slate-900 bg-slate-950 font-mono text-xs shadow-inner min-w-[120px]">
              <span className="text-slate-600 text-[8px] uppercase tracking-wider font-bold">SYSTEM_UTC_VN</span>
              <span className="text-cyan-400 font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="h-10 px-3.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 font-mono text-xs hover:border-cyan-500/30 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              <span>NẠP LẠI API</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Micro-telemetry & Connection status bar */}
      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3.5 text-xs font-mono text-cyan-200 sm:flex-row sm:items-center shadow-lg">
          <div className="flex min-w-0 items-start gap-2">
            <Activity className="mt-0.5 size-4 shrink-0 text-cyan-400 animate-pulse" />
            <span className="min-w-0 uppercase text-[10px] tracking-wide leading-relaxed">
              {"REALTID_STATE // HYBRID_SYNC_MODE: Bảng thông tin tự động đồng bộ cảm biến định kỳ."}
            </span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-[10px] text-cyan-400/80 sm:ml-auto">
              ĐỒNG BỘ CUỐI: {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      )}

      {/* Cyber stats cards */}
      <section className="grid min-w-0 grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Thông số bãi xe">
        {[
          {
            label: "TỔNG SỐ Ô ĐỖ",
            value: loading && slots.length === 0 ? "..." : stats.total,
            icon: LayoutGrid,
            id: "TOTAL_CELLS",
            color: "text-blue-400",
            glow: "rgba(59,130,246,0.1)",
            border: "border-blue-500/20",
          },
          {
            label: "Ô TRỐNG (AVAILABLE)",
            value: loading && slots.length === 0 ? "..." : stats.available,
            icon: CheckCircle,
            id: "VACANT_NODES",
            color: "text-emerald-400",
            glow: "rgba(16,185,129,0.1)",
            border: "border-emerald-500/20",
            pulse: true,
          },
          {
            label: "CÓ XE (OCCUPIED)",
            value: loading && slots.length === 0 ? "..." : stats.occupied,
            icon: Car,
            id: "OCCUPIED_CELLS",
            color: "text-rose-400",
            glow: "rgba(244,63,94,0.1)",
            border: "border-rose-500/20",
          },
          {
            label: "ĐẶT TRƯỚC (RESERVED)",
            value: loading && slots.length === 0 ? "..." : stats.reserved,
            icon: Sliders,
            id: "RESERVED_POOL",
            color: "text-amber-400",
            glow: "rgba(245,158,11,0.1)",
            border: "border-amber-500/20",
          },
          {
            label: "BẢO TRÌ (DISABLED)",
            value: loading && slots.length === 0 ? "..." : stats.disabled,
            icon: Ban,
            id: "MAINT_BLOCKS",
            color: "text-slate-400",
            glow: "rgba(148,163,184,0.05)",
            border: "border-slate-500/20",
          },
        ].map(({ label, value, icon: Icon, id, color, glow, border, pulse }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border ${border} bg-slate-950 p-4 transition-all duration-300 hover:bg-slate-950/80 hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.3)]`}
            style={{
              boxShadow: `inset 0 0 14px ${glow}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500">[{id}]</span>
              {pulse && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                <Icon className={`size-4.5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider truncate">
                  {label}
                </p>
                <p className={`font-mono text-base sm:text-xl font-bold leading-none mt-1 ${color}`}>
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Main Grid controls and IoT simulation console */}
      <div className="grid gap-6 lg:grid-cols-4 items-start">
        {/* Left column: Controls, search filters and IoT terminal */}
        <div className="lg:col-span-1 space-y-6">
          {/* Filters card */}
          <div className="border border-slate-850 bg-slate-950 rounded-xl p-5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-700" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-700" />
            
            <div className="flex items-center gap-1.5 text-cyan-400 border-b border-slate-900 pb-3 mb-4">
              <Search className="h-4 w-4 text-cyan-500" />
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">
                BỘ LỌC CONSOLE
              </h3>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="space-y-2">
                <Label htmlFor="search-input" className="text-slate-400 uppercase text-[9px] tracking-widest font-bold">Tìm ô đỗ / biển số</Label>
                <div className="relative">
                  <Input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Mã: A01, Xe: 30F..."
                    className="bg-slate-950 border-slate-800 text-cyan-300 placeholder-slate-700 h-9 pl-8 text-xs rounded pr-3 focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500/40"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-700" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400 uppercase text-[9px] tracking-widest font-bold">Lọc trạng thái</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "ALL", name: "TẤT CẢ" },
                    { key: "AVAILABLE", name: "TRỐNG" },
                    { key: "OCCUPIED", name: "CÓ XE" },
                    { key: "RESERVED", name: "ĐẶT TRƯỚC" },
                    { key: "DISABLED", name: "BẢO TRÌ" },
                  ].map((f) => (
                    <Button
                      key={f.key}
                      variant={statusFilter === f.key ? "default" : "outline"}
                      onClick={() => setStatusFilter(f.key)}
                      className={`h-8 text-[9px] tracking-wide rounded border font-mono uppercase ${
                        statusFilter === f.key
                          ? "bg-cyan-500 hover:bg-cyan-600 text-slate-950 border-cyan-500"
                          : "border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* IoT Active Simulation Panel */}
          <div className="border border-slate-850 bg-slate-950 rounded-xl p-5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/40" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/40" />
            
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Terminal className="h-4 w-4 text-cyan-500 animate-pulse" />
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider">
                  THIẾT BỊ GIẢ LẬP IOT
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetSimulations}
                className="h-6 w-6 text-slate-500 hover:text-white hover:bg-slate-900 rounded"
                title="Khôi phục trạng thái thật"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <p className="text-[10px] font-mono text-slate-500 uppercase mb-4 leading-relaxed">
              Nhập biển số để mô phỏng xe đỗ vào một ô đỗ trống trong bãi xe và kích hoạt tín hiệu gửi về máy chủ.
            </p>

            <form onSubmit={handleSimulateCheckIn} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="sim-slot" className="text-slate-400 uppercase text-[9px] tracking-widest font-bold">Chọn ô đỗ trống</Label>
                <select
                  id="sim-slot"
                  value={selectedSimulationSlotId}
                  onChange={(e) => setSelectedSimulationSlotId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-cyan-300 h-9 px-2 text-xs rounded focus:ring-0 focus:border-cyan-500/30"
                >
                  <option value="">-- CHỌN Ô ĐỖ TRỐNG --</option>
                  {slots
                    .filter(s => s.status === "AVAILABLE" || s.status === "FREE")
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.code} ({s.zoneId ? `Zone: ${s.zoneId.slice(0, 4)}` : "No zone"})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sim-plate" className="text-slate-400 uppercase text-[9px] tracking-widest font-bold flex justify-between items-center">
                  <span>Biển số xe giả lập</span>
                  <button
                    type="button"
                    onClick={handleRandomPlateGen}
                    className="text-[8px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 uppercase border-b border-cyan-400/40"
                  >
                    <Zap className="h-2 w-2" /> Ngẫu nhiên
                  </button>
                </Label>
                <Input
                  id="sim-plate"
                  type="text"
                  required
                  placeholder="Ví dụ: 30F-123.45"
                  value={customPlate}
                  onChange={(e) => setCustomPlate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-cyan-300 placeholder-slate-700 h-9 px-3 text-xs rounded focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500/30 font-bold tracking-wide uppercase"
                />
              </div>

              <Button
                type="submit"
                disabled={!selectedSimulationSlotId}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold uppercase tracking-wider text-[10px] h-9 rounded flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                <Play className="h-3.5 w-3.5" />
                MÔ PHỎNG ĐỖ XE
              </Button>
            </form>
          </div>

          {/* Real-time Logger Terminal */}
          <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 shadow-xl">
            <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full animate-ping" />
              LIVE_IOT_TERMINAL_LOG
            </span>
            <div className="bg-slate-950 border border-slate-900 p-2.5 rounded font-mono text-[9px] h-44 overflow-y-auto space-y-2 select-all text-slate-400">
              {simulationLogs.map((log, index) => (
                <div key={index} className="leading-normal border-b border-slate-950 pb-1 flex items-start gap-1">
                  <span className="text-slate-600 shrink-0">[{log.time}]</span>
                  <span className={
                    log.type === "success" ? "text-emerald-400" :
                    log.type === "warn" ? "text-amber-400" :
                    log.type === "error" ? "text-rose-400" :
                    "text-cyan-400"
                  }>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Grid visualizer & Data table */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-850">
            {/* Tab selection */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg">
              <Button
                size="sm"
                variant={activeTab === "grid" ? "default" : "ghost"}
                onClick={() => setActiveTab("grid")}
                className={`h-8 font-mono text-xs rounded px-4 flex items-center gap-1.5 ${
                  activeTab === "grid"
                    ? "bg-cyan-500 text-slate-950 hover:bg-cyan-600 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-950"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                SƠ ĐỒ LƯỚI
              </Button>
              <Button
                size="sm"
                variant={activeTab === "table" ? "default" : "ghost"}
                onClick={() => setActiveTab("table")}
                className={`h-8 font-mono text-xs rounded px-4 flex items-center gap-1.5 ${
                  activeTab === "table"
                    ? "bg-cyan-500 text-slate-950 hover:bg-cyan-600 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-950"
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                BẢNG THÔNG SỐ
              </Button>
            </div>

            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider pr-2">
              HIỂN THỊ: <span className="text-cyan-400 font-bold">{filteredSlots.length}</span> / {slots.length} CELL_NODES
            </div>
          </div>

          {loading && slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 p-10 text-center font-mono text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
              <p className="text-xs uppercase tracking-widest">Đang kết nối tới trạm điều khiển bãi xe...</p>
              <p className="text-[10px] text-slate-600 uppercase mt-1">Connecting to gateway IoT API</p>
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-slate-850 rounded-2xl bg-slate-950/40 p-10 text-center font-mono">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-3 animate-bounce" />
              <p className="text-xs uppercase text-slate-300 font-bold tracking-wider">Không tìm thấy ô đỗ phù hợp</p>
              <p className="text-[10px] text-slate-500 uppercase mt-1">Vui lòng thay đổi cấu hình bộ lọc hoặc từ khóa tìm kiếm</p>
            </div>
          ) : activeTab === "grid" ? (
            /* Tab 1: Technology Grid visualizer */
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredSlots.map((slot) => {
                const isOccupied = slot.status === "OCCUPIED"
                const isAvailable = slot.status === "AVAILABLE" || slot.status === "FREE"
                const isReserved = slot.status === "RESERVED"
                const isDisabled = slot.status === "DISABLED"

                return (
                  <div
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`relative cursor-pointer select-none rounded-xl border p-4 transition-all duration-300 bg-slate-950/70 hover:scale-[1.03] group ${
                      isOccupied
                        ? "border-rose-500/30 hover:border-rose-500 shadow-[0_4px_20px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                        : isAvailable
                        ? "border-emerald-500/30 hover:border-emerald-500 shadow-[0_4px_20px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : isReserved
                        ? "border-amber-500/30 hover:border-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.05)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                        : "border-slate-800 hover:border-slate-500"
                    }`}
                  >
                    {/* Tech corners decoration */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-700 group-hover:border-cyan-400" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-700 group-hover:border-cyan-400" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-700 group-hover:border-cyan-400" />
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-700 group-hover:border-cyan-400" />

                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] text-slate-500">CELL_N_{slot.id.slice(0, 4)}</span>
                      {/* Glow Indicator LED */}
                      <span className={`h-2 w-2 rounded-full flex ${
                        isOccupied ? "bg-rose-500 shadow-[0_0_8px_#ef4444]" :
                        isAvailable ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" :
                        isReserved ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" :
                        "bg-slate-700"
                      }`} />
                    </div>

                    <div className="mt-3 text-center space-y-1">
                      <div className="font-mono text-lg font-black tracking-widest text-white uppercase group-hover:text-cyan-300 transition-colors">
                        {slot.code}
                      </div>
                      <div className="font-mono text-[9px] text-slate-500 uppercase tracking-wider truncate">
                        {isOccupied ? "CÓ XE" : isAvailable ? "TRỐNG" : isReserved ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-900/60 min-h-[34px] flex items-center justify-center">
                      {isOccupied && slot.plate ? (
                        <div className="font-mono text-[10px] font-bold text-rose-400 border border-rose-500/30 bg-rose-950/20 px-1.5 py-0.5 rounded tracking-wide uppercase shadow-sm select-all">
                          {slot.plate}
                        </div>
                      ) : (
                        <div className="font-mono text-[9px] text-slate-600 uppercase tracking-widest">
                          {isAvailable ? "AVAILABLE" : isReserved ? "RESERVED" : "DISABLED"}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Tab 2: Dense technical data table */
            <div className="border border-slate-850 bg-slate-950/40 rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-slate-500 uppercase text-[9px] tracking-widest">
                      <th className="p-4">Ô ĐỖ</th>
                      <th className="p-4">MÃ ĐỊNH DANH</th>
                      <th className="p-4">ZONE_ID</th>
                      <th className="p-4">TRẠNG THÁI</th>
                      <th className="p-4">BIỂN SỐ XE</th>
                      <th className="p-4">CẢM BIẾN CUỐI</th>
                      <th className="p-4 text-right">ĐIỀU HÀNH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/80">
                    {filteredSlots.map((slot) => {
                      const isOccupied = slot.status === "OCCUPIED"
                      const isAvailable = slot.status === "AVAILABLE" || slot.status === "FREE"
                      const isReserved = slot.status === "RESERVED"
                      const isDisabled = slot.status === "DISABLED"

                      return (
                        <tr key={slot.id} className="hover:bg-slate-950/60 transition-colors group">
                          <td className="p-4 font-bold text-white text-sm tracking-widest">
                            <span className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                isOccupied ? "bg-rose-500" :
                                isAvailable ? "bg-emerald-500" :
                                isReserved ? "bg-amber-500" :
                                "bg-slate-700"
                              }`} />
                              {slot.code}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 text-[10px] tracking-wider select-all">
                            {slot.id}
                          </td>
                          <td className="p-4 text-slate-400">
                            {slot.zoneId ? `ZONE_${slot.zoneId.slice(0, 8).toUpperCase()}` : "—"}
                          </td>
                          <td className="p-4">
                            <Badge className={`font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 border ${
                              isOccupied ? "bg-rose-950/30 text-rose-400 border-rose-500/20" :
                              isAvailable ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/20" :
                              isReserved ? "bg-amber-950/30 text-amber-400 border-amber-500/20" :
                              "bg-slate-900 text-slate-400 border-slate-800"
                            }`}>
                              {isOccupied ? "CÓ XE" : isAvailable ? "TRỐNG" : isReserved ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                            </Badge>
                          </td>
                          <td className="p-4 font-bold">
                            {isOccupied && slot.plate ? (
                              <span className="text-rose-400 select-all tracking-wider uppercase">{slot.plate}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-500 text-[10px] tracking-wider">
                            {slot.lastSeenAt ? new Date(slot.lastSeenAt).toLocaleString("vi-VN") : "CHƯA NHẬN TÍN HIỆU"}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSlot(slot)}
                              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-900 rounded"
                            >
                              <Eye className="h-4.5 w-4.5 text-cyan-400" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Futuristic Slot Inspector Detail Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        {selectedSlot && (
          <DialogContent className="bg-slate-950 border border-slate-850 text-slate-100 max-w-lg font-mono">
            {/* Tech accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

            <DialogHeader className="border-b border-slate-900 pb-3 mb-4">
              <DialogTitle className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-cyan-500 animate-spin" />
                SLOT_INSPECTOR_CORE // {selectedSlot.code}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-slate-500 uppercase">
                MÃ THIẾT BỊ KHU VỰC: {selectedSlot.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Main specifications */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-850 rounded">
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest block">TRẠNG THÁI CẢM BIẾN</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`h-2 w-2 rounded-full ${
                      selectedSlot.status === "OCCUPIED" ? "bg-rose-500 shadow-[0_0_8px_#ef4444]" :
                      (selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE") ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" :
                      selectedSlot.status === "RESERVED" ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" :
                      "bg-slate-700"
                    }`} />
                    <span className="font-bold text-white text-[11px] tracking-wide">
                      {selectedSlot.status === "OCCUPIED" ? "CÓ PHƯƠNG TIỆN" :
                       (selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE") ? "ĐANG TRỐNG" :
                       selectedSlot.status === "RESERVED" ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-850 rounded">
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest block">KHU VỰC QUẢN LÝ (ZONE)</span>
                  <span className="font-bold text-cyan-400 block mt-1 tracking-wider">
                    {selectedSlot.zoneId ? `ZONE_${selectedSlot.zoneId.slice(0, 8).toUpperCase()}` : "HỆ THỐNG CHUNG"}
                  </span>
                </div>
              </div>

              {/* Occupying Vehicle Data */}
              <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded space-y-2">
                <span className="text-[8px] text-slate-500 uppercase tracking-widest block">THÔNG TIN PHƯƠNG TIỆN HIỆN TẠI</span>
                {selectedSlot.status === "OCCUPIED" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4.5 w-4.5 text-rose-400 animate-bounce" />
                        <span className="text-sm font-extrabold text-white tracking-widest bg-rose-950/30 px-2.5 py-0.5 rounded border border-rose-500/30 select-all">
                          {selectedSlot.plate || "30F-111.11"}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500">IOT_RFID_ACTIVE</span>
                    </div>

                    <div className="space-y-1 text-[10px] text-slate-400 uppercase pt-2 border-t border-slate-950">
                      <div className="flex justify-between">
                        <span>Thời gian đỗ:</span>
                        <span className="text-white">Hôm nay, {selectedSlot.lastSeenAt ? new Date(selectedSlot.lastSeenAt).toLocaleTimeString("vi-VN") : "vừa mới đây"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tần số cảm biến:</span>
                        <span className="text-emerald-400 font-bold">915 MHz (Chất lượng 98%)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center text-slate-500">
                    <Info className="h-5 w-5 text-slate-600 mb-1" />
                    <span className="uppercase text-[9px] tracking-widest">Không có phương tiện tại vị trí này</span>
                  </div>
                )}
              </div>

              {/* Polygon Vertex SVG Preview (Extreme technology feel!) */}
              {selectedSlot.polygon && selectedSlot.polygon.length > 0 && (
                <div className="p-3 bg-slate-900 border border-slate-850 rounded space-y-2">
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest block">TỌA ĐỘ VÙNG PHỦ SÓNG CAMERA (POLYGON)</span>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-950 border border-slate-850 p-1.5 rounded">
                      <svg width="100" height="60" viewBox="0 0 100 100" className="text-cyan-500">
                        <polygon
                          points={selectedSlot.polygon.map((p: any) => `${p.x / 10},${p.y / 10}`).join(" ")}
                          fill="rgba(6,182,212,0.15)"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="space-y-1 text-[9px] text-slate-500 uppercase leading-relaxed font-mono">
                      <div>Đỉnh điểm: <span className="text-cyan-400">{selectedSlot.polygon.length} VERTICES</span></div>
                      <div className="max-w-[200px] truncate" title={JSON.stringify(selectedSlot.polygon)}>
                        X, Y: {selectedSlot.polygon.slice(0, 2).map((p: any) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(" ")}...
                      </div>
                      <span className="text-emerald-500 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> HIỆU CHUẨN CHUẨN 2D
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Override Actions for Admin console */}
              <div className="border-t border-slate-900 pt-4 space-y-3">
                <span className="text-[8px] text-slate-500 uppercase tracking-widest block font-bold">GHI ĐÈ TÍN HIỆU QUẢN TRỊ // COMMANDS</span>
                
                <div className="grid grid-cols-2 gap-2">
                  {selectedSlot.status === "OCCUPIED" ? (
                    <Button
                      onClick={() => handleSimulateCheckOut(selectedSlot.id)}
                      className="w-full bg-rose-950 hover:bg-rose-900 text-rose-400 hover:text-rose-300 font-bold border border-rose-500/30 text-[10px] h-9 rounded uppercase"
                    >
                      MÔ PHỎNG XE RỜI ĐỖ
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        const randomPlates = ["30H-888.88", "29A-678.99", "51G-543.21", "30K-123.45"]
                        const plate = randomPlates[Math.floor(Math.random() * randomPlates.length)]
                        setSimulatedSlots(prev => ({
                          ...prev,
                          [selectedSlot.id]: {
                            status: "OCCUPIED",
                            plate,
                            lastSeenAt: new Date().toISOString()
                          }
                        }))
                        addLog(`Ô đỗ ${selectedSlot.code} đã được xe ${plate} chiếm dụng giả lập.`, "success")
                        toast({
                          title: "MÔ PHỎNG ĐỖ XE",
                          description: `Đã xe ${plate} chiếm dụng ô ${selectedSlot.code}.`,
                        })
                        setSelectedSlot((prev: any) => ({
                          ...prev,
                          status: "OCCUPIED",
                          plate,
                          lastSeenAt: new Date().toISOString()
                        }))
                      }}
                      className="w-full bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 font-bold border border-emerald-500/30 text-[10px] h-9 rounded uppercase"
                    >
                      MÔ PHỎNG ĐỖ XE
                    </Button>
                  )}

                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "DISABLED")}
                    disabled={selectedSlot.status === "DISABLED"}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold border border-slate-800 text-[10px] h-9 rounded uppercase"
                  >
                    ĐẶT BẢO TRÌ/KHOÁ
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "AVAILABLE")}
                    disabled={selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE"}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold border border-slate-800 text-[10px] h-9 rounded uppercase"
                  >
                    MỞ KHÓA VÀ TRỐNG
                  </Button>

                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "RESERVED")}
                    disabled={selectedSlot.status === "RESERVED"}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold border border-slate-800 text-[10px] h-9 rounded uppercase"
                  >
                    THIẾT LẬP ĐẶT TRƯỚC
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-900 text-right">
              <Button
                variant="outline"
                onClick={() => setSelectedSlot(null)}
                className="border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 h-9 px-4 rounded text-[10px] uppercase font-mono"
              >
                ĐÓNG BẢNG
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AdminPage>
  )
}
