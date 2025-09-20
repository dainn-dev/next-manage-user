"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { Employee, Department } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { EmployeeTable } from "@/components/employees/employee-table"
import { EmployeeForm } from "@/components/employees/employee-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Download, Plus, RefreshCw, Trash2, Users, TrendingUp, UserCheck, Edit, Shield, Crown, Briefcase } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function EmployeesPage() {
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "terminated">("all")
  const [departmentFilter, setDepartmentFilter] = useState<"all" | string>("all")
  const [rankFilter, setRankFilter] = useState<"all" | string>("all")
  const [positionFilter, setPositionFilter] = useState<"all" | string>("all")
  const [militaryCivilianFilter, setMilitaryCivilianFilter] = useState<"all" | string>("all")
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, []) // Only load data once when component mounts

  // Handle URL parameters for filtering
  useEffect(() => {
    const positionParam = searchParams.get('position')
    const departmentParam = searchParams.get('department')
    
    if (positionParam) {
      setPositionFilter(positionParam)
    }
    if (departmentParam) {
      setDepartmentFilter(departmentParam)
    }
  }, [searchParams])

  useEffect(() => {
    filterEmployees()
  }, [employees, searchTerm, statusFilter, departmentFilter, rankFilter, positionFilter, militaryCivilianFilter, searchParams])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const { employeeApi } = await import("@/lib/api/employee-api")
      
      // Always load all employees from the existing API endpoint
      const employeesData = await employeeApi.getAllEmployeesList()
      const departmentsData = await Promise.resolve(dataService.getDepartments()) // Keep departments from mock for now
      
      setEmployees(employeesData)
      setDepartments(departmentsData)
    } catch (err) {
      setError('Không thể tải dữ liệu nhân viên')
      console.error('Error loading employees data:', err)
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu nhân viên",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterEmployees = () => {
    let filtered = [...employees]

    // URL parameter filters (from sidebar dropdown)
    const positionParam = searchParams.get('position')
    const departmentParam = searchParams.get('department')
    
    if (positionParam) {
      filtered = filtered.filter(emp => 
        emp.position === positionParam || emp.jobTitle === positionParam
      )
    }
    
    if (departmentParam) {
      filtered = filtered.filter(emp => emp.department === departmentParam)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(emp => emp.status === statusFilter)
    }

    // Department filter
    if (departmentFilter !== "all") {
      filtered = filtered.filter(emp => emp.department === departmentFilter)
    }

    // Rank filter
    if (rankFilter !== "all") {
      filtered = filtered.filter(emp => emp.rank === rankFilter)
    }

    // Position filter
    if (positionFilter !== "all") {
      filtered = filtered.filter(emp => emp.position === positionFilter)
    }

    // Military/Civilian filter
    if (militaryCivilianFilter !== "all") {
      filtered = filtered.filter(emp => emp.militaryCivilian === militaryCivilianFilter)
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
        setError('Không thể xóa nhân viên')
        console.error('Error deleting employee:', err)
      }
    }
  }

  const handleSave = async (employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">): Promise<Employee> => {
    try {
      const { employeeApi } = await import("@/lib/api/employee-api")
      let savedEmployee: Employee
      
      // Convert to API request format
      const apiEmployeeData = {
        employeeId: employeeData.employeeId,
        name: employeeData.name,
        firstName: employeeData.firstName || "",
        lastName: employeeData.lastName || "",
        email: employeeData.email,
        phone: employeeData.phone,
        department: employeeData.department,
        position: employeeData.position,
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
      }
      
      if (selectedEmployee) {
        savedEmployee = await employeeApi.updateEmployee(selectedEmployee.id, apiEmployeeData)
      } else {
        savedEmployee = await employeeApi.createEmployee(apiEmployeeData)
      }
      
      await loadData()
      setIsFormOpen(false)
      setSelectedEmployee(undefined)
      return savedEmployee
    } catch (err) {
      setError('Không thể lưu nhân viên')
      console.error('Error saving employee:', err)
      throw err
    }
  }

  const handleAddNew = () => {
    setSelectedEmployee(undefined)
    setIsFormOpen(true)
  }

  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "Cảnh báo",
        description: "Vui lòng chọn ít nhất một nhân viên để xóa",
        variant: "destructive",
      })
      return
    }

    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedEmployees.length} nhân viên đã chọn?`)) {
      try {
        const { employeeApi } = await import("@/lib/api/employee-api")
        await Promise.all(selectedEmployees.map(id => employeeApi.deleteEmployee(id)))
        setSelectedEmployees([])
        await loadData()
        toast({
          title: "Thành công",
          description: `${selectedEmployees.length} nhân viên đã được xóa thành công!`,
        })
      } catch (error) {
        console.error("Error bulk deleting employees:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa các nhân viên đã chọn",
          variant: "destructive",
        })
      }
    }
  }

  const handleExport = () => {
    // Export functionality to be implemented
    toast({
      title: "Thông báo",
      description: "Tính năng xuất dữ liệu đang được phát triển",
    })
  }

  const getStatistics = () => {
    const total = employees.length
    const active = employees.filter(emp => emp.status === "active").length
    const inactive = employees.filter(emp => emp.status === "inactive").length
    const terminated = employees.filter(emp => emp.status === "terminated").length
    const avgAge = employees.length > 0 ? 
      Math.round(employees.reduce((sum, emp) => {
        if (emp.birthDate) {
          const age = new Date().getFullYear() - new Date(emp.birthDate).getFullYear()
          return sum + age
        }
        return sum
      }, 0) / employees.filter(emp => emp.birthDate).length) : 0

    return { total, active, inactive, terminated, avgAge }
  }

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu nhân viên...</p>
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

  const stats = getStatistics()

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý Quân nhân</h1>
          <p className="text-muted-foreground text-lg">Quản lý thông tin và hoạt động của quân nhân trong đơn vị</p>
          {/* Show filter indicator */}
          {(searchParams.get('position') || searchParams.get('department')) && (
            <div className="mt-2 flex items-center gap-2">
              {searchParams.get('position') && (
                <Badge variant="secondary" className="text-sm">
                  📋 Đang lọc theo chức vụ: {searchParams.get('position')}
                </Badge>
              )}
              {searchParams.get('department') && (
                <Badge variant="secondary" className="text-sm">
                  🏢 Đang lọc theo đơn vị: {searchParams.get('department')}
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => router.push('/employees')}
                className="h-6 px-2 text-xs"
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm quân nhân
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng quân nhân</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} đang hoạt động
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đang hoạt động</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Quân nhân đang làm việc
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tuổi trung bình</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgAge || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tuổi TB của quân nhân
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoạt động</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Quân nhân đang hoạt động
            </p>
          </CardContent>
        </Card>
      </div>

       {/* Search and Filter Bar */}
       <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nhập tên, mã, email, đơn vị..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Trạng thái
            </Label>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🔄 Tất cả</SelectItem>
                <SelectItem value="active">✅ Hoạt động</SelectItem>
                <SelectItem value="inactive">⏸️ Không hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Đơn vị
            </Label>
            <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn đơn vị" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏢 Tất cả đơn vị</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
           </div>

           {/* Rank Filter */}
           <div className="space-y-2">
             <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
               <Crown className="h-4 w-4" />
               Cấp bậc
             </Label>
             <Select value={rankFilter} onValueChange={(value) => setRankFilter(value)}>
               <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                 <SelectValue placeholder="Chọn cấp bậc" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">🎖️ Tất cả cấp bậc</SelectItem>
                 {Array.from(new Set(employees.map(emp => emp.rank).filter(Boolean))).map((rank) => (
                   <SelectItem key={rank} value={rank!}>
                     {rank}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           {/* Position Filter */}
           <div className="space-y-2">
             <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
               <Briefcase className="h-4 w-4" />
               Chức vụ
             </Label>
             <Select value={positionFilter} onValueChange={(value) => setPositionFilter(value)}>
               <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                 <SelectValue placeholder="Chọn chức vụ" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">💼 Tất cả chức vụ</SelectItem>
                 {Array.from(new Set(employees.map(emp => emp.position).filter(Boolean))).map((position) => (
                   <SelectItem key={position} value={position!}>
                     {position}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           {/* Military/Civilian Filter */}
           <div className="space-y-2">
             <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
               <Shield className="h-4 w-4" />
               SQ/QNCN
             </Label>
             <Select value={militaryCivilianFilter} onValueChange={(value) => setMilitaryCivilianFilter(value)}>
               <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                 <SelectValue placeholder="Chọn loại" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">👥 Tất cả</SelectItem>
                 <SelectItem value="SQ">👥 Sĩ Quan</SelectItem>
                 <SelectItem value="QNCN">👥 QNCN</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>

         {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={loadData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Làm mới dữ liệu
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Xuất Excel
          </Button>

        </div>
      </div>

      {/* Action Bar */}
      {selectedEmployees.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-6">
          <Badge variant="secondary">
            {selectedEmployees.length} đã chọn
          </Badge>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="mb-6">
        <EmployeeTable 
          employees={filteredEmployees} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
          onAdd={handleAddNew}
          selectedEmployees={selectedEmployees}
          onSelectionChange={setSelectedEmployees}
        />
      </div>

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
    </div>
  )
}
