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
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
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
    <AdminPage className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        eyebrow="Quản lý bãi xe"
        title="Quản lý ô đỗ xe"
        description="Trạng thái bận/trống thực tế của bãi xe được kết nối trực tiếp với cảm biến IoT thông minh và AI Camera. Tự động phản hồi ra/vào tức thì."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Live real-time clock */}
            <div className="flex flex-col items-end px-3 py-1 rounded-xl border border-border bg-card font-mono text-xs shadow-sm min-w-[120px]">
              <span className="text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Giờ hệ thống</span>
              <span className="text-primary font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
              <span>Nạp lại API</span>
            </Button>
          </div>
        }
      />

      {/* Connection status bar */}
      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-primary sm:flex-row sm:items-center shadow-sm">
          <div className="flex min-w-0 items-start gap-2">
            <Activity className="mt-0.5 size-4 shrink-0 text-primary animate-pulse" />
            <span className="min-w-0 uppercase text-[10px] tracking-wide leading-relaxed font-semibold">
              Đồng bộ cảm biến định kỳ: Bảng thông tin tự động đồng bộ cảm biến định kỳ từ Gateway.
            </span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-[10px] text-primary/80 sm:ml-auto">
              ĐỒNG BỘ CUỐI: {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      )}

      {/* Stats cards */}
      <section className="grid min-w-0 grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Thông số bãi xe">
        {[
          {
            label: "TỔNG SỐ Ô ĐỖ",
            value: loading && slots.length === 0 ? "..." : stats.total,
            icon: LayoutGrid,
            color: "text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
          },
          {
            label: "Ô TRỐNG (AVAILABLE)",
            value: loading && slots.length === 0 ? "..." : stats.available,
            icon: CheckCircle,
            color: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            pulse: true,
          },
          {
            label: "CÓ XE (OCCUPIED)",
            value: loading && slots.length === 0 ? "..." : stats.occupied,
            icon: Car,
            color: "text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
          },
          {
            label: "ĐẶT TRƯỚC (RESERVED)",
            value: loading && slots.length === 0 ? "..." : stats.reserved,
            icon: Sliders,
            color: "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "BẢO TRÌ (DISABLED)",
            value: loading && slots.length === 0 ? "..." : stats.disabled,
            icon: Ban,
            color: "text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
          },
        ].map(({ label, value, icon: Icon, color, pulse }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:scale-[1.02] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              {pulse && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${color}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
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
          <div className="border border-border bg-card rounded-xl p-5 relative overflow-hidden shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-1.5 text-primary border-b border-border pb-3 mb-4">
              <Search className="h-4 w-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                BỘ LỌC TÌM KIẾM
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label htmlFor="search-input" className="text-muted-foreground uppercase text-[9px] tracking-widest font-bold">Tìm ô đỗ / biển số</Label>
                <div className="relative">
                  <Input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Mã: A01, Xe: 30F..."
                    className="bg-background border-border text-foreground h-9 pl-8 text-xs rounded-xl focus-visible:ring-primary/20"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground uppercase text-[9px] tracking-widest font-bold">Lọc trạng thái</Label>
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
                      className={`h-8 text-[9px] tracking-wide rounded-lg font-mono uppercase border ${
                        statusFilter === f.key
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
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
          <div className="border border-border bg-card rounded-xl p-5 relative overflow-hidden shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-1.5 text-primary">
                <Terminal className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  MÔ PHỎNG CẢM BIẾN IOT
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetSimulations}
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                title="Khôi phục trạng thái thật"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground uppercase mb-4 leading-relaxed">
              Chọn ô đỗ và nhập biển số để mô phỏng xe đỗ vào một ô trống trong bãi xe và kích hoạt tín hiệu gửi về máy chủ.
            </p>

            <form onSubmit={handleSimulateCheckIn} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="sim-slot" className="text-muted-foreground uppercase text-[9px] tracking-widest font-bold">Chọn ô đỗ trống</Label>
                <select
                  id="sim-slot"
                  value={selectedSimulationSlotId}
                  onChange={(e) => setSelectedSimulationSlotId(e.target.value)}
                  className="w-full bg-background border border-border text-foreground h-9 px-2 text-xs rounded-xl focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
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
                <Label htmlFor="sim-plate" className="text-muted-foreground uppercase text-[9px] tracking-widest font-bold flex justify-between items-center">
                  <span>Biển số xe giả lập</span>
                  <button
                    type="button"
                    onClick={handleRandomPlateGen}
                    className="text-[8px] text-primary hover:text-primary/80 flex items-center gap-0.5 uppercase border-b border-primary/40"
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
                  className="bg-background border-border text-foreground h-9 px-3 text-xs rounded-xl focus-visible:ring-primary/20 font-bold tracking-wide uppercase font-mono"
                />
              </div>

              <Button
                type="submit"
                disabled={!selectedSimulationSlotId}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-[10px] h-9 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <Play className="h-3.5 w-3.5" />
                MÔ PHỎNG ĐỖ XE
              </Button>
            </form>
          </div>

          {/* Real-time Logger Terminal */}
          <div className="border border-border bg-card rounded-xl p-4 shadow-[var(--shadow-card)]">
            <span className="block font-mono text-[8px] text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1 font-bold">
              <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
              Nhật ký hoạt động cảm biến
            </span>
            <div className="bg-slate-950 dark:bg-slate-900 border border-border p-2.5 rounded-lg font-mono text-[9px] h-44 overflow-y-auto space-y-2 select-all text-slate-300">
              {simulationLogs.map((log, index) => (
                <div key={index} className="leading-normal border-b border-slate-900 dark:border-slate-800 pb-1 flex items-start gap-1">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
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
          <div className="flex items-center justify-between bg-card p-2.5 rounded-xl border border-border shadow-sm">
            {/* Tab selection */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              <Button
                size="sm"
                variant={activeTab === "grid" ? "default" : "ghost"}
                onClick={() => setActiveTab("grid")}
                className={`h-8 text-xs rounded-lg px-4 flex items-center gap-1.5 ${
                  activeTab === "grid"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Sơ đồ lưới</span>
              </Button>
              <Button
                size="sm"
                variant={activeTab === "table" ? "default" : "ghost"}
                onClick={() => setActiveTab("table")}
                className={`h-8 text-xs rounded-lg px-4 flex items-center gap-1.5 ${
                  activeTab === "table"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Bảng thông số</span>
              </Button>
            </div>

            <div className="text-xs text-muted-foreground pr-2 font-medium">
              Hiển thị: <span className="text-primary font-bold">{filteredSlots.length}</span> / {slots.length} ô đỗ
            </div>
          </div>

          {loading && slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-border rounded-2xl bg-card p-10 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-xs uppercase tracking-wider font-semibold">Đang kết nối tới API bãi xe...</p>
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-border rounded-2xl bg-card p-10 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-3 animate-bounce" />
              <p className="text-xs font-bold text-foreground">Không tìm thấy ô đỗ phù hợp</p>
              <p className="text-[11px] text-muted-foreground mt-1">Vui lòng thay đổi cấu hình bộ lọc hoặc từ khóa tìm kiếm</p>
            </div>
          ) : activeTab === "grid" ? (
            /* Tab 1: Grid visualizer */
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredSlots.map((slot) => {
                const isOccupied = slot.status === "OCCUPIED"
                const isAvailable = slot.status === "AVAILABLE" || slot.status === "FREE"
                const isReserved = slot.status === "RESERVED"

                return (
                  <div
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`relative cursor-pointer select-none rounded-xl border p-4 transition-all duration-350 bg-card hover:scale-[1.03] group shadow-sm hover:shadow-md ${
                      isOccupied
                        ? "border-rose-500/20 hover:border-rose-500 dark:border-rose-500/30"
                        : isAvailable
                        ? "border-emerald-500/20 hover:border-emerald-500 dark:border-emerald-500/30"
                        : isReserved
                        ? "border-amber-500/20 hover:border-amber-500 dark:border-amber-500/30"
                        : "border-border hover:border-foreground/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground font-mono">ID: {slot.id.slice(0, 4)}</span>
                      {/* Status Indicator LED */}
                      <span className={`h-2.5 w-2.5 rounded-full flex ${
                        isOccupied ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                        isAvailable ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" :
                        isReserved ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                        "bg-slate-400 dark:bg-slate-600"
                      }`} />
                    </div>

                    <div className="mt-3 text-center space-y-1">
                      <div className="font-bold text-lg tracking-widest text-foreground uppercase group-hover:text-primary transition-colors font-mono">
                        {slot.code}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {isOccupied ? "CÓ XE" : isAvailable ? "TRỐNG" : isReserved ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-border min-h-[34px] flex items-center justify-center">
                      {isOccupied && slot.plate ? (
                        <div className="font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 rounded-lg tracking-wide uppercase shadow-sm select-all">
                          {slot.plate}
                        </div>
                      ) : (
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {isAvailable ? "SẴN SÀNG" : isReserved ? "ĐÃ ĐẶT" : "BẢO TRÌ"}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Tab 2: Data table */
            <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[9px] tracking-wider font-bold">
                      <th className="p-4">Ô ĐỖ</th>
                      <th className="p-4">MÃ ĐỊNH DANH</th>
                      <th className="p-4">KHU VỰC</th>
                      <th className="p-4">TRẠNG THÁI</th>
                      <th className="p-4">BIỂN SỐ XE</th>
                      <th className="p-4">CẬP NHẬT CUỐI</th>
                      <th className="p-4 text-right">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSlots.map((slot) => {
                      const isOccupied = slot.status === "OCCUPIED"
                      const isAvailable = slot.status === "AVAILABLE" || slot.status === "FREE"
                      const isReserved = slot.status === "RESERVED"

                      return (
                        <tr key={slot.id} className="hover:bg-muted/35 transition-colors group">
                          <td className="p-4 font-bold text-foreground text-sm tracking-wide font-mono">
                            <span className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                isOccupied ? "bg-rose-500" :
                                isAvailable ? "bg-emerald-500" :
                                isReserved ? "bg-amber-500" :
                                "bg-slate-400"
                              }`} />
                              {slot.code}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground text-[10px] tracking-wider select-all font-mono">
                            {slot.id}
                          </td>
                          <td className="p-4 text-muted-foreground font-medium">
                            {slot.zoneId ? `Zone: ${slot.zoneId.slice(0, 8).toUpperCase()}` : "—"}
                          </td>
                          <td className="p-4">
                            <Badge className={`text-[9px] tracking-widest uppercase px-2 py-0.5 border ${
                              isOccupied ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" :
                              isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                              isReserved ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                              "bg-slate-500/10 text-slate-500 border-slate-500/20"
                            }`}>
                              {isOccupied ? "CÓ XE" : isAvailable ? "TRỐNG" : isReserved ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                            </Badge>
                          </td>
                          <td className="p-4 font-bold font-mono">
                            {isOccupied && slot.plate ? (
                              <span className="text-rose-600 dark:text-rose-400 select-all tracking-wider uppercase">{slot.plate}</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">—</span>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground text-[10px] tracking-wider font-mono">
                            {slot.lastSeenAt ? new Date(slot.lastSeenAt).toLocaleString("vi-VN") : "CHƯA NHẬN TÍN HIỆU"}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSlot(slot)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                            >
                              <Eye className="h-4.5 w-4.5 text-primary" />
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

      {/* Slot Inspector Detail Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        {selectedSlot && (
          <DialogContent className="max-w-md bg-card border border-border text-foreground">
            <DialogHeader className="border-b border-border pb-3 mb-4">
              <DialogTitle className="text-base font-bold uppercase tracking-wide flex items-center gap-1.5 text-primary">
                <Settings className="h-4.5 w-4.5 text-primary" />
                <span>Chi tiết ô đỗ {selectedSlot.code}</span>
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground uppercase font-mono">
                MÃ ĐỊNH DANH: {selectedSlot.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Main specifications */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 border border-border rounded-xl">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-semibold">TRẠNG THÁI</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`h-2 w-2 rounded-full ${
                      selectedSlot.status === "OCCUPIED" ? "bg-rose-500" :
                      (selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE") ? "bg-emerald-500 animate-pulse" :
                      selectedSlot.status === "RESERVED" ? "bg-amber-500" :
                      "bg-slate-400"
                    }`} />
                    <span className="font-bold text-sm">
                      {selectedSlot.status === "OCCUPIED" ? "ĐANG CÓ XE" :
                       (selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE") ? "ĐANG TRỐNG" :
                       selectedSlot.status === "RESERVED" ? "ĐẶT TRƯỚC" : "BẢO TRÌ"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 border border-border rounded-xl">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-semibold">KHU VỰC QUẢN LÝ</span>
                  <span className="font-bold text-primary block mt-1">
                    {selectedSlot.zoneId ? `Zone: ${selectedSlot.zoneId.slice(0, 8).toUpperCase()}` : "Chưa cấu hình"}
                  </span>
                </div>
              </div>

              {/* Occupying Vehicle Data */}
              <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-semibold">THÔNG TIN XE ĐANG ĐỖ</span>
                {selectedSlot.status === "OCCUPIED" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4.5 w-4.5 text-rose-500" />
                        <span className="text-sm font-extrabold tracking-widest bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-lg border border-rose-500/20 select-all font-mono">
                          {selectedSlot.plate || "30F-111.11"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">Camera AI / Sensor</span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground pt-2 border-t border-border">
                      <div className="flex justify-between">
                        <span>Thời gian phát hiện:</span>
                        <span className="text-foreground font-semibold">Hôm nay, {selectedSlot.lastSeenAt ? new Date(selectedSlot.lastSeenAt).toLocaleTimeString("vi-VN") : "vừa mới đây"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
                    <Info className="h-5 w-5 text-muted-foreground/60 mb-1" />
                    <span>Không có phương tiện tại vị trí này</span>
                  </div>
                )}
              </div>

              {/* Polygon Vertex SVG Preview */}
              {selectedSlot.polygon && selectedSlot.polygon.length > 0 && (
                <div className="p-3 bg-muted/50 border border-border rounded-xl space-y-2">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-semibold">VÙNG PHỦ SÓNG CAMERA (POLYGON)</span>
                  <div className="flex items-center gap-3">
                    <div className="bg-background border border-border p-1.5 rounded-lg">
                      <svg width="100" height="60" viewBox="0 0 100 100" className="text-primary">
                        <polygon
                          points={selectedSlot.polygon.map((p: any) => `${p.x / 10},${p.y / 10}`).join(" ")}
                          fill="currentColor"
                          fillOpacity="0.1"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="space-y-1 text-[10px] text-muted-foreground leading-relaxed font-mono">
                      <div>Tọa độ: <span className="text-primary font-bold">{selectedSlot.polygon.length} điểm đỉnh</span></div>
                      <div className="max-w-[200px] truncate" title={JSON.stringify(selectedSlot.polygon)}>
                        X, Y: {selectedSlot.polygon.slice(0, 2).map((p: any) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(" ")}...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Override Actions */}
              <div className="border-t border-border pt-4 space-y-3">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-bold">GHI ĐÈ TRẠNG THÁI (GIẢ LẬP)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  {selectedSlot.status === "OCCUPIED" ? (
                    <Button
                      onClick={() => handleSimulateCheckOut(selectedSlot.id)}
                      className="w-full bg-rose-50 hover:bg-rose-600 text-rose-foreground font-bold text-[10px] h-9 rounded-xl uppercase"
                    >
                      Mô phỏng xe rời đi
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
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] h-9 rounded-xl uppercase"
                    >
                      Mô phỏng đỗ xe
                    </Button>
                  )}

                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "DISABLED")}
                    disabled={selectedSlot.status === "DISABLED"}
                    variant="outline"
                    className="w-full border-border bg-background hover:bg-muted font-bold text-[10px] h-9 rounded-xl uppercase"
                  >
                    Bảo trì / Khóa ô
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "AVAILABLE")}
                    disabled={selectedSlot.status === "AVAILABLE" || selectedSlot.status === "FREE"}
                    variant="outline"
                    className="w-full border-border bg-background hover:bg-muted font-bold text-[10px] h-9 rounded-xl uppercase"
                  >
                    Mở khóa (Trống)
                  </Button>

                  <Button
                    onClick={() => handleAdminStatusOverride(selectedSlot.id, "RESERVED")}
                    disabled={selectedSlot.status === "RESERVED"}
                    variant="outline"
                    className="w-full border-border bg-background hover:bg-muted font-bold text-[10px] h-9 rounded-xl uppercase"
                  >
                    Thiết lập Đặt trước
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border text-right">
              <Button
                variant="outline"
                onClick={() => setSelectedSlot(null)}
                className="border-border bg-background text-muted-foreground hover:text-foreground h-9 px-4 rounded-xl text-[10px] uppercase font-semibold"
              >
                Đóng
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AdminPage>
  )
}
