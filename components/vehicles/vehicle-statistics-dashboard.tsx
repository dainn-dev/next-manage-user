"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Car, 
  Truck, 
  Bus, 
  Bike, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import type { VehicleStatistics, VehicleDailyStats, VehicleWeeklyStats, VehicleMonthlyStats } from "@/lib/types"

interface VehicleStatisticsDashboardProps {
  statistics: VehicleStatistics
}

type TimeFilter = "day" | "week" | "month"

export function VehicleStatisticsDashboard({ statistics }: VehicleStatisticsDashboardProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("day")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")

  const filteredData = useMemo(() => {
    switch (timeFilter) {
      case "day":
        return statistics.dailyStats
      case "week":
        return statistics.weeklyStats
      case "month":
        return statistics.monthlyStats
      default:
        return statistics.dailyStats
    }
  }, [timeFilter, statistics])

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case "car":
        return <Car className="h-4 w-4" />
      case "motorbike":
        return <Bike className="h-4 w-4" />
      case "truck":
        return <Truck className="h-4 w-4" />
      case "bus":
        return <Bus className="h-4 w-4" />
      default:
        return <Car className="h-4 w-4" />
    }
  }

  const getVehicleTypeLabel = (type: string) => {
    const labels = {
      car: "Ô tô",
      motorbike: "Xe máy",
      truck: "Xe tải",
      bus: "Xe bus"
    }
    return labels[type as keyof typeof labels] || type
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN")
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Time Filter Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Bộ lọc thời gian:</span>
        </div>
        <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Theo ngày</SelectItem>
            <SelectItem value="week">Theo tuần</SelectItem>
            <SelectItem value="month">Theo tháng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng xe</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.activeVehicles} hoạt động, {statistics.inactiveVehicles + statistics.maintenanceVehicles} không hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Xe hoạt động</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.activeVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {((statistics.activeVehicles / statistics.totalVehicles) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bảo trì</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{statistics.maintenanceVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {((statistics.maintenanceVehicles / statistics.totalVehicles) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Type Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Thống kê theo loại xe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statistics.vehicleTypeStats).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getVehicleTypeIcon(type)}
                    <span className="text-sm font-medium">{getVehicleTypeLabel(type)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{count} xe</Badge>
                    <span className="text-xs text-muted-foreground">
                      {((count / statistics.totalVehicles) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Entry/Exit Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê yêu cầu ra vào</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getStatusIcon("approved")}
                <span className="text-sm font-medium">Đã duyệt</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{statistics.entryExitStats.approvedRequests}</div>
              <p className="text-xs text-muted-foreground">
                {((statistics.entryExitStats.approvedRequests / statistics.entryExitStats.totalRequests) * 100).toFixed(1)}% tổng yêu cầu
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getStatusIcon("pending")}
                <span className="text-sm font-medium">Chờ duyệt</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{statistics.entryExitStats.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">
                {((statistics.entryExitStats.pendingRequests / statistics.entryExitStats.totalRequests) * 100).toFixed(1)}% tổng yêu cầu
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Yêu cầu vào</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{statistics.entryExitStats.entryRequests}</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Yêu cầu ra</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{statistics.entryExitStats.exitRequests}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time-based Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>
            Thống kê theo {timeFilter === "day" ? "ngày" : timeFilter === "week" ? "tuần" : "tháng"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="details">Chi tiết</TabsTrigger>
              <TabsTrigger value="trends">Xu hướng</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredData.reduce((sum, item) => sum + item.totalRequests, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Tổng yêu cầu</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredData.reduce((sum, item) => sum + item.approvedCount, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Đã duyệt</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {filteredData.reduce((sum, item) => sum + item.pendingCount, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Chờ duyệt</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(filteredData.reduce((sum, item) => sum + item.uniqueVehicles, 0) / filteredData.length) || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Xe trung bình</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="space-y-4">
                {filteredData.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium">
                        {timeFilter === "day" && formatDate((item as VehicleDailyStats).date)}
                        {timeFilter === "week" && `${(item as VehicleWeeklyStats).week} (${formatDate((item as VehicleWeeklyStats).startDate)} - ${formatDate((item as VehicleWeeklyStats).endDate)})`}
                        {timeFilter === "month" && `${(item as VehicleMonthlyStats).month} ${(item as VehicleMonthlyStats).year}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{item.totalRequests} yêu cầu</Badge>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {item.approvedCount} duyệt
                      </Badge>
                      <Badge variant="secondary">{item.pendingCount} chờ</Badge>
                      <span className="text-sm text-muted-foreground">
                        {item.uniqueVehicles} xe
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Xu hướng yêu cầu vào</h4>
                  <div className="space-y-2">
                    {filteredData.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {timeFilter === "day" && formatDate((item as VehicleDailyStats).date)}
                          {timeFilter === "week" && (item as VehicleWeeklyStats).week}
                          {timeFilter === "month" && `${(item as VehicleMonthlyStats).month} ${(item as VehicleMonthlyStats).year}`}
                        </span>
                        <span className="font-medium">{item.entryCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Xu hướng yêu cầu ra</h4>
                  <div className="space-y-2">
                    {filteredData.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {timeFilter === "day" && formatDate((item as VehicleDailyStats).date)}
                          {timeFilter === "week" && (item as VehicleWeeklyStats).week}
                          {timeFilter === "month" && `${(item as VehicleMonthlyStats).month} ${(item as VehicleMonthlyStats).year}`}
                        </span>
                        <span className="font-medium">{item.exitCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
