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
import { Search, RefreshCw, Car, TrendingUp, ArrowUp, ArrowDown, Calendar, Download, Plus, Filter, Eye, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, VehicleLogPage, VehicleLog, VehicleLogExportFilter } from "@/lib/api/vehicle-log-api"
import { getImageUrl } from "@/lib/api/config"
import { downloadBlob } from "@/lib/utils/download-blob"
import { ExportDialog } from "@/components/reports/export-dialog"
import { useAuth } from "@/lib/auth-context"
import { canViewAllLogs } from "@/lib/types"

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

  const { toast } = useToast()

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
        title: "Lỗi",
        description: "Không thể tải dữ liệu thông tin ra vào",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      // If no date range is set, use default ranges based on period
      const now = new Date()
      let start: Date, end: Date

      switch (periodFilter) {
        case 'daily':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        case 'weekly':
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          start = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate())
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        case 'monthly':
          start = new Date(now.getFullYear(), now.getMonth(), 1)
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        default:
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      }

      try {
        setLoading(true)
        const response = await vehicleLogApi.searchVehicleLogs({
          licensePlate: searchTerm || undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          vehicleType: vehicleTypeFilter !== "all" ? vehicleTypeFilter : undefined,
          startDate: startDate || start.toISOString(),
          endDate: endDate || end.toISOString(),
          page: currentPage,
          size: pageSize
        })

        setLogs(response.content)
        setTotalPages(response.totalPages)
        setTotalElements(response.totalElements)
      } catch (error) {
        console.error('Error searching vehicle logs:', error)
        toast({
          title: "Lỗi",
          description: "Không thể tìm kiếm dữ liệu",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0)
  }

  // Build the export filter from the current search/period state. When no
  // explicit date range is set, derive one from the active period tab so the
  // export matches what the user is looking at.
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

  const handleExportConfirmed = async (options: { format: string }) => {
    const format = (options.format || "EXCEL").toUpperCase()
    if (format !== "EXCEL" && format !== "CSV") {
      toast({
        title: "Chưa hỗ trợ",
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
        title: "Xuất file thành công",
        description: `Đã xuất dữ liệu ra file ${isCsv ? 'CSV' : 'Excel'}`,
        variant: "default",
      })
    } catch (error) {
      console.error('Error exporting vehicle logs:', error)
      toast({
        title: "Lỗi xuất file",
        description: "Có lỗi xảy ra khi xuất dữ liệu. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const getTypeIcon = (type: string) => {
    return type === 'entry' ? <ArrowUp className="h-4 w-4 text-green-600" /> : <ArrowDown className="h-4 w-4 text-red-600" />
  }

  const getTypeBadge = (type: string) => {
    return type === 'entry' 
      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Vào</Badge>
      : <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Ra</Badge>
  }

  const getVehicleTypeBadge = (vehicleType: string) => {
    return vehicleType === 'internal'
      ? <Badge variant="secondary">Nội bộ</Badge>
      : <Badge variant="outline">Bên ngoài</Badge>
  }

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'daily': return 'Hôm nay'
      case 'weekly': return 'Tuần này'
      case 'monthly': return 'Tháng này'
      default: return 'Tất cả'
    }
  }

  const viewAllLogs = canViewAllLogs(user?.role)
  const visibleLogs = viewAllLogs
    ? logs
    : logs.filter((log) => log.employeeName && user?.employeeName && log.employeeName === user.employeeName)

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải thông tin ra vào...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-4xl">Thông tin ra vào</h1>
          <p className="text-sm text-muted-foreground sm:text-lg">Quản lý và theo dõi lịch sử ra vào của xe</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {viewAllLogs && (
            <Button onClick={handleExport} variant="outline" className="w-full shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Xuất báo cáo
            </Button>
          )}
          <Button onClick={loadData} variant="outline" className="w-full shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)} className="mb-6">
        <TabsList className="grid h-10 w-full max-w-lg grid-cols-3 shadow-sm">
          <TabsTrigger value="daily" className="gap-1 px-1 text-xs transition-colors duration-200 hover:bg-blue-50 sm:gap-2 sm:px-2 sm:text-sm">
            <Calendar className="hidden h-4 w-4 sm:block" />
            Hôm nay
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1 px-1 text-xs transition-colors duration-200 hover:bg-blue-50 sm:gap-2 sm:px-2 sm:text-sm">
            <Calendar className="hidden h-4 w-4 sm:block" />
            Tuần này
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1 px-1 text-xs transition-colors duration-200 hover:bg-blue-50 sm:gap-2 sm:px-2 sm:text-sm">
            <Calendar className="hidden h-4 w-4 sm:block" />
            Tháng này
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filter Bar */}
      <div className="bg-white border rounded-lg mb-6 shadow-sm">
        {/* Action Buttons - Inline */}
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/50 p-3 sm:flex-row sm:flex-wrap sm:gap-4 sm:p-6">
          <Button
            variant={isFilterBarOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
            className="flex w-full items-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto"
          >
            <Filter className="h-4 w-4" />
            {isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}
            {isFilterBarOpen ? (
              <span className="ml-1 text-sm">▼</span>
            ) : (
              <span className="ml-1 text-sm">▶</span>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData} 
            className="flex w-full items-center gap-2 shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới dữ liệu
          </Button>
          {viewAllLogs && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex w-full items-center gap-2 shadow-sm transition-all duration-200 hover:border-green-300 hover:bg-green-50 hover:shadow-md sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Xuất báo cáo
            </Button>
          )}
        </div>

        {/* Collapsible Filter Content */}
        {isFilterBarOpen && (
          <div className="bg-white p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Bộ lọc tìm kiếm</h3>
              <p className="text-sm text-gray-600">Sử dụng các bộ lọc bên dưới để tìm kiếm lịch sử ra vào theo tiêu chí cụ thể</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-5">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  Tìm kiếm
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nhập biển số xe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-green-600" />
                  Hoạt động
                </Label>
                <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
                    <SelectValue placeholder="Chọn hoạt động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🔄 Tất cả</SelectItem>
                    <SelectItem value="entry">⬆️ Vào</SelectItem>
                    <SelectItem value="exit">⬇️ Ra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Car className="h-4 w-4 text-purple-600" />
                  Loại xe
                </Label>
                <Select value={vehicleTypeFilter} onValueChange={(value: any) => setVehicleTypeFilter(value)}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
                    <SelectValue placeholder="Chọn loại xe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🚗 Tất cả</SelectItem>
                    <SelectItem value="internal">🏢 Nội bộ</SelectItem>
                    <SelectItem value="external">🌐 Bên ngoài</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  Từ ngày
                </Label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-red-600" />
                  Đến ngày
                </Label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="border-b border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="mb-1 text-lg font-semibold text-gray-800 sm:text-xl">Lịch sử ra vào - {getPeriodLabel()}</h2>
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Tổng số: <span className="font-medium text-blue-600">{visibleLogs.length}</span> bản ghi
                {!viewAllLogs && (
                  <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Chỉ hiển thị xe của bạn</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700">Hiển thị:</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                  <SelectTrigger className="w-24 h-9 border-gray-300 rounded-lg shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {visibleLogs.map((log) => (
            <article key={log.id} className="rounded-lg border border-gray-200 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold text-gray-900">{log.licensePlateNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.entryExitTime)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {getTypeIcon(log.type)}
                  {getTypeBadge(log.type)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Loại xe</p>
                  <div className="mt-1">{getVehicleTypeBadge(log.vehicleType)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cổng</p>
                  <p className="mt-1 truncate font-medium text-gray-800">{log.gateLocation || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tài xế</p>
                  <p className="mt-1 truncate text-gray-800">{log.driverName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chủ xe</p>
                  <p className="mt-1 truncate text-gray-800">{log.employeeName || 'N/A'}</p>
                </div>
              </div>
              {log.imagePath && (
                <a
                  href={getImageUrl(log.imagePath) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                >
                  <img
                    src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                    alt={`Ảnh biển số ${log.licensePlateNumber}`}
                    className="h-10 w-16 rounded border object-cover"
                  />
                  Xem ảnh biển số
                </a>
              )}
            </article>
          ))}
          {visibleLogs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Không có dữ liệu thông tin ra vào</p>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[54rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Biển số</TableHead>
                <TableHead>Hoạt động</TableHead>
                <TableHead>Loại xe</TableHead>
                <TableHead>Tài xế</TableHead>
                <TableHead>Chủ xe</TableHead>
                <TableHead>Mục đích</TableHead>
                <TableHead>Cổng</TableHead>
                <TableHead>Ảnh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <span className="text-sm">{formatDateTime(log.entryExitTime)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold">{log.licensePlateNumber}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(log.type)}
                      {getTypeBadge(log.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getVehicleTypeBadge(log.vehicleType)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{log.driverName || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{log.employeeName || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{log.purpose || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{log.gateLocation || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    {log.imagePath ? (
                      <a
                        href={getImageUrl(log.imagePath) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Nhấn để phóng to ảnh biển số"
                      >
                        <img
                          src={getImageUrl(log.imagePath) || '/placeholder.jpg'}
                          alt={`Ảnh biển số ${log.licensePlateNumber}`}
                          className="h-10 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visibleLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu thông tin ra vào
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex w-full items-center justify-center gap-2 text-center text-sm text-gray-600 sm:w-auto sm:justify-start sm:text-left">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              Hiển thị <span className="font-medium text-gray-800">{currentPage * pageSize + 1}</span> đến <span className="font-medium text-gray-800">{Math.min((currentPage + 1) * pageSize, totalElements)}</span> của <span className="font-medium text-gray-800">{totalElements}</span> bản ghi
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="shadow-sm hover:shadow-md transition-all duration-200"
              >
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">← Trước</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = currentPage < 3 ? i : currentPage - 2 + i
                  if (page >= totalPages) return null
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-9 h-9 p-0 shadow-sm hover:shadow-md transition-all duration-200"
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
                className="shadow-sm hover:shadow-md transition-all duration-200"
              >
                <span className="sm:hidden">→</span>
                <span className="hidden sm:inline">Sau →</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExportConfirmed}
        />
      )}
    </div>
  )
}
