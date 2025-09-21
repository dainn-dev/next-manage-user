"use client"

import { useState, useEffect } from "react"
import type { Employee, Department, VehicleStatistics, User, Position, UserStatistics } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { userApi } from "@/lib/api/user-api"
import { positionApi, type PositionStatistics } from "@/lib/api/position-api"
import { StatisticsDashboard } from "@/components/reports/statistics-dashboard"
import { VehicleStatisticsDashboard } from "@/components/vehicles/vehicle-statistics-dashboard"
import { ExportDialog } from "@/components/reports/export-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, RefreshCw, Users, Building2, Car, Shield, TrendingUp, Activity, UserCheck, Building, Briefcase } from "lucide-react"
import { exportStatisticsToExcel } from "@/lib/utils/excel-export"
import { useToast } from "@/hooks/use-toast"

export default function StatisticsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [vehicleStatistics, setVehicleStatistics] = useState<VehicleStatistics | null>(null)
  const [userStatistics, setUserStatistics] = useState<UserStatistics | null>(null)
  const [positionStatistics, setPositionStatistics] = useState<PositionStatistics | null>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [employeesData, departmentsData, usersData, positionsData, vehiclesData, vehicleStats, userStats, positionStats] = await Promise.all([
        dataService.getEmployees(),
        Promise.resolve(dataService.getDepartments()),
        userApi.getAllUsersList().catch(() => []),
        positionApi.getAllPositionsList().then(positions => positions.map(p => positionApi.convertToPosition(p))).catch(() => []),
        dataService.getVehicles(0, 1000).then(response => response.vehicles).catch(() => []),
        dataService.getVehicleStatistics(),
        userApi.getUserStatistics().catch(() => null),
        positionApi.getPositionStatistics().catch(() => null)
      ])
      setEmployees(employeesData)
      setDepartments(departmentsData)
      setUsers(usersData)
      setPositions(positionsData)
      setVehicles(vehiclesData)
      setVehicleStatistics(vehicleStats)
      setUserStatistics(userStats)
      setPositionStatistics(positionStats)
    } catch (err) {
      setError('Không thể tải dữ liệu thống kê')
      console.error('Error loading statistics data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (options: any) => {
    try {
      const filename = `bao_cao_thong_ke_${new Date().toISOString().split('T')[0]}`
      
      // Prepare data for export
      const exportData = {
        employees,
        vehicles,
        departments,
        users,
        positions,
        vehicleStats: vehicleStatistics,
        userStats: userStatistics,
        positionStats: positionStatistics
      }
      
      const success = exportStatisticsToExcel(exportData, filename)
      
      if (success) {
        toast({
          title: "Xuất báo cáo thành công",
          description: "Đã xuất báo cáo thống kê tổng quan ra file CSV (có thể mở bằng Excel)",
          variant: "default",
        })
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Lỗi xuất báo cáo",
        description: "Có lỗi xảy ra khi xuất báo cáo. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const handleRefresh = () => {
    loadData()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu thống kê...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <div>
              <p className="text-red-600 font-medium">{error}</p>
              <button 
                onClick={() => loadData()}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate overall system stats with safety checks
  const safeEmployees = employees || []
  const safeUsers = users || []
  const safeDepartments = departments || []
  const safePositions = positions || []
  
  const totalSystemUsers = safeEmployees.length + safeUsers.length
  const totalSystemEntities = safeEmployees.length + safeUsers.length + (vehicleStatistics?.totalVehicles || 0) + safeDepartments.length + safePositions.length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Thống kê tổng quan hệ thống</h1>
          <p className="text-muted-foreground">Tổng quan toàn bộ dữ liệu và hoạt động trong hệ thống</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button onClick={() => setIsExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thực thể</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSystemEntities.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Tất cả dữ liệu trong hệ thống
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng người dùng</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalSystemUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {safeEmployees.length} quân nhân + {safeUsers.length} tài khoản
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng phương tiện</CardTitle>
            <Car className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vehicleStatistics?.totalVehicles?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Phương tiện được quản lý
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cơ cấu tổ chức</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {(safeDepartments.length + safePositions.length).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {safeDepartments.length} đơn vị + {safePositions.length} chức vụ
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="employees">Quân nhân</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
          <TabsTrigger value="positions">Chức vụ</TabsTrigger>
          <TabsTrigger value="vehicles">Phương tiện</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Health Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tình trạng hệ thống
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quân nhân hoạt động</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {safeEmployees.filter(e => e.status === 'HOAT_DONG').length} / {safeEmployees.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Người dùng hoạt động</span>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    {userStatistics?.activeUsers || 0} / {userStatistics?.totalUsers || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Phương tiện được duyệt</span>
                  <Badge variant="default" className="bg-purple-100 text-purple-800">
                    {vehicleStatistics?.activeVehicles || 0} / {vehicleStatistics?.totalVehicles || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Chức vụ hoạt động</span>
                  <Badge variant="default" className="bg-orange-100 text-orange-800">
                    {positionStatistics?.activePositions || 0} / {positionStatistics?.totalPositions || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Access Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Phân quyền & Bảo mật
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quản trị viên</span>
                  <Badge variant="destructive">
                    {safeEmployees.filter(e => e.accessLevel === 'admin').length + (userStatistics?.adminUsers || 0)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quyền hạn chế</span>
                  <Badge variant="secondary">
                    {safeEmployees.filter(e => e.accessLevel === 'restricted').length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quyền cơ bản</span>
                  <Badge variant="outline">
                    {safeEmployees.filter(e => e.accessLevel === 'general').length + (userStatistics?.regularUsers || 0)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tài khoản bị khóa</span>
                  <Badge variant="destructive">
                    {userStatistics?.lockedUsers || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time-based Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Hoạt động hôm nay</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quân nhân mới</span>
                    <span className="text-sm font-medium">
                      {safeEmployees.filter(e => {
                        const today = new Date().toDateString()
                        return new Date(e.createdAt).toDateString() === today
                      }).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Phương tiện mới</span>
                    <span className="text-sm font-medium">
                      {vehicleStatistics?.dailyStats?.[0]?.totalRequests || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ra/vào hôm nay</span>
                    <span className="text-sm font-medium">
                      {(vehicleStatistics?.dailyStats?.[0]?.entryCount || 0) + (vehicleStatistics?.dailyStats?.[0]?.exitCount || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tuần này</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quân nhân mới</span>
                    <span className="text-sm font-medium">
                      {safeEmployees.filter(e => {
                        const weekAgo = new Date()
                        weekAgo.setDate(weekAgo.getDate() - 7)
                        return new Date(e.createdAt) >= weekAgo
                      }).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Yêu cầu xe</span>
                    <span className="text-sm font-medium">
                      {vehicleStatistics?.weeklyStats?.[0]?.totalRequests || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Trung bình/ngày</span>
                    <span className="text-sm font-medium">
                      {vehicleStatistics?.weeklyStats?.[0]?.averageDailyRequests?.toFixed(1) || '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tháng này</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quân nhân mới</span>
                    <span className="text-sm font-medium">
                      {safeEmployees.filter(e => {
                        const monthAgo = new Date()
                        monthAgo.setMonth(monthAgo.getMonth() - 1)
                        return new Date(e.createdAt) >= monthAgo
                      }).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Xe ra/vào</span>
                    <span className="text-sm font-medium">
                      {(vehicleStatistics?.monthlyStats?.[0]?.entryCount || 0) + (vehicleStatistics?.monthlyStats?.[0]?.exitCount || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ngày cao điểm</span>
                    <span className="text-sm font-medium">
                      {vehicleStatistics?.monthlyStats?.[0]?.peakDay?.requestCount || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department & Position Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Đơn vị theo số lượng</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeDepartments
                    .map(dept => ({
                      name: dept.name,
                      count: safeEmployees.filter(e => e.department === dept.name).length
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((dept, index) => (
                      <div key={dept.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium w-4">{index + 1}.</span>
                          <span className="text-sm">{dept.name}</span>
                        </div>
                        <Badge variant="secondary">{dept.count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phương tiện theo loại</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicleStatistics?.vehicleTypeStats && Object.entries(vehicleStatistics.vehicleTypeStats).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {type === 'car' ? 'Ô tô' : 
                         type === 'motorbike' ? 'Xe máy' : 
                         type === 'truck' ? 'Xe tải' : 
                         type === 'bus' ? 'Xe buýt' : type}
                      </span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <StatisticsDashboard employees={safeEmployees} departments={safeDepartments} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {userStatistics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng tài khoản</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userStatistics.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">Tất cả tài khoản</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Đang hoạt động</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{userStatistics.activeUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {((userStatistics.activeUsers / userStatistics.totalUsers) * 100).toFixed(1)}% tổng số
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Quản trị viên</CardTitle>
                    <Shield className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{userStatistics.adminUsers}</div>
                    <p className="text-xs text-muted-foreground">Quyền cao nhất</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bị khóa</CardTitle>
                    <Shield className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{userStatistics.lockedUsers}</div>
                    <p className="text-xs text-muted-foreground">Tài khoản bị khóa</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Phân bố theo vai trò</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userStatistics?.usersByRole && Object.entries(userStatistics.usersByRole).map(([role, count]) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Phân bố theo trạng thái</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userStatistics?.usersByStatus && Object.entries(userStatistics.usersByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {status === 'ACTIVE' ? 'Hoạt động' : 
                             status === 'INACTIVE' ? 'Không hoạt động' : 
                             status === 'LOCKED' ? 'Bị khóa' : 'Tạm ngừng'}
                          </span>
                          <Badge variant={status === 'ACTIVE' ? 'default' : status === 'LOCKED' ? 'destructive' : 'secondary'}>
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Không thể tải thống kê người dùng</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="positions" className="space-y-6">
          {positionStatistics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng chức vụ</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{positionStatistics.totalPositions}</div>
                    <p className="text-xs text-muted-foreground">Tất cả chức vụ</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Đang hoạt động</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{positionStatistics.activePositions}</div>
                    <p className="text-xs text-muted-foreground">
                      {((positionStatistics.activePositions / positionStatistics.totalPositions) * 100).toFixed(1)}% tổng số
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Chức vụ gốc</CardTitle>
                    <Building className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{positionStatistics.rootPositions}</div>
                    <p className="text-xs text-muted-foreground">Cấp cao nhất</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Không hoạt động</CardTitle>
                    <Building className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{positionStatistics.inactivePositions}</div>
                    <p className="text-xs text-muted-foreground">Tạm ngừng</p>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Phân bố theo cấp bậc</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {positionStatistics?.positionsByLevel && Object.entries(positionStatistics.positionsByLevel).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{level}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Không thể tải thống kê chức vụ</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          {vehicleStatistics && (
            <VehicleStatisticsDashboard statistics={vehicleStatistics} />
          )}
        </TabsContent>
      </Tabs>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} onExport={handleExport} />
    </div>
  )
}
