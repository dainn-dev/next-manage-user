"use client"

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 * theme: ParkVision Control · enrichment: none · pre-emit critique: P5 H5 E5 S5 R5 V4
 */

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
import { ErrorBoundary } from "@/components/error-boundary"
import { RealtimeGateDashboard } from "@/components/vehicles/realtime-gate-dashboard"
import { useToast } from "@/hooks/use-toast"
import { dataService } from "@/lib/data-service"
import { getImageUrl } from "@/lib/api/config"
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all")
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("all")
  const [selectedLog, setSelectedLog] = useState<VehicleLog | null>(null)
  const [vehicleDetail, setVehicleDetail] = useState<EmployeeVehicleInfo | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [realtimePulse, setRealtimePulse] = useState(0)

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
      const [logsData, statisticsData] = await Promise.all([
        vehicleLogApi.getTodayLogs(0, 100),
        vehicleLogApi.getTodayStatistics(),
      ])
      const sortedLogs = [...logsData.content].sort(
        (a, b) => new Date(b.entryExitTime).getTime() - new Date(a.entryExitTime).getTime(),
      )
      setLogs(sortedLogs)
      setStatistics(statisticsData)

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
    setRealtimePulse((value) => value + 1)
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

  const liveImage = (vehicleDetail as (EmployeeVehicleInfo & { vehicleImagePath?: string }) | null)?.vehicleImagePath
    || selectedLog?.vehicleImagePath
    || selectedLog?.imagePath
  const currentPlate = vehicleDetail?.licensePlateNumber || selectedLog?.licensePlateNumber

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6" aria-busy="true">
        <div className="mx-auto max-w-[104rem] animate-pulse space-y-5">
          <div className="h-20 rounded-lg bg-[var(--color-paper-3)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-lg bg-[var(--color-paper-3)]" />)}
          </div>
          <div className="h-96 rounded-lg bg-[var(--color-paper-3)]" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto flex max-w-[104rem] min-w-0 flex-col gap-5">
        <header className="flex min-w-0 flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
              Vận hành cổng
            </div>
            <h1 className="font-[family:var(--font-display)] text-3xl font-bold tracking-[-0.025em] text-foreground sm:text-4xl">
              Giám sát ra / vào
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Theo dõi lượt xe trong ngày, chọn một sự kiện để xem phương tiện và người liên quan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing} className="min-h-10 whitespace-nowrap">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Làm mới
            </Button>
            <Button
              variant="outline"
              onClick={!isConnected ? reconnect : undefined}
              disabled={isConnected}
              title={connectionError || undefined}
              className="min-h-10 whitespace-nowrap"
            >
              <Radio className={`mr-2 h-4 w-4 ${isConnected ? "text-[var(--color-success)]" : "text-[var(--color-critical)]"}`} aria-hidden="true" />
              {isConnected ? "Đang nhận realtime" : "Kết nối lại"}
            </Button>
          </div>
        </header>

        <section className="grid min-w-0 grid-cols-1 border-y border-border sm:grid-cols-3" aria-label="Tổng quan hôm nay">
          {[
            { label: "Lượt vào", value: statistics?.entryCount ?? 0, icon: ArrowDownToLine, tone: "var(--color-success)" },
            { label: "Lượt ra", value: statistics?.exitCount ?? 0, icon: ArrowUpFromLine, tone: "var(--color-critical)" },
            { label: "Xe duy nhất", value: statistics?.uniqueVehicles ?? 0, icon: CarFront, tone: "var(--color-signal)" },
          ].map(({ label, value, icon: Icon, tone }, index) => (
            <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" style={{ color: tone }} aria-hidden="true" />
                {label}
              </div>
              <p className="mt-2 font-[family:var(--font-display)] text-3xl font-bold tracking-[-0.03em] text-foreground">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
          <div className="min-w-0 rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-[family:var(--font-display)] text-xl font-bold tracking-[-0.02em] text-foreground">Sự kiện mới nhất</h2>
                  <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">{filteredLogs.length} sự kiện phù hợp trong hôm nay</p>
                </div>
                <Badge variant="outline" className="w-fit border-[var(--color-rule-2)] text-muted-foreground">
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {new Date().toLocaleDateString("vi-VN")}
                </Badge>
              </div>
              <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm biển số hoặc người lái" className="min-h-10 pl-9" />
                </div>
                <Select value={movementFilter} onValueChange={(value) => setMovementFilter(value as MovementFilter)}>
                  <SelectTrigger className="min-h-10"><SelectValue placeholder="Chiều di chuyển" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lượt</SelectItem>
                    <SelectItem value="entry">Vào cổng</SelectItem>
                    <SelectItem value="exit">Ra cổng</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={vehicleFilter} onValueChange={(value) => setVehicleFilter(value as VehicleFilter)}>
                  <SelectTrigger className="min-h-10"><SelectValue placeholder="Loại xe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi loại xe</SelectItem>
                    <SelectItem value="internal">Xe nội bộ</SelectItem>
                    <SelectItem value="external">Xe khách</SelectItem>
                  </SelectContent>
                </Select>
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
                    className={`min-w-0 bg-card p-4 text-left transition-[background-color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] focus-visible:z-10 focus-visible:outline-none active:translate-y-px ${selected ? "bg-[var(--color-paper-3)]" : "hover:bg-[var(--color-paper-2)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-[family:var(--font-outlier)] text-base font-semibold tracking-wide text-foreground">{log.licensePlateNumber}</span>
                      <Badge className={isEntry ? "bg-[var(--color-success-surface)] text-[var(--color-success)]" : "bg-[var(--color-critical-surface)] text-[var(--color-critical)]"}>
                        {isEntry ? <ArrowDownToLine className="mr-1 h-3 w-3" aria-hidden="true" /> : <ArrowUpFromLine className="mr-1 h-3 w-3" aria-hidden="true" />}
                        {isEntry ? "Vào" : "Ra"}
                      </Badge>
                    </div>
                    <p className="mt-4 truncate text-sm font-medium text-foreground">{log.driverName || log.employeeName || "Chưa xác định người lái"}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{log.gateLocation || "Chưa có vị trí cổng"}</span>
                    </div>
                    <p className="mt-4 font-[family:var(--font-outlier)] text-xs text-muted-foreground">{formatTimestamp(log.entryExitTime)}</p>
                  </button>
                )
              })}
              {filteredLogs.length === 0 && (
                <div className="col-span-full bg-card px-5 py-14 text-center">
                  <CarFront className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 font-medium text-foreground">Chưa có sự kiện phù hợp</p>
                  <p className="mt-1 text-sm text-muted-foreground">Đổi bộ lọc hoặc làm mới dữ liệu để kiểm tra lại.</p>
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-5" aria-label="Chi tiết phương tiện đã chọn">
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
                <div>
                  <h2 className="font-[family:var(--font-display)] text-xl font-bold tracking-[-0.02em] text-foreground">Chi tiết phương tiện</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Sự kiện đang chọn</p>
                </div>
                {selectedLog && <Badge variant="outline">{movementLabel(selectedLog.type)}</Badge>}
              </div>

              <div className="p-4 sm:p-5">
                {detailLoading ? (
                  <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground" aria-live="polite">
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
                        <p className="font-[family:var(--font-outlier)] text-xl font-semibold tracking-wide text-foreground">{currentPlate}</p>
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
                        <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-3">
                          <dt className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{label}</dt>
                          <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center">
                    <ImageIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-3 font-medium text-foreground">Chọn một sự kiện</p>
                    <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">Thông tin xe và người liên quan sẽ hiện tại đây.</p>
                  </div>
                )}
              </div>
            </section>

            <ErrorBoundary>
              <RealtimeGateDashboard pulse={realtimePulse} />
            </ErrorBoundary>
          </aside>
        </section>
      </div>
    </main>
  )
}
