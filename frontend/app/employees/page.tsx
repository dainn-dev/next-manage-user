"use client"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Department, Employee } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { EmployeeForm } from "@/components/employees/employee-form"
import { EmployeeTable } from "@/components/employees/employee-table"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { exportEmployeesToExcel } from "@/lib/utils/excel-export"
import {
  Briefcase,
  Crown,
  Download,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"

function EmployeesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>()
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "HOAT_DONG" | "TRANH_THU" | "PHEP" | "LY_DO_KHAC">("all")
  const [departmentFilter, setDepartmentFilter] = useState<"all" | string>("all")
  const [rankFilter, setRankFilter] = useState<"all" | string>("all")
  const [positionFilter, setPositionFilter] = useState<"all" | string>("all")
  const [militaryCivilianFilter, setMilitaryCivilianFilter] = useState<"all" | string>("all")
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const positionParam = searchParams.get("position")
    const positionIdParam = searchParams.get("positionId")
    const departmentParam = searchParams.get("department")

    if (positionParam) setPositionFilter(positionParam)
    if (positionIdParam) console.log("Position ID from URL:", positionIdParam)
    if (departmentParam) setDepartmentFilter(departmentParam)
  }, [searchParams])

  useEffect(() => {
    filterEmployees()
  }, [employees, searchTerm, statusFilter, departmentFilter, rankFilter, positionFilter, militaryCivilianFilter, searchParams])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const { employeeApi } = await import("@/lib/api/employee-api")
      const employeesData = await employeeApi.getAllEmployeesList()
      const departmentsData = await Promise.resolve(dataService.getDepartments())
      setEmployees(employeesData)
      setDepartments(departmentsData)
    } catch (err) {
      setError("Không thể tải dữ liệu nhân viên")
      console.error("Error loading employees data:", err)
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu nhân viên", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filterEmployees = () => {
    let filtered = [...employees]
    const positionParam = searchParams.get("position")
    const positionIdParam = searchParams.get("positionId")
    const departmentParam = searchParams.get("department")

    if (positionParam) {
      filtered = filtered.filter((employee) => employee.position === positionParam || employee.jobTitle === positionParam)
    }

    if (positionIdParam) {
      filtered = filtered.filter((employee) => employee.positionId === positionIdParam)
    }

    if (departmentParam) {
      filtered = filtered.filter((employee) => employee.department === departmentParam)
    }

    if (searchTerm) {
      filtered = filtered.filter((employee) =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.position.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") filtered = filtered.filter((employee) => employee.status === statusFilter)
    if (departmentFilter !== "all") filtered = filtered.filter((employee) => employee.department === departmentFilter)
    if (rankFilter !== "all") filtered = filtered.filter((employee) => employee.rank === rankFilter)
    if (positionFilter !== "all") filtered = filtered.filter((employee) => employee.position === positionFilter)
    if (militaryCivilianFilter !== "all") {
      filtered = filtered.filter((employee) => employee.militaryCivilian === militaryCivilianFilter)
    }

    setFilteredEmployees(filtered)
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleDelete = async (employeeId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) {
      try {
        const { employeeApi } = await import("@/lib/api/employee-api")
        await employeeApi.deleteEmployee(employeeId)
        await loadData()
      } catch (err) {
        setError("Không thể xóa nhân viên")
        console.error("Error deleting employee:", err)
      }
    }
  }

  const handleSave = async (employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">): Promise<Employee> => {
    try {
      const { employeeApi } = await import("@/lib/api/employee-api")
      const apiEmployeeData = {
        employeeId: employeeData.employeeId,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone,
        department: employeeData.department,
        position: employeeData.position,
        positionId: employeeData.positionId,
        hireDate: employeeData.hireDate,
        birthDate: employeeData.birthDate,
        gender: employeeData.gender,
        address: employeeData.address,
        emergencyContact: employeeData.emergencyContact,
        emergencyPhone: employeeData.emergencyPhone,
        salary: employeeData.salary,
        status: employeeData.status,
        accessLevel: employeeData.accessLevel,
        permissions: employeeData.permissions,
        avatar: employeeData.avatar,
        rank: employeeData.rank,
        jobTitle: employeeData.jobTitle,
        militaryCivilian: employeeData.militaryCivilian,
        vehicleType: employeeData.vehicleType,
      }

      let savedEmployee: Employee
      if (selectedEmployee) {
        savedEmployee = await employeeApi.updateEmployee(selectedEmployee.id, apiEmployeeData)
        toast({
          variant: "success",
          title: "Cập nhật thành công",
          description: "Thông tin nhân viên đã được cập nhật thành công.",
        })
      } else {
        savedEmployee = await employeeApi.createEmployee(apiEmployeeData)
        toast({
          variant: "success",
          title: "Tạo mới thành công",
          description: "Nhân viên mới đã được thêm vào hệ thống.",
        })
      }

      await loadData()
      setIsFormOpen(false)
      setSelectedEmployee(undefined)
      return savedEmployee
    } catch (err) {
      setError("Không thể lưu nhân viên")
      console.error("Error saving employee:", err)
      toast({
        variant: "destructive",
        title: "Lỗi lưu thông tin",
        description: selectedEmployee
          ? "Không thể cập nhật thông tin nhân viên. Vui lòng thử lại sau."
          : "Không thể tạo mới nhân viên. Vui lòng thử lại sau.",
      })
      throw err
    }
  }

  const handleAddNew = () => {
    setSelectedEmployee(undefined)
    setIsFormOpen(true)
  }

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) {
      toast({ title: "Cảnh báo", description: "Vui lòng chọn ít nhất một nhân viên để xóa", variant: "destructive" })
      return
    }

    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedEmployees.length} nhân viên đã chọn?`)) {
      try {
        const { employeeApi } = await import("@/lib/api/employee-api")
        await Promise.all(selectedEmployees.map((id) => employeeApi.deleteEmployee(id)))
        setSelectedEmployees([])
        await loadData()
        toast({ title: "Thành công", description: `${selectedEmployees.length} nhân viên đã được xóa thành công!` })
      } catch (error) {
        console.error("Error bulk deleting employees:", error)
        toast({ title: "Lỗi", description: "Không thể xóa các nhân viên đã chọn", variant: "destructive" })
      }
    }
  }

  const handleExport = () => {
    try {
      const filename = `danh_sach_nhan_vien_${new Date().toISOString().split("T")[0]}`
      const success = exportEmployeesToExcel(employees, filename)
      if (success) {
        toast({
          title: "Xuất file thành công",
          description: `Đã xuất ${employees.length} nhân viên ra file CSV (có thể mở bằng Excel)`,
          variant: "default",
        })
      } else {
        throw new Error("Export failed")
      }
    } catch (error) {
      console.error("Export error:", error)
      toast({ title: "Lỗi xuất file", description: "Có lỗi xảy ra khi xuất dữ liệu. Vui lòng thử lại.", variant: "destructive" })
    }
  }

  const stats = (() => {
    const total = employees.length
    const active = employees.filter((employee) => employee.status === "HOAT_DONG").length
    const tranhThu = employees.filter((employee) => employee.status === "TRANH_THU").length
    const phep = employees.filter((employee) => employee.status === "PHEP").length
    const lyDoKhac = employees.filter((employee) => employee.status === "LY_DO_KHAC").length
    const averageAge = employees.length > 0
      ? Math.round(employees.reduce((sum, employee) => {
        if (employee.birthDate) return sum + new Date().getFullYear() - new Date(employee.birthDate).getFullYear()
        return sum
      }, 0) / employees.filter((employee) => employee.birthDate).length)
      : 0
    return { total, active, tranhThu, phep, lyDoKhac, averageAge }
  })()

  if (loading) {
    return (
      <AdminPage>
        <Card className="min-h-64 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu quân nhân.</p>
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

  const urlPosition = searchParams.get("position")
  const urlDepartment = searchParams.get("department")
  const metricCards = [
    { label: "Tổng quân nhân", value: stats.total, description: `${stats.active} đang hoạt động`, icon: Users },
    { label: "Đang hoạt động", value: stats.active, description: "Quân nhân đang làm việc", icon: UserCheck },
    {
      label: "Tỷ lệ hoạt động",
      value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%`,
      description: "Tỷ trọng quân nhân đang hoạt động",
      icon: TrendingUp,
    },
  ]

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị nhân sự"
        title="Quản lý quân nhân"
        description="Quản lý thông tin, trạng thái và phân công của quân nhân trong đơn vị."
        actions={
          <Button onClick={handleAddNew}>
            <Plus />
            Thêm quân nhân
          </Button>
        }
      />

      {(urlPosition || urlDepartment) && (
        <Card className="bg-primary-container/35">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Đang áp dụng bộ lọc từ điều hướng:</span>
              {urlPosition && <Badge variant="secondary">Chức vụ: {urlPosition}</Badge>}
              {urlDepartment && <Badge variant="secondary">Đơn vị: {urlDepartment}</Badge>}
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/employees")}>
              Xóa bộ lọc
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Tổng quan quân nhân">
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
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Tìm kiếm và lọc</CardTitle>
              <CardDescription className="mt-1">Lọc danh sách theo thông tin nhân sự và đơn vị công tác.</CardDescription>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button
                variant={isFilterBarOpen ? "tonal" : "outline"}
                onClick={() => setIsFilterBarOpen((open) => !open)}
              >
                <Filter />
                {isFilterBarOpen ? "Ẩn bộ lọc" : "Mở bộ lọc"}
              </Button>
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCw />
                Làm mới
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download />
                Xuất Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        {isFilterBarOpen && (
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="employee-search">Tìm kiếm</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="employee-search"
                  placeholder="Tên, mã, email, đơn vị..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <FilterSelect label="Trạng thái" icon={UserCheck}>
              <Select value={statusFilter} onValueChange={(value: typeof statusFilter) => setStatusFilter(value)}>
                <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="HOAT_DONG">Hoạt động</SelectItem>
                  <SelectItem value="TRANH_THU">Tranh thủ</SelectItem>
                  <SelectItem value="PHEP">Phép</SelectItem>
                  <SelectItem value="LY_DO_KHAC">Lý do khác</SelectItem>
                </SelectContent>
              </Select>
            </FilterSelect>

            <FilterSelect label="Đơn vị" icon={Users}>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả đơn vị</SelectItem>
                  {departments.map((department) => <SelectItem key={department.id} value={department.name}>{department.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterSelect>

            <FilterSelect label="Cấp bậc" icon={Crown}>
              <Select value={rankFilter} onValueChange={setRankFilter}>
                <SelectTrigger><SelectValue placeholder="Chọn cấp bậc" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cấp bậc</SelectItem>
                  {Array.from(new Set(employees.map((employee) => employee.rank).filter(Boolean))).map((rank) => (
                    <SelectItem key={rank} value={rank!}>{rank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSelect>

            <FilterSelect label="Chức vụ" icon={Briefcase}>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger><SelectValue placeholder="Chọn chức vụ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả chức vụ</SelectItem>
                  {Array.from(new Set(employees.map((employee) => employee.position).filter(Boolean))).map((position) => (
                    <SelectItem key={position} value={position!}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSelect>

            <FilterSelect label="SQ/QNCN" icon={Shield}>
              <Select value={militaryCivilianFilter} onValueChange={setMilitaryCivilianFilter}>
                <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="SQ">Sĩ quan</SelectItem>
                  <SelectItem value="QNCN">QNCN</SelectItem>
                </SelectContent>
              </Select>
            </FilterSelect>
          </CardContent>
        )}
      </Card>

      {selectedEmployees.length > 0 && (
        <Card className="border-primary/25 bg-primary-container/35">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary">{selectedEmployees.length} quân nhân đã chọn</Badge>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 />
              Xóa đã chọn
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách quân nhân</CardTitle>
          <CardDescription>{filteredEmployees.length} kết quả theo bộ lọc hiện tại.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          <EmployeeTable
            employees={filteredEmployees}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAddNew}
            selectedEmployees={selectedEmployees}
            onSelectionChange={setSelectedEmployees}
          />
        </CardContent>
      </Card>

      <EmployeeForm
        employee={selectedEmployee}
        departments={departments}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedEmployee(undefined)
        }}
        onSave={handleSave}
      />
    </AdminPage>
  )
}


export default function EmployeesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <EmployeesContent />
    </Suspense>
  )
}

function FilterSelect({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: typeof Users
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  )
}
