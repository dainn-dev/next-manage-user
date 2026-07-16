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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
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

  if (loading) {
    return (
      <AdminPage className="min-h-dvh" aria-busy="true">
        <div className="animate-pulse space-y-5">
          <div className="h-20 rounded-lg bg-[var(--color-paper-3)]" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-lg bg-[var(--color-paper-3)]" />)}
          </div>
          <div className="h-96 rounded-lg bg-[var(--color-paper-3)]" />
        </div>
      </AdminPage>
    )
  }

  return (
    <AdminPage className="min-h-dvh">
        <AdminPageHeader
          className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 sm:p-5 lg:items-center lg:px-5 lg:py-4"
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="sm:hidden">Vận hành</span>
              <span className="hidden sm:inline">Vận hành cổng</span>
            </span>
          }
          title="Giám sát ra / vào"
          description={
            <>
              <span className="sm:hidden">Theo dõi lượt xe và sự kiện mới nhất.</span>
              <span className="hidden sm:inline">
                Theo dõi lượt xe trong ngày, chọn một sự kiện để xem phương tiện và người liên quan.
              </span>
            </>
          }
          actions={
            <div className="flex shrink-0 items-start justify-end gap-1.5 sm:gap-2 lg:items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="!h-8 !min-h-8 !w-8 shrink-0 rounded-xl border-border/70 bg-background/70 !p-0 text-muted-foreground shadow-none hover:text-foreground sm:!h-9 sm:!min-h-9 sm:!w-auto sm:px-3"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-2">Làm mới</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={!isConnected ? reconnect : undefined}
              disabled={isConnected}
              title={connectionError || (isConnected ? "Đang nhận realtime" : "Kết nối lại")}
              aria-label={isConnected ? "Đang nhận realtime" : "Kết nối lại realtime"}
              className={`!h-8 !min-h-8 !w-8 shrink-0 rounded-xl !p-0 shadow-none sm:!h-9 sm:!min-h-9 sm:!w-auto sm:px-3 ${
                isConnected
                  ? "border-[var(--color-success)]/25 bg-[var(--color-success-surface)]/60"
                  : "border-[var(--color-critical)]/25 bg-[var(--color-critical-surface)]/60"
              }`}
            >
              <Radio className={`h-4 w-4 ${isConnected ? "text-[var(--color-success)]" : "text-[var(--color-critical)]"}`} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-2">{isConnected ? "Đang nhận realtime" : "Kết nối lại"}</span>
            </Button>
            </div>
          }
        />

        <section className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Tổng quan hôm nay">
          {[
            { label: "Lượt vào", value: statistics?.entryCount ?? 0, icon: ArrowDownToLine, tone: "text-emerald-700", surface: "bg-emerald-50", border: "border-emerald-200/80" },
            { label: "Lượt ra", value: statistics?.exitCount ?? 0, icon: ArrowUpFromLine, tone: "text-rose-700", surface: "bg-rose-50", border: "border-rose-200/80" },
            { label: "Tổng số xe hiện trong bãi", value: insideVehicleCount, icon: CarFront, tone: "text-teal-700", surface: "bg-teal-50", border: "border-teal-200/80", className: "col-span-2 sm:col-span-1" },
          ].map(({ label, value, icon: Icon, tone, surface, border, className }) => (
            <div key={label} className={`min-w-0 rounded-xl border bg-background/80 p-2.5 text-left shadow-[var(--shadow-card)] ${border} ${className ?? ""}`}>
              <div className={`mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${surface} ${tone}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </div>
              <p className={`font-[family:var(--font-display)] text-xl font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-3xl sm:tracking-[-0.03em] ${tone}`}>
                {value.toLocaleString("vi-VN")}
              </p>
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border p-3 sm:p-5">
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-[family:var(--font-display)] text-base font-bold tracking-[-0.02em] text-foreground sm:text-xl">Sự kiện mới nhất</h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm" aria-live="polite">
                    <span className="sm:hidden">{filteredLogs.length} sự kiện hôm nay</span>
                    <span className="hidden sm:inline">{filteredLogs.length} sự kiện phù hợp trong hôm nay</span>
                    {activeFilterCount > 0 && <span className="sm:hidden"> · {activeFilterCount} lọc</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <Badge variant="outline" className="h-7 w-fit rounded-lg border-[var(--color-rule-2)] bg-background/70 px-2 text-xs font-medium text-muted-foreground sm:h-8">
                    <Clock3 className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                    {new Date().toLocaleDateString("vi-VN")}
                  </Badge>
                  {activeFilterCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearEventFilters}
                      className="h-8 min-h-8 px-2 text-xs text-muted-foreground hover:text-foreground sm:h-9 sm:min-h-9 sm:px-3 sm:text-sm"
                    >
                      Xóa lọc
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid min-w-0 gap-1.5 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem] sm:gap-2">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" aria-hidden="true" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm biển số hoặc người lái"
                    aria-label="Tìm biển số hoặc người lái"
                    className="h-9 min-h-9 rounded-xl border-border bg-background pl-9 text-sm shadow-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:h-11 sm:min-h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:contents">
                  <Select value={movementFilter} onValueChange={(value) => setMovementFilter(value as MovementFilter)}>
                    <SelectTrigger aria-label="Lọc theo chiều di chuyển" className="h-9 min-h-9 w-full rounded-xl border-border bg-background text-sm shadow-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:h-11 sm:min-h-11">
                      <SelectValue placeholder="Chiều di chuyển" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả lượt</SelectItem>
                      <SelectItem value="entry">Vào cổng</SelectItem>
                      <SelectItem value="exit">Ra cổng</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={vehicleFilter} onValueChange={(value) => setVehicleFilter(value as VehicleFilter)}>
                    <SelectTrigger aria-label="Lọc theo loại xe" className="h-9 min-h-9 w-full rounded-xl border-border bg-background text-sm shadow-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:h-11 sm:min-h-11">
                      <SelectValue placeholder="Loại xe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Mọi loại xe</SelectItem>
                      <SelectItem value="internal">Xe nội bộ</SelectItem>
                      <SelectItem value="external">Xe khách</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {filteredLogs.map((log) => {
                const selected = log.id === selectedLog?.id
                const isEntry = log.type === "entry"
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => void loadVehicleDetail(log)}
                    aria-pressed={selected}
                    className={`min-h-28 min-w-0 touch-manipulation bg-card p-4 text-left transition-[background-color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-inset active:translate-y-px ${selected ? "bg-[var(--color-paper-3)]" : "hover:bg-[var(--color-paper-2)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-[family:var(--font-outlier)] text-base font-semibold tracking-wide text-foreground">{log.licensePlateNumber}</span>
                      <Badge className={isEntry ? "bg-[var(--color-success-surface)] text-[var(--color-success)]" : "bg-[var(--color-critical-surface)] text-[var(--color-critical)]"}>
                        {isEntry ? <ArrowDownToLine className="mr-1 h-3 w-3" aria-hidden="true" /> : <ArrowUpFromLine className="mr-1 h-3 w-3" aria-hidden="true" />}
                        {isEntry ? "Vào" : "Ra"}
                      </Badge>
                    </div>
                    <p className="mt-3 truncate text-sm font-medium text-foreground">{log.driverName || log.employeeName || "Chưa xác định người lái"}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{log.gateLocation || "Chưa có vị trí cổng"}</span>
                    </div>
                    <p className="mt-3 font-[family:var(--font-outlier)] text-xs text-muted-foreground">{formatTimestamp(log.entryExitTime)}</p>
                  </button>
                )
              })}
              {filteredLogs.length === 0 && (
                <div className="col-span-full bg-card px-4 py-7 text-center sm:px-5 sm:py-14">
                  <span className="mx-auto grid size-9 place-items-center rounded-xl bg-muted/70 text-muted-foreground sm:size-12" aria-hidden="true">
                    <CarFront className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <p className="mt-2 text-sm font-medium text-foreground sm:mt-3 sm:text-base">Chưa có sự kiện phù hợp</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">Đổi bộ lọc hoặc làm mới dữ liệu để kiểm tra lại.</p>
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-5" aria-label="Chi tiết phương tiện đã chọn">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-5 sm:py-3">
                <div className="min-w-0">
                  <h2 className="font-[family:var(--font-display)] text-sm font-semibold tracking-[-0.01em] text-foreground sm:text-base">Chi tiết phương tiện</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Sự kiện đang chọn</p>
                </div>
                {selectedLog && <Badge variant="outline" className="h-6 px-2 text-[0.6875rem] sm:h-7 sm:text-xs">{movementLabel(selectedLog.type)}</Badge>}
              </div>

              <div className="p-3 sm:p-5">
                {detailLoading ? (
                  <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground sm:min-h-56" aria-live="polite">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Đang tải chi tiết xe
                  </div>
                ) : selectedLog ? (
                  <>
                    <div className="relative flex min-h-44 items-end overflow-hidden rounded-md border border-border bg-[var(--color-paper-3)] p-4">
                      <CarFront className="absolute right-4 top-4 h-12 w-12 text-[var(--color-accent)]" aria-hidden="true" />
                      {liveImage && (
                        <img
                          src={getImageUrl(liveImage) || ""}
                          alt={`Ảnh xe biển số ${currentPlate}`}
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(event) => { event.currentTarget.style.display = "none" }}
                        />
                      )}
                      <div className="relative">
                        <p className="font-[family:var(--font-outlier)] text-base font-semibold tracking-wide text-foreground sm:text-lg">{currentPlate}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{vehicleDescription(selectedLog, vehicleDetail)}</p>
                      </div>
                    </div>

                    <dl className="mt-5 divide-y divide-border text-sm">
                      {[
                        { label: "Thời điểm", value: formatTimestamp(vehicleDetail?.logTime || selectedLog.entryExitTime), icon: Clock3 },
                        { label: "Cổng", value: vehicleDetail?.gateLocation || selectedLog.gateLocation || "Chưa có vị trí cổng", icon: MapPin },
                        { label: "Người lái / chủ xe", value: vehicleDetail?.driverName || vehicleDetail?.employeeName || selectedLog.driverName || selectedLog.employeeName || "Chưa xác định", icon: UserRound },
                        { label: "Đơn vị", value: vehicleDetail?.department || selectedLog.employeeDepartment || "Chưa có thông tin", icon: Activity },
                        { label: "Mã phương tiện", value: vehicleDetail?.vehicleId || selectedLog.vehicleId || "Chưa có mã", icon: CarFront },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
                          <dt className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{label}</dt>
                          <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-muted/25 px-4 py-8 text-center sm:min-h-56 sm:py-10">
                    <span className="grid size-10 place-items-center rounded-xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/70" aria-hidden="true">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <p className="mt-2.5 font-medium text-foreground sm:mt-3">Chọn một sự kiện</p>
                    <p className="mt-1 max-w-[15rem] text-xs leading-5 text-muted-foreground sm:max-w-xs sm:text-sm sm:leading-6">
                      Thông tin xe và người liên quan sẽ hiện tại đây.
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
