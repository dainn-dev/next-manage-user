"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Users, UserCheck, UserX, UserMinus, TrendingUp, Calendar, Building } from "lucide-react"
import { employeeApi, EmployeeStatistics } from "@/lib/api/employee-api"
import { useToast } from "@/hooks/use-toast"

interface EmployeeStatisticsDashboardProps {
  onRefresh?: () => void
}

export function EmployeeStatisticsDashboard({ onRefresh }: EmployeeStatisticsDashboardProps) {
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchStatistics = async () => {
    try {
      setIsLoading(true)
      const stats = await employeeApi.getEmployeeStatistics()
      setStatistics(stats)
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thống kê nhân viên",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatistics()
  }, [])

  const handleRefresh = () => {
    fetchStatistics()
    onRefresh?.()
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đang tải...</CardTitle>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!statistics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Không thể tải thống kê</p>
          <Button variant="outline" onClick={handleRefresh} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Thử lại
          </Button>
        </CardContent>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "inactive":
        return "bg-yellow-100 text-yellow-800"
      case "terminated":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Hoạt động"
      case "inactive":
        return "Không hoạt động"
      case "terminated":
        return "Đã nghỉ việc"
      default:
        return status
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Thống kê nhân viên</h2>
          <p className="text-gray-600">Tổng quan về tình hình nhân viên trong hệ thống</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nhân viên</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalEmployees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{statistics.newEmployeesThisMonth} tháng này
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đang hoạt động</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics.activeEmployees.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((statistics.activeEmployees / statistics.totalEmployees) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Không hoạt động</CardTitle>
            <UserX className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statistics.inactiveEmployees.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((statistics.inactiveEmployees / statistics.totalEmployees) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã nghỉ việc</CardTitle>
            <UserMinus className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics.terminatedEmployees.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((statistics.terminatedEmployees / statistics.totalEmployees) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Employees by Department */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Nhân viên theo phòng ban
            </CardTitle>
            <CardDescription>
              Phân bố nhân viên theo các phòng ban
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statistics.employeesByDepartment).map(([department, count]) => (
                <div key={department} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium">{department}</span>
                  </div>
                  <Badge variant="secondary">{count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Employees by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Nhân viên theo trạng thái
            </CardTitle>
            <CardDescription>
              Phân bố nhân viên theo trạng thái hiện tại
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statistics.employeesByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      status === 'active' ? 'bg-green-500' :
                      status === 'inactive' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                  </div>
                  <Badge variant="secondary">{count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tuổi trung bình</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.averageAge.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">tuổi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nhân viên mới tháng này</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.newEmployeesThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">người</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nhân viên mới năm nay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.newEmployeesThisYear.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">người</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
