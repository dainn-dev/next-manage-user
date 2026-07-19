"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  ShieldAlert
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, VehicleLogPage, VehicleLog, VehicleLogExportFilter } from "@/lib/api/vehicle-log-api"
import { getImageUrl } from "@/lib/api/config"
import { downloadBlob } from "@/lib/utils/download-blob"
import { ExportDialog } from "@/components/reports/export-dialog"
import { useAuth } from "@/lib/auth-context"
import { canViewAllLogs } from "@/lib/types"
import { AdminPage } from "@/components/layout/admin-page"

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

  return (
    <AdminPage className="space-y-6 bg-background text-foreground p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Visual background decorations matching Monitoring Page */}
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
                {"DATABASE_REGISTRY // ENTRANCE_LOGS"}
              </span>
              <span className="text-slate-300 font-mono text-[10px]">|</span>
              <span className="text-slate-500 font-mono text-[9px] tracking-wider uppercase">ARCHIVE_ACCESS: ALL_EVENTS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono uppercase">
              THÔNG TIN RA VÀO <span className="text-cyan-600">{"// RECORDS"}</span>
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Danh sách chi tiết lịch sử đóng mở cổng, định danh phương tiện nội bộ và khách vãng lai thông qua AI Camera.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            {/* Live digital clock */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg border border-border bg-muted/50 font-mono text-xs">
              <span className="text-muted-foreground text-[8px] uppercase tracking-wider">Hệ thống thời gian</span>
              <span className="text-cyan-600 font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mini Diagnostic Grid */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Thông số phân đoạn">
        {[
          { 
            label: "Bộ lọc thời gian", 
            value: getPeriodLabel(), 
            icon: Calendar, 
            id: "FILTER_PERIOD", 
            color: "text-cyan-600", 
            glow: "rgba(6,182,212,0.04)", 
            border: "border-cyan-100",
            bg: "bg-cyan-50/20"
          },
          { 
            label: "Lượt vào trang này", 
            value: loading ? "..." : pageInCount, 
            icon: ArrowDownToLine, 
            id: "PAGE_IN_COUNT", 
            color: "text-emerald-600", 
            glow: "rgba(16,185,129,0.04)", 
            border: "border-emerald-100",
            bg: "bg-emerald-50/20"
          },
          { 
            label: "Lượt ra trang này", 
            value: loading ? "..." : pageOutCount, 
            icon: ArrowUpFromLine, 
            id: "PAGE_OUT_COUNT", 
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
              <span className="text-[8px] font-mono text-muted-foreground/60">STATE_OK</span>
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

      {/* Control Actions / Period Select & Filter Triggers */}
      <Tabs value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)} className="w-full">
        <div className="overflow-hidden rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-card)]">
          <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:flex md:justify-between md:gap-3 ${isFilterBarOpen ? "border-b border-border pb-2 mb-2" : ""}`}>
            
            {/* Mobile Period Dropdown */}
            <div className="relative h-10 min-w-0 md:hidden">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-cyan-600" aria-hidden="true" />
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger aria-label="Chọn khoảng thời gian" className="h-10 min-h-10 w-full rounded-lg border-border bg-background text-xs font-mono text-foreground pl-9 pr-2 focus:border-cyan-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground font-mono text-xs">
                  <SelectItem value="daily">Hôm nay</SelectItem>
                  <SelectItem value="weekly">Tuần này</SelectItem>
                  <SelectItem value="monthly">Tháng này</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Tabs List in High Tech Style */}
            <TabsList className="hidden h-10 w-full grid-cols-3 rounded-lg bg-muted p-1 md:grid md:w-auto md:min-w-[24rem] border border-border">
              <TabsTrigger 
                value="daily" 
                className="h-8 gap-2 rounded-md px-3 text-xs font-mono tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-cyan-600 data-[state=active]:border data-[state=active]:border-cyan-100 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                HÔM_NAY
              </TabsTrigger>
              <TabsTrigger 
                value="weekly" 
                className="h-8 gap-2 rounded-md px-3 text-xs font-mono tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-cyan-600 data-[state=active]:border data-[state=active]:border-cyan-100 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                TUẦN_NÀY
              </TabsTrigger>
              <TabsTrigger 
                value="monthly" 
                className="h-8 gap-2 rounded-md px-3 text-xs font-mono tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-cyan-600 data-[state=active]:border data-[state=active]:border-cyan-100 hover:text-foreground text-muted-foreground shadow-sm"
              >
                <Calendar className="size-3.5" />
                THÁNG_NÀY
              </TabsTrigger>
            </TabsList>

            {/* Actions Panel */}
            <div className="flex shrink-0 items-center justify-end gap-2 md:w-auto md:flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                className={`h-10 px-3 rounded-lg font-mono text-xs transition-all duration-200 border ${
                  isFilterBarOpen
                    ? "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                    : "border-border bg-background hover:bg-muted text-foreground hover:border-cyan-500/20"
                }`}
                aria-label={isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}
              >
                <Filter className="size-3.5 mr-1.5" />
                <span>{isFilterBarOpen ? "ĐÓNG_LỌC" : "BỘ_LỌC"}</span>
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData} 
                className="h-10 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-mono text-xs hover:border-cyan-500/20"
                aria-label="Làm mới dữ liệu"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                <span>NẠP_LẠI</span>
              </Button>

              {viewAllLogs && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-10 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-mono text-xs hover:border-emerald-500/20"
                  aria-label="Xuất báo cáo"
                >
                  <Download className="size-3.5 mr-1.5" />
                  <span>XUẤT_EXCEL</span>
                </Button>
              )}
            </div>
          </div>

          {/* High-Tech Collapsible Filter Panel */}
          {isFilterBarOpen && (
            <div className="bg-card border border-border rounded-lg p-4 mt-2 relative shadow-sm">
              <div className="absolute top-0 left-4 w-10 h-[1px] bg-cyan-500/50" />
              
              <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                <div>
                  <span className="text-[8px] font-mono text-cyan-600">{"QUERY_FILTER // ENGINE"}</span>
                  <h3 className="text-xs font-bold text-foreground font-mono uppercase mt-0.5">Tham số truy vấn</h3>
                </div>
                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-7 px-2.5 rounded text-[10px] font-mono text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    XÓA_BỘ_LỌC
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                    <Search className="size-3 text-cyan-600" />
                    Biển số xe
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Nhập mã biển số..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-10 rounded-lg border-border bg-background pl-9 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-cyan-500/30 focus:ring-cyan-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                    <Filter className="size-3 text-cyan-600" />
                    Chiều di chuyển
                  </Label>
                  <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                    <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background text-xs font-mono text-muted-foreground focus:border-cyan-500/30">
                      <SelectValue placeholder="Chiều di chuyển" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground font-mono text-xs">
                      <SelectItem value="all">TẤT CẢ CHIỀU</SelectItem>
                      <SelectItem value="entry">VÀO CỔNG</SelectItem>
                      <SelectItem value="exit">RA CỔNG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                    <Car className="size-3 text-cyan-600" />
                    Phân loại xe
                  </Label>
                  <Select value={vehicleTypeFilter} onValueChange={(value: any) => setVehicleTypeFilter(value)}>
                    <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background text-xs font-mono text-muted-foreground focus:border-cyan-500/30">
                      <SelectValue placeholder="Phân loại xe" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground font-mono text-xs">
                      <SelectItem value="all">TẤT CẢ PHÂN LOẠI</SelectItem>
                      <SelectItem value="internal">XE NỘI BỘ</SelectItem>
                      <SelectItem value="external">XE BÊN NGOÀI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  <Calendar className="size-3 text-cyan-600" />
                  KHOẢNG THỜI GIAN TUỲ CHỈNH
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[9px] font-mono text-slate-500">MỐC BẮT ĐẦU (TỪ)</Label>
                    <Input
                      aria-label="Từ ngày"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 w-full rounded-lg border-border bg-background text-xs font-mono text-foreground focus:border-cyan-500/30"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[9px] font-mono text-slate-500">MỐC KẾT THÚC (ĐẾN)</Label>
                    <Input
                      aria-label="Đến ngày"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10 w-full rounded-lg border-border bg-background text-xs font-mono text-foreground focus:border-cyan-500/30"
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
              <span className="text-[8px] font-mono text-cyan-600">{"LOG_HISTORY // STREAMS"}</span>
              <h2 className="text-base sm:text-lg font-black text-foreground font-mono uppercase mt-0.5">
                Nhật ký vận hành cổng
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span className="size-1.5 rounded-full bg-cyan-500"></span>
                <span>Phạm vi: {getPeriodLabel()}</span>
                <span>·</span>
                <span>Kết quả: <span className="text-cyan-600 font-bold">{totalElements}</span> logs</span>
                {!viewAllLogs && (
                  <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700 border border-cyan-200 uppercase">
                    Mã nhân viên nội bộ
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Label className="hidden text-[10px] font-mono text-slate-500 uppercase sm:inline">Kích thước trang:</Label>
              <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                <SelectTrigger aria-label="Số bản ghi hiển thị" className="h-9 w-24 rounded-lg border-border bg-background text-xs font-mono text-foreground focus:border-cyan-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground font-mono text-xs">
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
          <div className="flex flex-col items-center justify-center py-20 gap-4 font-mono text-xs text-muted-foreground">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-600" />
            <span className="animate-pulse">DECRYPTING_SECURITY_LOGS...</span>
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
                        <span className="text-[8px] font-mono text-slate-400">[LICENSE_PLATE_ID]</span>
                        <p className="font-mono text-base font-black text-foreground tracking-wider">{log.licensePlateNumber}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{formatDateTime(log.entryExitTime)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                          isEntry 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {isEntry ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                          {isEntry ? "VÀO" : "RA"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-mono border-t border-border/40 pt-2.5">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Loại xe</p>
                        <span className={`inline-flex items-center mt-1 text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                          log.vehicleType === 'internal'
                            ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {log.vehicleType === 'internal' ? 'NỘI BỘ' : 'BÊN NGOÀI'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Cổng vị trí</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-slate-700">{log.gateLocation || 'GATE_CENTRAL'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Người điều khiển</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-slate-700">{log.driverName || 'CHƯA XÁC ĐỊNH'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Chủ xe</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-slate-700">{log.employeeName || 'CHƯA XÁC ĐỊNH'}</p>
                      </div>
                    </div>

                    {log.imagePath && (
                      <div className="mt-3 border-t border-border/40 pt-2.5">
                        <span className="text-[8px] font-mono text-slate-400 block mb-1">[IMAGE_CAPTURED]</span>
                        <a
                          href={getImageUrl(log.imagePath) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2 hover:bg-muted transition-all duration-200"
                        >
                          <div className="relative size-12 shrink-0 overflow-hidden rounded border border-border">
                            <img
                              src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                              alt={`Ảnh biển số ${log.licensePlateNumber}`}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-cyan-500/50 animate-[pulse_1.5s_infinite]" />
                          </div>
                          <div className="min-w-0 font-mono text-[10px]">
                            <p className="text-cyan-700 font-bold uppercase tracking-wider">PHÂN TÍCH THỊ GIÁC</p>
                            <p className="text-muted-foreground truncate mt-0.5">Click để xem ảnh độ phân giải cao</p>
                          </div>
                        </a>
                      </div>
                    )}
                  </article>
                )
              })}
              {visibleLogs.length === 0 && (
                <div className="px-4 py-12 text-center font-mono text-muted-foreground">
                  <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted border border-border text-muted-foreground mb-3">
                    <CarFront className="size-6" />
                  </span>
                  <p className="text-xs font-bold text-slate-500 uppercase">Không tìm thấy dữ liệu</p>
                  <p className="text-[10px] mt-1 text-slate-400">Thử thay đổi tham số lọc hoặc nạp lại trang.</p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[54rem] border-collapse font-mono text-xs">
                <TableHeader className="bg-muted/30 border-b border-border">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Thời gian</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Biển số</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Hoạt động</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Loại xe</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Tài xế</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Chủ xe</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Mục đích</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Cổng</TableHead>
                    <TableHead className="text-slate-500 font-bold uppercase tracking-wider py-4">Ảnh Captured</TableHead>
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
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase border ${
                            isEntry 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {isEntry ? <ArrowDownToLine className="size-3" /> : <ArrowUpFromLine className="size-3" />}
                            {isEntry ? "VÀO" : "RA"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border font-bold ${
                            log.vehicleType === 'internal'
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {log.vehicleType === 'internal' ? 'NỘI BỘ' : 'BÊN NGOÀI'}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-700 font-medium">
                          {log.driverName || 'CHƯA CÓ'}
                        </TableCell>
                        <TableCell className="text-slate-700 font-medium">
                          {log.employeeName || 'CHƯA CÓ'}
                        </TableCell>
                        <TableCell className="text-slate-500 max-w-[12rem] truncate">
                          {log.purpose || '—'}
                        </TableCell>
                        <TableCell className="text-slate-700 font-bold">
                          {log.gateLocation || 'GATE_CENTRAL'}
                        </TableCell>
                        <TableCell>
                          {log.imagePath ? (
                            <a
                              href={getImageUrl(log.imagePath) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative inline-block size-10 overflow-hidden rounded border border-border hover:border-cyan-500 transition-all duration-200"
                              title="Xem ảnh biển số chất lượng cao"
                            >
                              <img
                                src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                                alt={`Ảnh biển số ${log.licensePlateNumber}`}
                                className="h-full w-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute top-0 left-0 right-0 h-[1px] bg-cyan-500/50 animate-[pulse_2s_infinite]" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">[NO_IMAGE]</span>
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
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Không tìm thấy dữ liệu ra vào</span>
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
                <div className="flex w-full items-center justify-center gap-2 text-center font-mono text-[10px] text-muted-foreground sm:w-auto sm:justify-start sm:text-left">
                  <span className="size-2 bg-cyan-500/50 rounded-full animate-pulse"></span>
                  <span>HIỂN THỊ <span className="font-bold text-slate-700">{currentPage * pageSize + 1}</span> - <span className="font-bold text-slate-700">{Math.min((currentPage + 1) * pageSize, totalElements)}</span> / TỔNG <span className="font-bold text-slate-700">{totalElements}</span> RECORDS</span>
                </div>
                
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="h-8 border-border bg-background text-foreground font-mono text-xs hover:bg-muted disabled:opacity-30"
                  >
                    <span>&lt; PREV</span>
                  </Button>

                  <div className="flex items-center gap-1 font-mono text-xs">
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
                          className={`size-8 p-0 text-xs font-bold font-mono transition-all duration-150 ${
                            active 
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200 font-bold shadow-sm hover:bg-cyan-100" 
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
                    className="h-8 border-border bg-background text-foreground font-mono text-xs hover:bg-muted disabled:opacity-30"
                  >
                    <span>NEXT &gt;</span>
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
