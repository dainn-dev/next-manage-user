"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, Car, TrendingUp, ArrowUp, ArrowDown, Clock, Users, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { VehicleLog } from "@/lib/types"
import { vehicleLogApi, VehicleLogStatistics } from "@/lib/api/vehicle-log-api"

export default function VehicleMonitoringPage() {
  const [logs, setLogs] = useState<VehicleLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<VehicleLog[]>([])
  const [statistics, setStatistics] = useState<VehicleLogStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "entry" | "exit">("all")
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "internal" | "external">("all")
  const { toast } = useToast()

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, typeFilter, vehicleTypeFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [logsData, statsData] = await Promise.all([
        vehicleLogApi.getTodayLogs(0, 50),
        vehicleLogApi.getTodayStatistics()
      ])
      setLogs(logsData.content)
      setStatistics(statsData)
    } catch (error) {
      console.error('Error loading monitoring data:', error)
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu giám sát",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = [...logs]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.licensePlateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(log => log.type === typeFilter)
    }

    // Vehicle type filter
    if (vehicleTypeFilter !== "all") {
      filtered = filtered.filter(log => log.vehicleType === vehicleTypeFilter)
    }

    setFilteredLogs(filtered)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN')
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

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu giám sát...</p>
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
          <h1 className="text-3xl font-bold text-foreground">Giám sát xe</h1>
          <p className="text-muted-foreground text-lg">Theo dõi hoạt động ra vào của xe trong thời gian thực</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Xe vào hôm nay</CardTitle>
              <ArrowUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.entryCount}</div>
              <p className="text-xs text-muted-foreground">
                Số lượt xe vào
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Xe ra hôm nay</CardTitle>
              <ArrowDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statistics.exitCount}</div>
              <p className="text-xs text-muted-foreground">
                Số lượt xe ra
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Xe khác nhau</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.uniqueVehicles}</div>
              <p className="text-xs text-muted-foreground">
                Số xe duy nhất
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Xe đang trong</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.entryCount - statistics.exitCount}</div>
              <p className="text-xs text-muted-foreground">
                Xe hiện tại trong khu vực
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Biển số, tài xế..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Loại hoạt động
            </Label>
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn loại" />
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
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tình trạng
            </Label>
            <div className="text-sm text-muted-foreground pt-2">
              Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
            </div>
          </div>
        </div>
      </div>

      {/* Live Activity Table */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Hoạt động hôm nay ({filteredLogs.length})</h2>
          <p className="text-sm text-muted-foreground">Danh sách các hoạt động ra vào của xe</p>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Thời gian</TableHead>
                <TableHead>Biển số</TableHead>
                <TableHead>Hoạt động</TableHead>
                <TableHead>Loại xe</TableHead>
                <TableHead>Tài xế</TableHead>
                <TableHead>Chủ xe</TableHead>
                <TableHead>Mục đích</TableHead>
                <TableHead>Cổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{formatTime(log.entryExitTime)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(log.entryExitTime)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{log.licensePlateNumber}</span>
                    </div>
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
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Không có hoạt động nào trong ngày hôm nay
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
