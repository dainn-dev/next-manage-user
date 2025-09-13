"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Building2, UserCheck, Clock } from "lucide-react"
import type { Employee, Department } from "@/lib/types"

interface StatisticsDashboardProps {
  employees: Employee[]
  departments: Department[]
}

export function StatisticsDashboard({ employees, departments }: StatisticsDashboardProps) {
  const activeEmployees = employees.filter((emp) => emp.status === "active").length
  const inactiveEmployees = employees.filter((emp) => emp.status === "inactive").length
  const terminatedEmployees = employees.filter((emp) => emp.status === "terminated").length
  const totalDepartments = departments.length

  const departmentStats = departments
    .map((dept) => ({
      name: dept.name,
      employeeCount: employees.filter((emp) => emp.department === dept.name).length,
      activeCount: employees.filter((emp) => emp.department === dept.name && emp.status === "active").length,
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
              {activeEmployees} hoạt động, {inactiveEmployees + terminatedEmployees} không hoạt động
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
            <CardTitle className="text-sm font-medium">Tổng phòng ban</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepartments}</div>
            <p className="text-xs text-muted-foreground">Phòng ban đang hoạt động</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nghỉ việc</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{terminatedEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {((terminatedEmployees / employees.length) * 100).toFixed(1)}% tổng số
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Thống kê theo phòng ban</CardTitle>
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
