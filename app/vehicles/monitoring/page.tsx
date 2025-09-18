"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw, Car, ArrowUp, ArrowDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, VehicleLogStatistics, VehicleLog, EmployeeVehicleInfo } from "@/lib/api/vehicle-log-api"
import { useWebSocket, VehicleCheckMessage } from "@/hooks/use-websocket"
import { dataService } from "@/lib/data-service"

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
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeVehicleInfo | null>(null)
  const [isLoadingEmployeeInfo, setIsLoadingEmployeeInfo] = useState(false)
  const { toast } = useToast()

  // WebSocket handler for vehicle check events
  const handleVehicleCheck = async (message: VehicleCheckMessage) => {
    try {
      setIsLoadingEmployeeInfo(true)
      console.log('Vehicle check received:', message)
      
      // Call employee-info API with the received license plate and type
      const info = await dataService.getEmployeeInfoByLicensePlate(
        message.licensePlateNumber, 
        message.type.toLowerCase() as 'entry' | 'exit'
      )
      
      setEmployeeInfo(info)
      
      toast({
        title: "Thông tin quân nhân",
        description: `Đã tải thông tin cho xe ${message.licensePlateNumber}`,
        variant: "default",
      })
      
    } catch (error) {
      console.error('Error fetching employee info:', error)
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin quân nhân",
        variant: "destructive",
      })
    } finally {
      setIsLoadingEmployeeInfo(false)
    }
  }

  // Initialize WebSocket connection
  const { isConnected, connectionError, reconnect } = useWebSocket(handleVehicleCheck)

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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mb-4 shadow-lg">
            <Car className="w-8 h-8 text-white" />
        </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Theo dõi ra / vào</h1>
          <p className="text-gray-600 mb-4">Hệ thống giám sát an ninh thông minh</p>
          <div className="flex items-center gap-4">
            <Button onClick={loadData} variant="outline" className="hover:bg-blue-50 hover:border-blue-300 transition-all duration-200">
              <RefreshCw className="h-4 w-4 mr-2" />
              Làm mới dữ liệu
            </Button>
            
            {/* WebSocket Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium cursor-pointer ${
              isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`} onClick={!isConnected ? reconnect : undefined} title={connectionError || ''}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              {isConnected ? 'WebSocket Kết nối' : 'Kết nối lại'}
            </div>
            
            {/* Test Button */}
            <Button 
              onClick={async () => {
                try {
                  await vehicleLogApi.testVehicleCheck("29B-12345", "entry")
                  toast({
                    title: "Test thành công",
                    description: "Đã gửi test vehicle check",
                  })
                } catch (error) {
                  toast({
                    title: "Test thất bại",
                    description: "Không thể gửi test vehicle check",
                    variant: "destructive",
                  })
                }
              }}
              variant="outline" 
              className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-700"
            >
              Test WebSocket
            </Button>
          </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personnel Information */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Thông tin quân nhân ra / vào</h2>
              </div>
              
              <div className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-br from-gray-50 to-white">
                {isLoadingEmployeeInfo ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">Đang tải thông tin quân nhân...</p>
                    </div>
                  </div>
                ) : employeeInfo ? (
                  <div className="flex gap-6">
                    {/* Photo placeholder */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-gradient-to-br from-green-100 to-green-50 border-2 border-green-200 rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-center">
                          <svg className="w-12 h-12 text-green-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                          </svg>
                          <span className="text-xs text-green-500 font-medium">Ảnh</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Information table */}
                    <div className="flex-1">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Giờ ra / vào:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.logTime ? new Date(employeeInfo.logTime).toLocaleString('vi-VN') : 'N/A'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Họ và tên:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.employeeName}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Cơ quan, đơn vị:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.department}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">ID quân nhân:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.employeeId}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Tình trạng:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.logType === 'ENTRY' ? 'Vào cổng' : 'Ra cổng'}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-4 font-semibold text-gray-700">Loại xe:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.brand && employeeInfo.model ? `${employeeInfo.brand} ${employeeInfo.model}` : 'N/A'}</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-semibold text-gray-700">Biển số:</td>
                            <td className="py-2 text-gray-800">{employeeInfo.licensePlateNumber}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedLog ? (
                  <div className="flex gap-6">
                    {/* Photo placeholder */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-200 rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-center">
                          <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                          </svg>
                          <span className="text-xs text-blue-500 font-medium">Ảnh</span>
                        </div>
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
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Chưa có thông tin</h3>
                    <p className="text-gray-500 mb-4">Chọn một quân nhân từ danh sách bên dưới để xem thông tin chi tiết</p>
                    <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Hướng dẫn sử dụng
                    </div>
        </div>
      )}
              </div>
            </div>
          </div>

          {/* Right Column - Clock and Photo */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 text-center h-full flex flex-col">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 012 0v4m0 0V3a1 1 0 012 0v4m0 0a3 3 0 11-6 0m6 0a3 3 0 11-6 0m6 0H9a3 3 0 000 6h6a3 3 0 000-6H9z" />
                  </svg>
                </div>
                <div className="text-lg font-medium text-gray-700">{formatCurrentDate(currentTime)}</div>
          </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-6">
                <div className="text-4xl font-bold text-gray-800 font-mono tracking-wider">
                  {formatClock(currentTime)}
                </div>
                <div className="text-sm text-blue-600 font-medium mt-1">Thời gian hiện tại</div>
          </div>

              <div className="flex-1 flex items-center justify-center min-h-0 px-4">
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 border-2 border-gray-200 rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200 min-h-48">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                    </svg>
                    <span className="text-sm text-gray-500 font-medium">Camera</span>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>

        {/* Personnel Queue Section - Full Width */}
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Thứ tự quân nhân ra vào</h2>
              <p className="text-sm text-gray-500">Nhấp vào thẻ để xem thông tin chi tiết</p>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <div className="flex gap-8 pb-4 min-w-max">
              {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className={`flex-shrink-0 w-48 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  selectedLog?.id === log.id 
                    ? 'bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-400 shadow-lg' 
                    : 'bg-gradient-to-br from-gray-50 to-white border border-gray-200 hover:shadow-md hover:border-blue-300'
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className={`w-24 h-32 rounded-lg mx-auto mb-4 flex items-center justify-center transition-all duration-200 ${
                  selectedLog?.id === log.id 
                    ? 'bg-gradient-to-br from-blue-200 to-blue-100 border-2 border-blue-300' 
                    : 'bg-gradient-to-br from-gray-200 to-gray-100 border border-gray-300'
                }`} style={{ aspectRatio: '3/4' }}>
                  <div className="text-center">
                    <svg className={`w-10 h-10 mx-auto mb-2 ${
                      selectedLog?.id === log.id ? 'text-blue-500' : 'text-gray-400'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                    </svg>
                    <div className={`w-2 h-2 rounded-full mx-auto ${
                      log.type === 'entry' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                  </div>
                </div>
                <div className="text-lg font-medium text-gray-700 mb-2 truncate" title={log.driverName || 'Lê Văn B'}>
                  {log.driverName || 'Lê Văn B'}
                </div>
                <div className="text-base text-gray-500 mb-3 truncate" title={log.employeeName || 'Tiểu đoàn 8'}>
                  {log.employeeName || 'Tiểu đoàn 8'}
                </div>
                <div className="mt-3">
                  <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                    log.type === 'entry' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {log.type === 'entry' ? 'Vào' : 'Ra'}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Add some placeholder cards if no logs */}
            {filteredLogs.length === 0 && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-shrink-0 w-48 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-8 text-center hover:shadow-md transition-shadow duration-200">
                    <div className="w-24 h-32 bg-gradient-to-br from-gray-200 to-gray-100 border border-gray-300 rounded-lg mx-auto mb-4 flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
                      <div className="text-center">
                        <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
                        </svg>
                        <div className="w-2 h-2 bg-gray-300 rounded-full mx-auto"></div>
                      </div>
                    </div>
                    <div className="text-lg font-medium text-gray-700 mb-2">Lê Văn B</div>
                    <div className="text-base text-gray-500 mb-3">Tiểu đoàn 8</div>
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                        Chờ
                      </span>
                    </div>
                    </div>
                ))}
              </>
            )}
            </div>
          </div>
          
              {filteredLogs.length === 0 && (
            <div className="text-center mt-8 py-8 border-t border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg mb-2">Hệ thống đang hoạt động bình thường</p>
              <p className="text-gray-400 text-sm">Dữ liệu sẽ được cập nhật tự động mỗi 30 giây</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
