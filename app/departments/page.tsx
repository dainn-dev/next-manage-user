"use client"

import { useState, useEffect } from "react"
import type { Department, Employee } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"
import { DepartmentTable } from "@/components/departments/department-table"
import { DepartmentForm } from "@/components/departments/department-form"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Building2, TrendingUp } from "lucide-react"

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<Department | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedDepartmentForView, setSelectedDepartmentForView] = useState<Department | null>(null)
  const [showEmployeeList, setShowEmployeeList] = useState(false)
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
      
      const [departmentsData, employeesData] = await Promise.all([
        dataService.getDepartments(),
        dataService.getEmployees()
      ])
      
      setDepartments(departmentsData)
      setEmployees(employeesData)
      
      // Auto-select first department to show its employees
      if (departmentsData.length > 0) {
        setSelectedDepartmentForView(departmentsData[0])
        setShowEmployeeList(true)
      }
      
      toast({
        title: "Thành công",
        description: `Đã tải ${departmentsData.length} đơn vị và ${employeesData.length} nhân viên`,
      })
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Không thể tải dữ liệu đơn vị')
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu đơn vị",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department)
    setIsFormOpen(true)
  }

  const handleDelete = async (departmentId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa bộ phận này?")) {
      try {
        const success = await dataService.deleteDepartment(departmentId)
        if (success) {
          toast({
            title: "Thành công",
            description: "Đơn vị đã được xóa thành công",
          })
          await loadData() // Reload all data
        }
      } catch (error) {
        console.error('Error deleting department:', error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa đơn vị. Có thể đơn vị đang có nhân viên hoặc đơn vị con.",
          variant: "destructive",
        })
      }
    }
  }

  const handleSave = async (departmentData: Omit<Department, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (selectedDepartment) {
        const updatedDepartment = await dataService.updateDepartment(selectedDepartment.id, departmentData)
        if (updatedDepartment) {
          toast({
            title: "Thành công",
            description: "Đơn vị đã được cập nhật thành công",
          })
        }
      } else {
        const newDepartment = await dataService.createDepartment(departmentData)
        toast({
          title: "Thành công",
          description: "Đơn vị mới đã được tạo thành công",
        })
      }
      await loadData() // Reload all data
      setIsFormOpen(false)
      setSelectedDepartment(undefined)
    } catch (error) {
      console.error('Error saving department:', error)
      toast({
        title: "Lỗi",
        description: selectedDepartment ? "Không thể cập nhật đơn vị" : "Không thể tạo đơn vị mới",
        variant: "destructive",
      })
    }
  }

  const handleAddNew = () => {
    setSelectedDepartment(undefined)
    setIsFormOpen(true)
  }

  const handleViewEmployees = (department: Department) => {
    setSelectedDepartmentForView(department)
    setShowEmployeeList(true)
  }

  const getStatusBadge = (status: Employee["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Hoạt động</Badge>
      case "inactive":
        return <Badge variant="secondary">Không hoạt động</Badge>
      case "terminated":
        return <Badge variant="destructive">Đã nghỉ việc</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDepartmentStatistics = () => {
    const total = departments.length
    const totalEmployees = departments.reduce((sum, dept) => sum + dept.employeeCount, 0)
    const avgEmployeesPerDept = total > 0 ? Math.round(totalEmployees / total) : 0
    const largestDept = departments.reduce((max, dept) => dept.employeeCount > max.employeeCount ? dept : max, departments[0] || { employeeCount: 0 })

    return { total, totalEmployees, avgEmployeesPerDept, largestDept }
  }

  const stats = getDepartmentStatistics()

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu đơn vị...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-background min-h-screen">
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

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý Cơ quan, Đơn vị</h1>
          <p className="text-muted-foreground text-lg">Quản lý cơ cấu tổ chức và nhân sự các đơn vị</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm đơn vị
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng đơn vị</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Cơ quan, đơn vị
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nhân viên</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Nhân viên toàn đơn vị
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TB mỗi đơn vị</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgEmployeesPerDept}</div>
            <p className="text-xs text-muted-foreground">
              Nhân viên/đơn vị
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đơn vị lớn nhất</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.largestDept?.employeeCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.largestDept?.name || "Chưa có"}
            </p>
          </CardContent>
        </Card>
      </div>

      <DepartmentTable 
        departments={departments} 
        employees={employees}
        selectedDepartmentForView={selectedDepartmentForView}
        showEmployeeList={showEmployeeList}
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onAddNew={handleAddNew}
        onViewEmployees={handleViewEmployees}
        onBackToDepartments={() => setShowEmployeeList(false)}
      />

      <DepartmentForm
        department={selectedDepartment}
        departments={departments}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedDepartment(undefined)
        }}
        onSave={handleSave}
      />

    </div>
  )
}