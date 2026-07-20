"use client"

import { useEffect, useState } from "react"
import type { Department, Employee } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { DepartmentTable } from "@/components/departments/department-table"
import { DepartmentForm } from "@/components/departments/department-form"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Building2, Loader2, Plus, RefreshCw, TrendingUp, Users } from "lucide-react"

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
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [departmentsData, employeesData] = await Promise.all([
        dataService.getDepartments(),
        dataService.getEmployees(),
      ])

      setDepartments(departmentsData)
      setEmployees(employeesData)

      if (departmentsData.length > 0) {
        setSelectedDepartmentForView(departmentsData[0])
        setShowEmployeeList(true)
      }

      toast({
        title: "Thành công",
        description: `Đã tải ${departmentsData.length} đơn vị và ${employeesData.length} nhân viên`,
      })
    } catch (error) {
      console.error("Error loading data:", error)
      setError("Không thể tải dữ liệu đơn vị")
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
          toast({ title: "Thành công", description: "Đơn vị đã được xóa thành công" })
          await loadData()
        }
      } catch (error) {
        console.error("Error deleting department:", error)
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
          toast({ title: "Thành công", description: "Đơn vị đã được cập nhật thành công" })
        }
      } else {
        await dataService.createDepartment(departmentData)
        toast({ title: "Thành công", description: "Đơn vị mới đã được tạo thành công" })
      }
      await loadData()
      setIsFormOpen(false)
      setSelectedDepartment(undefined)
    } catch (error) {
      console.error("Error saving department:", error)
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

  const stats = (() => {
    const total = departments.length
    const totalEmployees = departments.reduce((sum, department) => sum + department.employeeCount, 0)
    const avgEmployeesPerDept = total > 0 ? Math.round(totalEmployees / total) : 0
    const largestDept = departments.reduce(
      (largest, department) => department.employeeCount > largest.employeeCount ? department : largest,
      departments[0] || { employeeCount: 0 },
    )
    return { total, totalEmployees, avgEmployeesPerDept, largestDept }
  })()

  if (loading) {
    return (
      <AdminPage>
        <Card className="min-h-64 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu đơn vị.</p>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  if (error) {
    return (
      <AdminPage>
        <Card className="min-h-64 justify-center border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  const metricCards = [
    { label: "Tổng đơn vị", value: stats.total, description: "Cơ quan và đơn vị", icon: Building2 },
    { label: "Tổng nhân viên", value: stats.totalEmployees, description: "Nhân viên toàn đơn vị", icon: Users },
    { label: "Trung bình mỗi đơn vị", value: stats.avgEmployeesPerDept, description: "Nhân viên trên một đơn vị", icon: TrendingUp },
    {
      label: "Đơn vị lớn nhất",
      value: stats.largestDept?.employeeCount || 0,
      description: stats.largestDept?.name || "Chưa có đơn vị",
      icon: Building2,
    },
  ]

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị nhân sự"
        title="Cơ quan và đơn vị"
        description="Quản lý cơ cấu tổ chức, đơn vị trực thuộc và nhân sự của từng đơn vị."
        actions={
          <Button onClick={handleAddNew}>
            <Plus />
            Thêm đơn vị
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan đơn vị">
        {metricCards.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-sm">{item.label}</CardTitle>
                  <CardDescription className="mt-1">{item.description}</CardDescription>
                </div>
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách đơn vị</CardTitle>
          <CardDescription>Chọn một đơn vị để xem nhân sự và quản lý thông tin liên quan.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
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
        </CardContent>
      </Card>

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
    </AdminPage>
  )
}
