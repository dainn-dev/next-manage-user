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
import type { VehicleLog } from "@/lib/types"
import { vehicleLogApi, VehicleLogPage } from "@/lib/api/vehicle-log-api"

export default function VehicleEntryExitPage() {
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

  const handleExport = () => {
    toast({
      title: "Thông báo",
      description: "Tính năng xuất dữ liệu đang được phát triển",
    })
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

  if (loading && logs.length === 0) {
    return (
      <div className="p-8 bg-background min-h-screen">
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
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Thông tin ra vào</h1>
          <p className="text-muted-foreground text-lg">Quản lý và theo dõi lịch sử ra vào của xe</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Xuất Excel
          </Button>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Hôm nay
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tuần này
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tháng này
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filter Bar */}
      <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nhập biển số xe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Hoạt động
            </Label>
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn hoạt động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🔄 Tất cả</SelectItem>
                <SelectItem value="entry">⬆️ Vào</SelectItem>
                <SelectItem value="exit">⬇️ Ra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Loại xe
            </Label>
            <Select value={vehicleTypeFilter} onValueChange={(value: any) => setVehicleTypeFilter(value)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn loại xe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🚗 Tất cả</SelectItem>
                <SelectItem value="internal">🏢 Nội bộ</SelectItem>
                <SelectItem value="external">🌐 Bên ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Từ ngày</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Đến ngày</Label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Lịch sử ra vào - {getPeriodLabel()}</h2>
              <p className="text-sm text-muted-foreground">
                Tổng số: {totalElements} bản ghi
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Hiển thị:</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                  <SelectTrigger className="w-20 h-8">
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
        
        <div className="overflow-x-auto">
          <Table>
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
                <TableHead>Bảo vệ</TableHead>
                <TableHead className="w-[100px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
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
                    <span className="text-sm">{log.securityGuardName || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu thông tin ra vào
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Hiển thị {currentPage * pageSize + 1} đến {Math.min((currentPage + 1) * pageSize, totalElements)} của {totalElements} bản ghi
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
              >
                Trước
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
                      className="w-8 h-8 p-0"
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
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
