"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Building2, UserCheck, Clock, UserX, Calendar } from "lucide-react"
import type { Employee, Department } from "@/lib/types"

interface StatisticsDashboardProps {
  employees: Employee[]
  departments: Department[]
}

export function StatisticsDashboard({ employees, departments }: StatisticsDashboardProps) {
  const activeEmployees = employees.filter((emp) => emp.status === "HOAT_DONG").length
  const tranhThuEmployees = employees.filter((emp) => emp.status === "TRANH_THU").length
  const phepEmployees = employees.filter((emp) => emp.status === "PHEP").length
  const lyDoKhacEmployees = employees.filter((emp) => emp.status === "LY_DO_KHAC").length
  const totalDepartments = departments.length

  const departmentStats = departments
    .map((dept) => ({
      name: dept.name,
      employeeCount: employees.filter((emp) => emp.department === dept.name).length,
      activeCount: employees.filter((emp) => emp.department === dept.name && emp.status === "HOAT_DONG").length,
    }))
    .sort((a, b) => b.employeeCount - a.employeeCount)

  const accessLevelStats = {
    general: employees.filter((emp) => emp.accessLevel === "general").length,
    restricted: employees.filter((emp) => emp.accessLevel === "restricted").length,
    admin: employees.filter((emp) => emp.accessLevel === "admin").length,
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nhân viên</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeEmployees} hoạt động, {tranhThuEmployees} tranh thủ, {phepEmployees} phép, {lyDoKhacEmployees} lý do khác
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nhân viên hoạt động</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {((activeEmployees / employees.length) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tranh thủ</CardTitle>
            <UserX className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{tranhThuEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {((tranhThuEmployees / employees.length) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phép</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{phepEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {((phepEmployees / employees.length) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng Cơ quan, đơn vị</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepartments}</div>
            <p className="text-xs text-muted-foreground">Cơ quan, đơn vị đang hoạt động</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lý do Khác</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lyDoKhacEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {((lyDoKhacEmployees / employees.length) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê theo Cơ quan, đơn vị</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentStats.slice(0, 10).map((dept, index) => (
              <div key={dept.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8">{index + 1}.</span>
                  <span className="text-sm">{dept.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{dept.employeeCount} nhân viên</Badge>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {dept.activeCount} hoạt động
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Access Level Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê phân quyền</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{accessLevelStats.general}</div>
              <p className="text-sm text-muted-foreground">Quyền cơ bản</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{accessLevelStats.restricted}</div>
              <p className="text-sm text-muted-foreground">Quyền hạn chế</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{accessLevelStats.admin}</div>
              <p className="text-sm text-muted-foreground">Quyền quản trị</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
