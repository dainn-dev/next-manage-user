"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw, Car, ArrowUp, ArrowDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, VehicleLogStatistics, VehicleLog } from "@/lib/api/vehicle-log-api"

export default function VehicleMonitoringPage() {
  const [logs, setLogs] = useState<VehicleLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<VehicleLog[]>([])
  const [statistics, setStatistics] = useState<VehicleLogStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "entry" | "exit">("all")
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "internal" | "external">("all")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedLog, setSelectedLog] = useState<VehicleLog | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => {
      clearInterval(interval)
      clearInterval(clockInterval)
    }
  }, [])

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, typeFilter, vehicleTypeFilter])

  useEffect(() => {
    // Auto-select the latest log for display
    if (filteredLogs.length > 0 && !selectedLog) {
      setSelectedLog(filteredLogs[0])
    }
  }, [filteredLogs, selectedLog])

  const loadData = async () => {
    try {
      setLoading(true)
      const [logsData, statsData] = await Promise.all([
        vehicleLogApi.getTodayLogs(0, 50),
        vehicleLogApi.getTodayStatistics()
      ])
      setLogs(logsData.content)
      setStatistics(statsData)
      
      // Auto-select the latest log if none is selected
      if (logsData.content.length > 0 && !selectedLog) {
        setSelectedLog(logsData.content[0])
      }
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

  const formatClock = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/:/g, ' : ')
  }

  const formatCurrentDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getTypeIcon = (type: string) => {
    return type === 'entry' ? <ArrowUp className="h-4 w-4 text-green-600" /> : <ArrowDown className="h-4 w-4 text-red-600" />
  }

  const getTypeBadge = (type: string) => {
    return type === 'entry' 
      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Vào</Badge>
      : <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Ra</Badge>
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
    <div className="bg-gray-100 p-6 min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Theo dõi ra / vào</h1>
          <Button onClick={loadData} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personnel Information */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Thông tin quân nhân ra / vào</h2>
              
              <div className="border-2 border-gray-300 rounded-lg p-6">
                {selectedLog ? (
                  <div className="flex gap-6">
                    {/* Photo placeholder */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-gray-200 border-2 border-gray-400 rounded flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Information table */}
                    <div className="flex-1">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Giờ ra / vào:</td>
                            <td className="py-2 text-gray-800">{formatTime(selectedLog.entryExitTime)} - {formatDate(selectedLog.entryExitTime)}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Họ và tên:</td>
                            <td className="py-2 text-gray-800">{selectedLog.driverName || 'N/A'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Cơ quan, đơn vị:</td>
                            <td className="py-2 text-gray-800">{selectedLog.employeeName || 'N/A'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">ID quân nhân:</td>
                            <td className="py-2 text-gray-800">{selectedLog.vehicleId || 'N/A'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Tình trạng:</td>
                            <td className="py-2 text-gray-800">{selectedLog.type === 'entry' ? 'Vào cổng' : 'Ra cổng'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Loại xe:</td>
                            <td className="py-2 text-gray-800">Honda Civic</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-gray-700">Biển số:</td>
                            <td className="py-2 text-gray-800">{selectedLog.licensePlateNumber}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    {/* Photo placeholder */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-gray-200 border-2 border-gray-400 rounded flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Information table with sample data */}
                    <div className="flex-1">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Giờ ra / vào:</td>
                            <td className="py-2 text-gray-800">10:30 - 29/09/2025</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Họ và tên:</td>
                            <td className="py-2 text-gray-800">Nguyễn Văn A</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Cơ quan, đơn vị:</td>
                            <td className="py-2 text-gray-800">Tiểu đoàn 9</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">ID quân nhân:</td>
                            <td className="py-2 text-gray-800">MA001</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Tình trạng:</td>
                            <td className="py-2 text-gray-800">Ra cổng</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Loại xe:</td>
                            <td className="py-2 text-gray-800">Honda Civic</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-gray-700">Biển số:</td>
                            <td className="py-2 text-gray-800">76M5 -14389</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Clock and Photo */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="mb-4">
                <div className="text-lg font-medium text-gray-700">{formatCurrentDate(currentTime)}</div>
              </div>
              
              <div className="text-4xl font-bold text-gray-800 mb-6 font-mono">
                {formatClock(currentTime)}
              </div>
              
              <div className="w-32 h-32 bg-gray-200 border-2 border-gray-300 rounded mx-auto flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Personnel Queue Section - Full Width */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Thứ tự quân nhân ra vào</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-4">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className={`rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                  selectedLog?.id === log.id 
                    ? 'bg-blue-100 border-2 border-blue-400' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="w-16 h-16 bg-gray-200 border border-gray-300 rounded mx-auto mb-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                  </svg>
                </div>
                <div className="text-sm font-medium text-gray-700">{log.driverName || 'Lê Văn B'}</div>
                <div className="text-xs text-gray-500">{log.employeeName || 'Tiểu đoàn 8'}</div>
              </div>
            ))}
            
            {/* Add some placeholder cards if no logs */}
            {filteredLogs.length === 0 && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-gray-100 rounded-lg p-4 text-center">
                    <div className="w-16 h-16 bg-gray-200 border border-gray-300 rounded mx-auto mb-2 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-gray-700">Lê Văn B</div>
                    <div className="text-xs text-gray-500">Tiểu đoàn 8</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Hidden Filters Section */}
        <div className="hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm biển số, tài xế..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Loại hoạt động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="entry">Vào</SelectItem>
                <SelectItem value="exit">Ra</SelectItem>
              </SelectContent>
            </Select>

            <Select value={vehicleTypeFilter} onValueChange={(value: any) => setVehicleTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Loại xe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="internal">Nội bộ</SelectItem>
                <SelectItem value="external">Bên ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
