"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CarFront,
  Clock3,
  ImageIcon,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { useToast } from "@/hooks/use-toast"
import { dataService } from "@/lib/data-service"
import { getImageUrl } from "@/lib/api/config"
import { vehicleApi } from "@/lib/api/vehicle-api"
import { type EmployeeVehicleInfo, type VehicleLog, type VehicleLogStatistics, vehicleLogApi } from "@/lib/api/vehicle-log-api"
import { type EmployeeVehicleCheckMessage, type VehicleCheckMessage, useWebSocket } from "@/hooks/use-websocket"

type MovementFilter = "all" | "entry" | "exit"
type VehicleFilter = "all" | "internal" | "external"

const movementLabel = (type?: string) => (type?.toLowerCase() === "entry" ? "Vào cổng" : "Ra cổng")

const formatTimestamp = (value?: string) => {
  if (!value) return "—"
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  })
}

const vehicleDescription = (log?: VehicleLog | null, detail?: EmployeeVehicleInfo | null) => {
  const brand = detail?.brand ?? log?.vehicleBrand
  const model = detail?.model ?? log?.vehicleModel
  const color = detail?.color ?? log?.vehicleColor
  return [brand, model, color].filter(Boolean).join(" · ") || "Chưa có thông tin xe"
}

export default function VehicleMonitoringPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<VehicleLog[]>([])
  const [statistics, setStatistics] = useState<VehicleLogStatistics | null>(null)
  const [insideVehicleCount, setInsideVehicleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all")
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("all")
  const [selectedLog, setSelectedLog] = useState<VehicleLog | null>(null)
  const [vehicleDetail, setVehicleDetail] = useState<EmployeeVehicleInfo | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadVehicleDetail = useCallback(async (log: VehicleLog) => {
    setSelectedLog(log)
    setVehicleDetail(null)
    setDetailLoading(true)
    try {
      const detail = await dataService.getEmployeeInfoByLicensePlate(log.licensePlateNumber, log.type)
      setVehicleDetail(detail)
    } catch {
      // A gate event may not have an associated person or managed vehicle yet.
      setVehicleDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true)
    try {
      const [logsData, statisticsData, enteredVehicles] = await Promise.all([
        vehicleLogApi.getTodayLogs(0, 100),
        vehicleLogApi.getTodayStatistics(),
        vehicleApi.getVehiclesByStatus("entered").catch(() => []),
      ])
      const sortedLogs = [...logsData.content].sort(
        (a, b) => new Date(b.entryExitTime).getTime() - new Date(a.entryExitTime).getTime(),
      )
      setLogs(sortedLogs)
      setStatistics(statisticsData)
      setInsideVehicleCount(enteredVehicles.length)

      const stillSelected = sortedLogs.find((log) => log.id === selectedLog?.id)
      if (stillSelected) {
        setSelectedLog(stillSelected)
      } else if (sortedLogs[0]) {
        void loadVehicleDetail(sortedLogs[0])
      } else {
        setSelectedLog(null)
        setVehicleDetail(null)
      }
    } catch {
      toast({
        title: "Không thể tải nhật ký cổng",
        description: "Hãy thử làm mới dữ liệu.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadVehicleDetail, selectedLog?.id, toast])

  const handleVehicleCheck = useCallback(async (message: VehicleCheckMessage | EmployeeVehicleCheckMessage) => {
    const isDetailedMessage = "employeeId" in message && "vehicleId" in message
    const timestamp = isDetailedMessage
      ? (message as EmployeeVehicleCheckMessage).logTime || new Date().toISOString()
      : (message as VehicleCheckMessage).timestamp
    const movement = isDetailedMessage
      ? (message as EmployeeVehicleCheckMessage).logType.toLowerCase() as "entry" | "exit"
      : (message as VehicleCheckMessage).type.toLowerCase() as "entry" | "exit"
    const plate = isDetailedMessage
      ? (message as EmployeeVehicleCheckMessage).licensePlateNumber
      : (message as VehicleCheckMessage).licensePlateNumber

    const nextLog: VehicleLog = {
      id: `live-${Date.now()}`,
      licensePlateNumber: plate,
      entryExitTime: timestamp,
      type: movement,
      vehicleType: "internal",
      employeeId: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).employeeId : undefined,
      employeeName: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).employeeName : undefined,
      driverName: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).driverName : undefined,
      gateLocation: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).gateLocation : undefined,
      vehicleId: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).vehicleId : undefined,
      vehicleBrand: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).brand : undefined,
      vehicleModel: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).model : undefined,
      vehicleColor: isDetailedMessage ? (message as EmployeeVehicleCheckMessage).color : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    setLogs((current) => [nextLog, ...current.filter((log) => log.id !== nextLog.id)])
    void loadVehicleDetail(nextLog)
    window.setTimeout(() => void loadData(), 1800)
  }, [loadData, loadVehicleDetail])

  const { isConnected, connectionError, reconnect } = useWebSocket(handleVehicleCheck)

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return logs.filter((log) => {
      const matchesQuery = !query || [log.licensePlateNumber, log.driverName, log.employeeName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
      const matchesMovement = movementFilter === "all" || log.type === movementFilter
      const matchesVehicle = vehicleFilter === "all" || log.vehicleType === vehicleFilter
      return matchesQuery && matchesMovement && matchesVehicle
    })
  }, [logs, movementFilter, searchTerm, vehicleFilter])

  const activeFilterCount = [
    searchTerm.trim(),
    movementFilter !== "all",
    vehicleFilter !== "all",
  ].filter(Boolean).length

  const clearEventFilters = () => {
    setSearchTerm("")
    setMovementFilter("all")
    setVehicleFilter("all")
  }

  const liveImage = (vehicleDetail as (EmployeeVehicleInfo & { vehicleImagePath?: string }) | null)?.vehicleImagePath
    || selectedLog?.vehicleImagePath
    || selectedLog?.imagePath
  const currentPlate = vehicleDetail?.licensePlateNumber || selectedLog?.licensePlateNumber
  const overviewMetrics = [
    {
      label: "Lượt vào hôm nay",
      value: (statistics?.entryCount ?? 0).toLocaleString("vi-VN"),
      note: "Đã ghi nhận tại cổng",
      icon: ArrowDownToLine,
      tone: "success",
    },
    {
      label: "Lượt ra hôm nay",
      value: (statistics?.exitCount ?? 0).toLocaleString("vi-VN"),
      note: "Đã hoàn tất phiên đỗ",
      icon: ArrowUpFromLine,
      tone: "critical",
    },
    {
      label: "Xe hiện trong bãi",
      value: insideVehicleCount.toLocaleString("vi-VN"),
      note: "Trạng thái đã vào",
      icon: CarFront,
      tone: "primary",
    },
  ] as const

  if (loading) {
    return (
      <AdminPage className="space-y-6 bg-background text-foreground p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden" aria-busy="true">
        <div className="animate-pulse space-y-5">
          <div className="h-24 rounded-xl border border-border bg-muted/30 p-5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-28 rounded-xl border border-border bg-muted/30 p-5" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
            <div className="min-h-116 rounded-xl border border-border bg-muted/30 p-5" />
            <div className="min-h-116 rounded-xl border border-border bg-muted/30 p-5" />
          </div>
        </div>
      </AdminPage>
    )
  }

  return (
    <AdminPage className="min-h-dvh space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <AdminPageHeader
        eyebrow="Giám sát trực tiếp"
        title="Giám sát ra vào"
        description="Theo dõi lượt xe ra vào trong ngày, vị trí cổng và thông tin phương tiện được đồng bộ tự động."
        actionList={[
          {
            key: "refresh",
            content: <Button variant="outline" size="sm" onClick={() => void loadData(true)} disabled={refreshing} className="min-h-11 rounded-xl">
              <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Làm mới
            </Button>,
          },
          {
            key: "connection",
            content: <Button variant="outline" size="sm" onClick={!isConnected ? reconnect : undefined} disabled={isConnected} className={`min-h-11 rounded-xl ${isConnected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              <Radio className={`mr-2 size-4 ${isConnected ? "text-emerald-600" : "text-rose-600"}`} aria-hidden="true" />
              <span>{isConnected ? "Đã kết nối" : "Kết nối lại"}</span>
            </Button>,
          },
        ]}
      />

      <DashboardMetricsSection
        id="vehicle-monitoring-summary"
        title="Tổng quan hôm nay"
        description="Tóm tắt lưu lượng và số phương tiện đang trong bãi từ dữ liệu cổng mới nhất."
        badge={
          <Badge
            variant="outline"
            className={isConnected
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-border bg-muted text-muted-foreground"}
          >
            <Radio className={isConnected ? "size-3 animate-pulse" : "size-3"} aria-hidden="true" />
            {isConnected ? "Đang nhận realtime" : "Đang chờ realtime"}
          </Badge>
        }
        meta={logs[0] && (
          <span role="status" className="text-xs tabular-nums text-muted-foreground">
            Event gần nhất {new Date(logs[0].entryExitTime).toLocaleTimeString("vi-VN")}
          </span>
        )}
        loading={refreshing}
        metrics={overviewMetrics}
      />

      {/* Main Events list and detail section */}
      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          {/* Header section of the events list */}
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs text-emerald-600 tracking-widest font-semibold">
                  Hoạt động hôm nay
                </span>
                <h2 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                  Sự kiện mới nhất
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5" aria-live="polite">
                  <span>{filteredLogs.length} sự kiện phù hợp trong hôm nay</span>
                  {activeFilterCount > 0 && <span className="text-emerald-600"> · Đã áp dụng {activeFilterCount} bộ lọc</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <Badge variant="outline" className="h-7 w-fit rounded-xl border-border bg-background text-muted-foreground text-sm px-2.5">
                  <Clock3 className="mr-1 h-3 w-3 text-emerald-600" aria-hidden="true" />
                  {new Date().toLocaleDateString("vi-VN")}
                </Badge>
                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearEventFilters}
                    className="h-7 px-2.5 rounded-xl text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </div>
            </div>

            {/* Input & Filters Section */}
            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm biển số hoặc người lái..."
                  aria-label="Tìm biển số hoặc người lái"
                  className="min-h-11 rounded-xl border-border bg-background pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500/30 focus:ring-emerald-500/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Select value={movementFilter} onValueChange={(value) => setMovementFilter(value as MovementFilter)}>
                  <SelectTrigger aria-label="Lọc theo chiều di chuyển" className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-muted-foreground focus:border-emerald-500/30">
                    <SelectValue placeholder="Chiều di chuyển" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground text-xs">
                    <SelectItem value="all">Tất cả chiều</SelectItem>
                    <SelectItem value="entry">Vào cổng</SelectItem>
                    <SelectItem value="exit">Ra cổng</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={vehicleFilter} onValueChange={(value) => setVehicleFilter(value as VehicleFilter)}>
                  <SelectTrigger aria-label="Lọc theo loại xe" className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-muted-foreground focus:border-emerald-500/30">
                    <SelectValue placeholder="Loại xe" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground text-xs">
                    <SelectItem value="all">Mọi loại xe</SelectItem>
                    <SelectItem value="internal">Xe nội bộ</SelectItem>
                    <SelectItem value="external">Xe khách</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Event List / Grid */}
          <div className="grid min-w-0 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto ">
            {filteredLogs.map((log) => {
              const selected = log.id === selectedLog?.id
              const isEntry = log.type === "entry"
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => void loadVehicleDetail(log)}
                  aria-pressed={selected}
                  className={`min-h-[120px] min-w-0 touch-manipulation p-4 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 relative overflow-hidden flex flex-col justify-between ${
                    selected 
                      ? "bg-slate-50/80 border-l-2 border-l-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.03)]" 
                      : "bg-background hover:bg-muted/30 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-black text-foreground tracking-wider">
                      {log.licensePlateNumber}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold border ${
                      isEntry 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {isEntry ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                      {isEntry ? "Vào" : "Ra"}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="truncate text-xs font-bold text-slate-700">
                      {log.driverName || log.employeeName || "Chưa xác định"}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3 text-primary shrink-0" />
                      <span className="truncate">{log.gateLocation || "Cổng chính"}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-1.5">
                    <span className="text-xs text-muted-foreground/80">{log.vehicleType === "internal" ? "Xe nội bộ" : "Xe khách"}</span>
                    <p className="text-xs text-muted-foreground">{formatTimestamp(log.entryExitTime)}</p>
                  </div>
                </button>
              )
            })}
            {filteredLogs.length === 0 && (
              <div className="col-span-full bg-muted/10 px-4 py-12 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-background border border-border text-muted-foreground" aria-hidden="true">
                  <CarFront className="size-6" />
                </span>
                <p className="mt-3 text-xs font-bold text-muted-foreground tracking-wider">Không tìm thấy sự kiện</p>
                <p className="mt-1 text-sm text-muted-foreground/80">Thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Chi tiết phương tiện đã chọn">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] flex flex-col justify-between">
            {/* Aside Header */}
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <span className="text-xs text-emerald-600 tracking-widest font-semibold">
                  Thông tin phương tiện
                </span>
                <h2 className="text-sm font-bold text-foreground mt-0.5">
                  Chi tiết phương tiện
                </h2>
              </div>
              {selectedLog && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${
                  selectedLog.type === "entry"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}>
                  {selectedLog.type === "entry" ? "Phương tiện vào" : "Phương tiện ra"}
                </span>
              )}
            </div>

            <div className="p-4 sm:p-5">
              {detailLoading ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center text-xs text-muted-foreground gap-2" aria-live="polite">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" /> 
                  <span>Đang tra cứu dữ liệu...</span>
                </div>
              ) : selectedLog ? (
                <>
                  {/* Visual Vehicle Card */}
                  <div className="relative flex min-h-[180px] items-end overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
                    {/* Default placeholder overlay if there's no liveImage */}
                    {!liveImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                        <CarFront className="h-16 w-16 text-muted-foreground/60 animate-pulse" aria-hidden="true" />
                      </div>
                    )}

                    {liveImage && (
                      <img
                        src={getImageUrl(liveImage) || ""}
                        alt={`Ảnh xe biển số ${currentPlate}`}
                        className="absolute inset-0 h-full w-full object-cover opacity-90"
                        onError={(event) => { event.currentTarget.style.display = "none" }}
                      />
                    )}

                    <div className="relative z-10 w-full bg-background/95 border border-border/80 p-3 rounded-xl ">
                      <span className="text-xs text-slate-400">Biển số xe</span>
                      <p className="text-sm sm:text-base font-black tracking-widest text-emerald-700">
                        {currentPlate}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {vehicleDescription(selectedLog, vehicleDetail)}
                      </p>
                    </div>
                  </div>

                  {/* Metadata specs */}
                  <dl className="mt-4 space-y-2 text-xs">
                    {[
                      { label: "Thời điểm", value: formatTimestamp(vehicleDetail?.logTime || selectedLog.entryExitTime), icon: Clock3, color: "text-emerald-600" },
                      { label: "Vị trí cổng", value: vehicleDetail?.gateLocation || selectedLog.gateLocation || "Cổng chính", icon: MapPin, color: "text-primary" },
                      { label: "Chủ sở hữu", value: vehicleDetail?.driverName || vehicleDetail?.employeeName || selectedLog.driverName || selectedLog.employeeName || "Chưa xác định", icon: UserRound, color: "text-muted-foreground" },
                      { label: "Đơn vị", value: vehicleDetail?.department || selectedLog.employeeDepartment || "Chưa đăng ký", icon: Activity, color: "text-amber-600" },
                      { label: "Mã phương tiện", value: vehicleDetail?.vehicleId || selectedLog.vehicleId || "N/A", icon: CarFront, color: "text-purple-600" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div 
                        key={label} 
                        className="rounded-xl border border-border bg-muted/20 p-2.5 flex flex-col justify-between gap-1 transition-all duration-200 hover:border-border/80"
                      >
                        <dt className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold tracking-wider">
                          <Icon className={`size-3 ${color}`} aria-hidden="true" />
                          {label}
                        </dt>
                        <dd className="break-words font-bold text-foreground pl-4.5">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
                  <span className="grid size-12 place-items-center rounded-xl bg-background border border-border text-muted-foreground" aria-hidden="true">
                    <ImageIcon className="size-6" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-muted-foreground tracking-wider">Chọn sự kiện</p>
                  <p className="mt-1 text-sm text-muted-foreground/80 max-w-xs mx-auto">
                    Chọn một bản ghi bên trái để phân tích hình ảnh và tra cứu hồ sơ phương tiện.
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </AdminPage>
  )
}
