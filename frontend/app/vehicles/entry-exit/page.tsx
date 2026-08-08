"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  RefreshCw,
  Car,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Calendar,
  Download,
  Plus,
  Filter,
  Eye,
  Edit,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  CarFront,
  Clock3,
  ImageIcon,
  MapPin,
  UserRound,
  Radio,
  ShieldAlert,
  Wifi,
  WifiOff
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, VehicleLogPage, VehicleLog, VehicleLogExportFilter } from "@/lib/api/vehicle-log-api"
import { getImageUrl } from "@/lib/api/config"
import { downloadBlob } from "@/lib/utils/download-blob"
import { ExportDialog } from "@/components/reports/export-dialog"
import { useAuth } from "@/lib/auth-context"
import { canViewAllLogs } from "@/lib/types"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useWebSocket, type VehicleCheckMessage, type EmployeeVehicleCheckMessage } from "@/hooks/use-websocket"

export default function VehicleEntryExitPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<VehicleLog[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "entry" | "exit">("all")
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "internal" | "external">("all")
  const [periodFilter, setPeriodFilter] = useState<"daily" | "weekly" | "monthly">("daily")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // Filter bar state
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const [currentTime, setCurrentTime] = useState<string>("")
  const { toast } = useToast()

  // Realtime clock hook for high-tech header
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  // WebSocket handler for realtime updates
  const handleVehicleCheck = useCallback((message: VehicleCheckMessage | EmployeeVehicleCheckMessage) => {
    console.log('[REALTIME] Entry-Exit page received WebSocket message:', message)

    const isEmployee = "employeeId" in message && "vehicleId" in message
    const employeeMessage = message as EmployeeVehicleCheckMessage
    const vehicleMessage = message as VehicleCheckMessage
    const plate = isEmployee ? employeeMessage.licensePlateNumber : vehicleMessage.licensePlateNumber
    const type = (isEmployee ? employeeMessage.logType : vehicleMessage.type).toLowerCase()
    const time = isEmployee ? employeeMessage.logTime || new Date().toISOString() : vehicleMessage.timestamp

    const newLog: VehicleLog = {
      id: `rt-${Date.now()}`,
      licensePlateNumber: plate,
      entryExitTime: time,
      type: type === "exit" ? "exit" : "entry",
      vehicleType: "internal",
      employeeName: isEmployee ? employeeMessage.employeeName : undefined,
      driverName: isEmployee ? employeeMessage.driverName : undefined,
      gateLocation: isEmployee ? employeeMessage.gateLocation : undefined,
      vehicleId: isEmployee ? employeeMessage.vehicleId : undefined,
      vehicleBrand: isEmployee ? employeeMessage.brand : undefined,
      vehicleModel: isEmployee ? employeeMessage.model : undefined,
      vehicleColor: isEmployee ? employeeMessage.color : undefined,
      createdAt: time,
      updatedAt: time,
    }

    // Only add to list if we're viewing today's data
    if (periodFilter === 'daily' && !searchTerm && typeFilter === 'all' && vehicleTypeFilter === 'all') {
      setLogs((prev) => {
        const filtered = prev.filter((log) => log.id !== newLog.id)
        return [newLog, ...filtered].slice(0, pageSize)
      })
      setTotalElements((prev) => prev + 1)
      console.log('[REALTIME] Entry-Exit list updated with new event')
    }

    // Always trigger a background refresh after a short delay
    setTimeout(() => {
      console.log('[REALTIME] Triggering background data refresh')
      void loadData()
    }, 2000)
  }, [periodFilter, searchTerm, typeFilter, vehicleTypeFilter, pageSize])

  const { isConnected, reconnect } = useWebSocket(handleVehicleCheck, {
    onConnect: () => {
      console.log('[REALTIME] Entry-Exit page WebSocket connected, refreshing data')
      void loadData()
    }
  })

  useEffect(() => {
    loadData()
  }, [currentPage, pageSize, periodFilter])

  useEffect(() => {
    if (searchTerm || typeFilter !== "all" || vehicleTypeFilter !== "all" || (startDate && endDate)) {
      handleSearch()
    } else {
      loadData()
    }
  }, [searchTerm, typeFilter, vehicleTypeFilter, startDate, endDate])

  const loadData = async () => {
    try {
      setLoading(true)
      let response: VehicleLogPage

      switch (periodFilter) {
        case 'daily':
          response = await vehicleLogApi.getTodayLogs(currentPage, pageSize)
          break
        case 'weekly':
          response = await vehicleLogApi.getWeeklyLogs(currentPage, pageSize)
          break
        case 'monthly':
          response = await vehicleLogApi.getMonthlyLogs(currentPage, pageSize)
          break
        default:
          response = await vehicleLogApi.getAllVehicleLogs(currentPage, pageSize)
      }

      setLogs(response.content)
      setTotalPages(response.totalPages)
      setTotalElements(response.totalElements)
    } catch (error) {
      console.error('Error loading vehicle logs:', error)
      toast({
        title: "Lỗi hệ thống",
        description: "Không thể tải dữ liệu thông tin ra vào từ máy chủ.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    let start: string
    let end: string

    if (!startDate || !endDate) {
      const now = new Date()
      let sDate: Date, eDate: Date

      switch (periodFilter) {
        case 'daily':
          sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        case 'weekly': {
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          sDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate())
          eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        }
        case 'monthly':
          sDate = new Date(now.getFullYear(), now.getMonth(), 1)
          eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        default:
          sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      }
      start = sDate.toISOString()
      end = eDate.toISOString()
    } else {
      start = new Date(startDate).toISOString()
      end = new Date(endDate).toISOString()
    }

    try {
      setLoading(true)
      const response = await vehicleLogApi.searchVehicleLogs({
        licensePlate: searchTerm || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        vehicleType: vehicleTypeFilter !== "all" ? vehicleTypeFilter : undefined,
        startDate: start,
        endDate: end,
        page: currentPage,
        size: pageSize
      })

      setLogs(response.content)
      setTotalPages(response.totalPages)
      setTotalElements(response.totalElements)
    } catch (error) {
      console.error('Error searching vehicle logs:', error)
      toast({
        title: "Lỗi tìm kiếm",
        description: "Hệ thống gặp sự cố khi lọc và truy xuất thông tin.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0)
  }

  // Build the export filter from the current search/period state
  const computeExportFilter = (): VehicleLogExportFilter => {
    let start = startDate ? new Date(startDate).toISOString() : undefined
    let end = endDate ? new Date(endDate).toISOString() : undefined

    if (!start || !end) {
      const now = new Date()
      let s: Date, e: Date
      switch (periodFilter) {
        case 'weekly': {
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          s = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate())
          e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        }
        case 'monthly':
          s = new Date(now.getFullYear(), now.getMonth(), 1)
          e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        default:
          s = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      }
      start = start || s.toISOString()
      end = end || e.toISOString()
    }

    return {
      licensePlate: searchTerm || undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      vehicleType: vehicleTypeFilter !== "all" ? vehicleTypeFilter : undefined,
      startDate: start,
      endDate: end,
    }
  }

  const handleExport = () => {
    setShowExportDialog(true)
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setTypeFilter("all")
    setVehicleTypeFilter("all")
    setStartDate("")
    setEndDate("")
    setCurrentPage(0)
  }

  const handleExportConfirmed = async (options: { format: string }) => {
    const format = (options.format || "EXCEL").toUpperCase()
    if (format !== "EXCEL" && format !== "CSV") {
      toast({
        title: "Chưa hỗ trợ định dạng",
        description: `Định dạng ${format} chưa được hỗ trợ. Vui lòng chọn EXCEL hoặc CSV.`,
        variant: "destructive",
      })
      return
    }

    try {
      const filter = computeExportFilter()
      const isCsv = format === "CSV"
      const blob = isCsv
        ? await vehicleLogApi.exportLogsCsv(filter)
        : await vehicleLogApi.exportLogsExcel(filter)

      const today = new Date().toISOString().split('T')[0]
      downloadBlob(blob, `bao-cao-xe-ra-vao-${today}.${isCsv ? 'csv' : 'xlsx'}`)

      toast({
        title: "Xuất tệp dữ liệu thành công",
        description: `Đã hoàn tất xuất báo cáo định dạng ${isCsv ? 'CSV' : 'Excel'}.`,
        variant: "default",
      })
    } catch (error) {
      console.error('Error exporting vehicle logs:', error)
      toast({
        title: "Lỗi xuất báo cáo",
        description: "Có lỗi xảy ra trong quá trình xuất dữ liệu. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'daily': return 'Hôm nay'
      case 'weekly': return 'Tuần này'
      case 'monthly': return 'Tháng này'
      default: return 'Tất cả'
    }
  }

  const activeFilterCount = [
    searchTerm.trim(),
    typeFilter !== "all",
    vehicleTypeFilter !== "all",
    startDate,
    endDate,
  ].filter(Boolean).length

  const viewAllLogs = canViewAllLogs(user?.role)
  const visibleLogs = viewAllLogs
    ? logs
    : logs.filter((log) => log.employeeName && user?.employeeName && log.employeeName === user.employeeName)

  // Computed page stats for technical metrics
  const pageInCount = visibleLogs.filter(l => l.type === 'entry').length
  const pageOutCount = visibleLogs.filter(l => l.type === 'exit').length
  const recordOverviewMetrics = [
    {
      label: "Khoảng thời gian",
      value: getPeriodLabel(),
      note: "Theo bộ lọc đang chọn",
      icon: Calendar,
      tone: "primary",
    },
    {
      label: "Lượt vào trang này",
      value: pageInCount.toLocaleString("vi-VN"),
      note: "Trong danh sách hiện tại",
      icon: ArrowDownToLine,
      tone: "success",
    },
    {
      label: "Lượt ra trang này",
      value: pageOutCount.toLocaleString("vi-VN"),
      note: "Trong danh sách hiện tại",
      icon: ArrowUpFromLine,
      tone: "critical",
    },
  ] as const

  return (
    <AdminPage className="min-h-dvh space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <AdminPageHeader
        className="gap-3 p-4 sm:gap-4 sm:px-5 sm:py-4"
        eyebrow="Dữ liệu vận hành"
        title="Thông tin ra vào"
        description="Theo dõi lịch sử cổng, thông tin phương tiện và ảnh nhận diện theo từng lượt ra vào."
        actionList={[
          {
            key: "current-time",
            content: (
              <div
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 text-sm text-primary shadow-xs"
                aria-label="Thời gian hệ thống"
              >
                <Clock3 className="size-4 shrink-0" aria-hidden="true" />
                <time className="font-semibold tabular-nums text-foreground">
                  {currentTime || "00:00:00"}
                </time>
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                  Giờ hệ thống
                </span>
              </div>
            ),
          },
          {
            key: "connection",
            content: (
              <button
                type="button"
                onClick={!isConnected ? reconnect : undefined}
                disabled={isConnected}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium shadow-xs transition-all ${
                  isConnected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                }`}
                aria-label={isConnected ? "Realtime đang kết nối" : "Kết nối lại realtime"}
              >
                {isConnected ? (
                  <Wifi className="size-4 text-emerald-600" />
                ) : (
                  <WifiOff className="size-4 text-rose-600 animate-pulse" />
                )}
                <span>{isConnected ? "Realtime" : "Kết nối lại"}</span>
              </button>
            ),
          },
        ]}
      />

      <DashboardMetricsSection
        id="vehicle-entry-exit-summary"
        title="Tổng quan bản ghi"
        description="Tóm tắt khoảng thời gian và lưu lượng của danh sách đang hiển thị."
        badge={(
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            isConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted text-muted-foreground"
          }`}>
            <Radio className={`size-3 ${isConnected ? "animate-pulse" : ""}`} aria-hidden="true" />
            {isConnected ? "Đang nhận realtime" : "Đang chờ kết nối"}
          </span>
        )}
        meta={!loading ? (
          <span className="text-xs text-muted-foreground">
            {totalElements.toLocaleString("vi-VN")} bản ghi
          </span>
        ) : undefined}
        loading={loading}
        metrics={recordOverviewMetrics}
      />

      {/* Control Actions / Period Select & Filter Triggers */}
      <Tabs value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)} className="w-full">
        <div className="overflow-hidden rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-card)]">
          <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:flex md:justify-between md:gap-3 ${isFilterBarOpen ? "border-b border-border pb-2 mb-2" : ""}`}>
            
            {/* Mobile Period Dropdown */}
            <div className="relative min-h-11 min-w-0 md:hidden">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger aria-label="Chọn khoảng thời gian" className="min-h-11 min-h-11 w-full rounded-xl border-border bg-background text-xs text-foreground pl-9 pr-2 focus:border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground text-xs">
                  <SelectItem value="daily">Hôm nay</SelectItem>
                  <SelectItem value="weekly">Tuần này</SelectItem>
                  <SelectItem value="monthly">Tháng này</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Tabs List in High Tech Style */}
            <TabsList className="hidden min-h-11 w-full grid-cols-3 rounded-xl bg-muted p-1 md:grid md:w-auto md:min-w-[24rem] border border-border">
              <TabsTrigger 
                value="daily" 
                className="min-h-11 gap-2 rounded-md px-3 text-xs tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/20 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                Hôm nay
              </TabsTrigger>
              <TabsTrigger 
                value="weekly" 
                className="min-h-11 gap-2 rounded-md px-3 text-xs tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/20 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                Tuần này
              </TabsTrigger>
              <TabsTrigger 
                value="monthly" 
                className="min-h-11 gap-2 rounded-md px-3 text-xs tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/20 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                Tháng này
              </TabsTrigger>
            </TabsList>

            {/* Actions Panel */}
            <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto md:flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                className={`min-h-11 px-3 rounded-xl text-xs transition-all duration-200 border ${
                  isFilterBarOpen
                    ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
                    : "border-border bg-background hover:bg-muted text-foreground hover:border-primary/30"
                }`}
                aria-label={isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}
              >
                <Filter className="size-3.5 mr-1.5" />
                <span>{isFilterBarOpen ? "Đóng bộ lọc" : "Bộ lọc"}</span>
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData} 
                className="min-h-11 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs hover:border-primary/30"
                aria-label="Làm mới dữ liệu"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                <span>Làm mới</span>
              </Button>

              {viewAllLogs && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="min-h-11 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs hover:border-emerald-500/20"
                  aria-label="Xuất báo cáo"
                >
                  <Download className="size-3.5 mr-1.5" />
                  <span>Xuất Excel</span>
                </Button>
              )}
            </div>
          </div>

          {/* High-Tech Collapsible Filter Panel */}
          {isFilterBarOpen && (
            <div className="bg-card border border-border rounded-xl p-4 mt-2 relative shadow-sm">
                            <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                <div>
                  <span className="text-xs text-primary">{"Bộ lọc bản ghi"}</span>
                  <h3 className="text-xs font-bold text-foreground mt-0.5">Bộ lọc</h3>
                </div>
                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-7 px-2.5 rounded text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500">
                    <Search className="size-3 text-primary" />
                    Biển số xe
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Nhập mã biển số..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="min-h-11 rounded-xl border-border bg-background pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500">
                    <Filter className="size-3 text-primary" />
                    Chiều di chuyển
                  </Label>
                  <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                    <SelectTrigger className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-muted-foreground focus:border-primary/30">
                      <SelectValue placeholder="Chiều di chuyển" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground text-xs">
                      <SelectItem value="all">Tất cả chiều</SelectItem>
                      <SelectItem value="entry">Vào cổng</SelectItem>
                      <SelectItem value="exit">Ra cổng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500">
                    <Car className="size-3 text-primary" />
                    Phân loại xe
                  </Label>
                  <Select value={vehicleTypeFilter} onValueChange={(value: any) => setVehicleTypeFilter(value)}>
                    <SelectTrigger className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-muted-foreground focus:border-primary/30">
                      <SelectValue placeholder="Phân loại xe" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground text-xs">
                      <SelectItem value="all">Tất cả loại xe</SelectItem>
                      <SelectItem value="internal">Xe nội bộ</SelectItem>
                      <SelectItem value="external">Xe bên ngoài</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500">
                  <Calendar className="size-3 text-primary" />
                  Khoảng thời gian tùy chỉnh
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[9px] text-slate-500">Từ thời điểm</Label>
                    <Input
                      aria-label="Từ ngày"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-foreground focus:border-primary/30"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[9px] text-slate-500">Đến thời điểm</Label>
                    <Input
                      aria-label="Đến ngày"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="min-h-11 w-full rounded-xl border-border bg-background text-xs text-foreground focus:border-primary/30"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Tabs>

      {/* Main Logs Table Block */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <span className="text-xs text-primary">{"Lịch sử hoạt động"}</span>
              <h2 className="text-base sm:text-lg font-black text-foreground mt-0.5">
                Nhật ký vận hành cổng
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary/100"></span>
                <span>Phạm vi: {getPeriodLabel()}</span>
                <span>·</span>
                <span>Kết quả: <span className="text-primary font-bold">{totalElements}</span> logs</span>
                {!viewAllLogs && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    Mã nhân viên nội bộ
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Label className="hidden text-sm text-slate-500 sm:inline">Kích thước trang:</Label>
              <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                <SelectTrigger aria-label="Số bản ghi hiển thị" className="min-h-11 w-24 rounded-xl border-border bg-background text-xs text-foreground focus:border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground text-xs">
                  <SelectItem value="10">10 dòng</SelectItem>
                  <SelectItem value="25">25 dòng</SelectItem>
                  <SelectItem value="50">50 dòng</SelectItem>
                  <SelectItem value="100">100 dòng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading shimmer and skeleton spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-xs text-muted-foreground">
            <RefreshCw className="min-h-11 w-8 animate-spin text-primary" />
            <span className="animate-pulse">Đang tải bản ghi...</span>
          </div>
        ) : (
          <>
            {/* Mobile View Card List */}
            <div className="space-y-4 p-4 md:hidden">
              {visibleLogs.map((log) => {
                const isEntry = log.type === "entry"
                return (
                  <article 
                    key={log.id} 
                    className="rounded-xl border border-border bg-background/50 p-4 transition-all duration-300 hover:border-border/80 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs text-slate-400">Biển số xe</span>
                        <p className="text-base font-black text-foreground tracking-wider">{log.licensePlateNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(log.entryExitTime)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold border ${
                          isEntry 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {isEntry ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                          {isEntry ? "Vào" : "Ra"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-border/40 pt-2.5">
                      <div>
                        <p className="text-xs text-slate-500">Loại xe</p>
                        <span className={`inline-flex items-center mt-1 text-xs px-1.5 py-0.5 rounded border font-bold ${
                          log.vehicleType === 'internal'
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {log.vehicleType === 'internal' ? 'Nội bộ' : 'Bên ngoài'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Cổng vị trí</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-700">{log.gateLocation || 'Cổng chính'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Người điều khiển</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-700">{log.driverName || 'Chưa xác định'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Chủ xe</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-700">{log.employeeName || 'Chưa xác định'}</p>
                      </div>
                    </div>

                    {log.imagePath && (
                      <div className="mt-3 border-t border-border/40 pt-2.5">
                        <span className="text-xs text-slate-400 block mb-1">Ảnh nhận diện</span>
                        <a
                          href={getImageUrl(log.imagePath) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-2 hover:bg-muted transition-all duration-200"
                        >
                          <div className="relative size-12 shrink-0 overflow-hidden rounded border border-border">
                            <img
                              src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                              alt={`Ảnh biển số ${log.licensePlateNumber}`}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary/50 animate-[pulse_1.5s_infinite]" />
                          </div>
                          <div className="min-w-0 text-sm">
                            <p className="text-primary font-bold tracking-wider">Ảnh nhận diện</p>
                            <p className="text-muted-foreground truncate mt-0.5">Chọn để xem ảnh độ phân giải cao</p>
                          </div>
                        </a>
                      </div>
                    )}
                  </article>
                )
              })}
              {visibleLogs.length === 0 && (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted border border-border text-muted-foreground mb-3">
                    <CarFront className="size-6" />
                  </span>
                  <p className="text-xs font-bold text-slate-500">Không tìm thấy dữ liệu</p>
                  <p className="text-xs mt-1 text-slate-400">Thử thay đổi tham số lọc hoặc nạp lại trang.</p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[54rem] border-collapse text-xs">
                <TableHeader className="bg-muted/30 border-b border-border">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Thời gian</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Biển số</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Hoạt động</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Loại xe</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Tài xế</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Chủ xe</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Mục đích</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Cổng</TableHead>
                    <TableHead className="text-slate-500 font-bold tracking-wider py-4">Ảnh nhận diện</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLogs.map((log) => {
                    const isEntry = log.type === "entry"
                    return (
                      <TableRow 
                        key={log.id} 
                        className="border-b border-border hover:bg-muted/30 transition-all duration-150"
                      >
                        <TableCell className="font-bold text-slate-700 py-3.5">
                          {formatDateTime(log.entryExitTime)}
                        </TableCell>
                        <TableCell className="font-black text-foreground tracking-widest text-sm">
                          {log.licensePlateNumber}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${
                            isEntry 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {isEntry ? <ArrowDownToLine className="size-3" /> : <ArrowUpFromLine className="size-3" />}
                            {isEntry ? "Vào" : "Ra"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border font-bold ${
                            log.vehicleType === 'internal'
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {log.vehicleType === 'internal' ? 'Nội bộ' : 'Bên ngoài'}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-700 font-medium">
                          {log.driverName || 'Chưa có'}
                        </TableCell>
                        <TableCell className="text-slate-700 font-medium">
                          {log.employeeName || 'Chưa có'}
                        </TableCell>
                        <TableCell className="text-slate-500 max-w-[12rem] truncate">
                          {log.purpose || '—'}
                        </TableCell>
                        <TableCell className="text-slate-700 font-bold">
                          {log.gateLocation || 'Cổng chính'}
                        </TableCell>
                        <TableCell>
                          {log.imagePath ? (
                            <a
                              href={getImageUrl(log.imagePath) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative inline-block size-10 overflow-hidden rounded border border-border hover:border-primary/30 transition-all duration-200"
                              title="Xem ảnh biển số chất lượng cao"
                            >
                              <img
                                src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                                alt={`Ảnh biển số ${log.licensePlateNumber}`}
                                className="h-full w-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute top-0 left-0 right-0 h-[1px] bg-primary/50 animate-[pulse_2s_infinite]" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có ảnh</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {visibleLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-20 text-center text-muted-foreground hover:bg-transparent">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="grid size-12 place-items-center rounded-xl bg-muted border border-border text-muted-foreground" aria-hidden="true">
                            <CarFront className="size-6" />
                          </span>
                          <span className="text-sm font-bold text-slate-500 tracking-wider">Không tìm thấy dữ liệu ra vào</span>
                          <span className="text-xs text-slate-400">Điều chỉnh các bộ lọc để tìm kiếm bản ghi khác.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls in High-Tech style */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-4 border-t border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex w-full items-center justify-center gap-2 text-center text-sm text-muted-foreground sm:w-auto sm:justify-start sm:text-left">
                  <span>Hiển thị <span className="font-bold text-slate-700">{currentPage * pageSize + 1}</span> - <span className="font-bold text-slate-700">{Math.min((currentPage + 1) * pageSize, totalElements)}</span> / Tổng <span className="font-bold text-slate-700">{totalElements}</span> bản ghi</span>
                </div>
                
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="min-h-11 border-border bg-background text-foreground text-xs hover:bg-muted disabled:opacity-30"
                  >
                    <span>&lt; Trước</span>
                  </Button>

                  <div className="flex items-center gap-1 text-xs">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = currentPage < 3 ? i : currentPage - 2 + i
                      if (page >= totalPages) return null
                      const active = currentPage === page
                      return (
                        <Button
                          key={page}
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className={`size-8 p-0 text-xs font-bold transition-all duration-150 ${
                            active 
                              ? "bg-primary/10 text-primary border-primary/20 font-bold shadow-sm hover:bg-primary/20"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {page + 1}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="min-h-11 border-border bg-background text-foreground text-xs hover:bg-muted disabled:opacity-30"
                  >
                    <span>Sau &gt;</span>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExportConfirmed}
        />
      )}
    </AdminPage>
  )
}
