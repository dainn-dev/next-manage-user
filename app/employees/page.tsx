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
import { Search, Download, Plus, RefreshCw, Trash2, Users, TrendingUp, UserCheck, Edit, Shield, Crown, Briefcase, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { exportEmployeesToExcel } from "@/lib/utils/excel-export"

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
  const [statusFilter, setStatusFilter] = useState<"all" | "HOAT_DONG" | "TRANH_THU" | "PHEP" | "LY_DO_KHAC">("all")
  const [departmentFilter, setDepartmentFilter] = useState<"all" | string>("all")
  const [rankFilter, setRankFilter] = useState<"all" | string>("all")
  const [positionFilter, setPositionFilter] = useState<"all" | string>("all")
  const [militaryCivilianFilter, setMilitaryCivilianFilter] = useState<"all" | string>("all")
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, []) // Only load data once when component mounts

  // Handle URL parameters for filtering
  useEffect(() => {
    const positionParam = searchParams.get('position')
    const positionIdParam = searchParams.get('positionId')
    const departmentParam = searchParams.get('department')
    
    if (positionParam) {
      setPositionFilter(positionParam)
    }
    if (positionIdParam) {
      // We need to find the position name from the ID
      // For now, we'll handle this in the filterEmployees function
      console.log('Position ID from URL:', positionIdParam)
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
      
      // Log departments for debugging
      console.log("Loaded departments:", departmentsData.map(d => d.name));
      
      // Log sample employee data to check if positionId is populated
      if (employeesData.length > 0) {
        console.log("Sample employee data:", {
          name: employeesData[0].name,
          position: employeesData[0].position,
          positionId: employeesData[0].positionId
        });
      }
      
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
    const positionIdParam = searchParams.get('positionId')
    const departmentParam = searchParams.get('department')
    
    if (positionParam) {
      filtered = filtered.filter(emp => 
        emp.position === positionParam || emp.jobTitle === positionParam
      )
    }
    
    if (positionIdParam) {
      // Filter by positionId - we need to match the positionId field in the employee data
      console.log('Filtering by positionId:', positionIdParam)
      console.log('Employees before positionId filter:', filtered.length)
      filtered = filtered.filter(emp => {
        const matches = emp.positionId === positionIdParam
        if (matches) {
          console.log('Found matching employee:', emp.name, 'positionId:', emp.positionId)
        }
        return matches
      })
      console.log('Employees after positionId filter:', filtered.length)
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
      setError('Không thể lưu nhân viên')
      console.error('Error saving employee:', err)
      
      // Show error toast
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
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
    try {
      const filename = `danh_sach_nhan_vien_${new Date().toISOString().split('T')[0]}`
      const success = exportEmployeesToExcel(employees, filename)
      
       if (success) {
         toast({
           title: "Xuất file thành công",
           description: `Đã xuất ${employees.length} nhân viên ra file CSV (có thể mở bằng Excel)`,
           variant: "default",
         })
       } else {
         throw new Error('Export failed')
       }
     } catch (error) {
       console.error('Export error:', error)
       toast({
         title: "Lỗi xuất file",
         description: "Có lỗi xảy ra khi xuất dữ liệu. Vui lòng thử lại.",
         variant: "destructive",
       })
     }
  }

  const getStatistics = () => {
    const total = employees.length
    const active = employees.filter(emp => emp.status === "HOAT_DONG").length
    const tranhThu = employees.filter(emp => emp.status === "TRANH_THU").length
    const phep = employees.filter(emp => emp.status === "PHEP").length
    const lyDoKhac = employees.filter(emp => emp.status === "LY_DO_KHAC").length
    const avgAge = employees.length > 0 ? 
      Math.round(employees.reduce((sum, emp) => {
        if (emp.birthDate) {
          const age = new Date().getFullYear() - new Date(emp.birthDate).getFullYear()
          return sum + age
        }
        return sum
      }, 0) / employees.filter(emp => emp.birthDate).length) : 0

    return { total, active, tranhThu, phep, lyDoKhac, avgAge }
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
            <h1 className="text-4xl font-bold text-foreground mb-2">Quản lý Quân nhân</h1>
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
      <div className="grid gap-4 md:grid-cols-3 mb-6">
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
       <div className="bg-white border rounded-lg mb-6 shadow-sm">
         {/* Action Buttons - Inline */}
         <div className="flex flex-wrap gap-4 p-6 border-b border-gray-100 bg-gray-50/50">
           <Button
             variant={isFilterBarOpen ? "default" : "outline"}
             size="sm"
             onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
             className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
           >
             <Filter className="h-4 w-4" />
             {isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}
             {isFilterBarOpen ? (
               <span className="ml-1 text-sm">▼</span>
             ) : (
               <span className="ml-1 text-sm">▶</span>
             )}
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={loadData} 
             className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-blue-50 hover:border-blue-300"
           >
             <RefreshCw className="h-4 w-4" />
             Làm mới dữ liệu
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={handleExport} 
             className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-green-50 hover:border-green-300"
           >
             <Download className="h-4 w-4" />
             Xuất Excel
           </Button>
         </div>

         {/* Collapsible Filter Content */}
         {isFilterBarOpen && (
           <div className="p-6 bg-white">
             <div className="mb-4">
               <h3 className="text-lg font-semibold text-gray-800 mb-2">Bộ lọc tìm kiếm</h3>
               <p className="text-sm text-gray-600">Sử dụng các bộ lọc bên dưới để tìm kiếm quân nhân theo tiêu chí cụ thể</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {/* Search Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Nhập tên, mã, email, đơn vị..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Trạng thái
            </Label>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">🔄 Tất cả</SelectItem>
                 <SelectItem value="HOAT_DONG">✅ Hoạt động</SelectItem>
                 <SelectItem value="TRANH_THU">⏸️ Tranh thủ</SelectItem>
                 <SelectItem value="PHEP">📅 Phép</SelectItem>
                 <SelectItem value="LY_DO_KHAC">❌ Lý do khác</SelectItem>
               </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Đơn vị
            </Label>
            <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value)}>
              <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
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
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                Cấp bậc
              </Label>
              <Select value={rankFilter} onValueChange={(value) => setRankFilter(value)}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
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
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                Chức vụ
              </Label>
              <Select value={positionFilter} onValueChange={(value) => setPositionFilter(value)}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
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
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-600" />
                SQ/QNCN
              </Label>
              <Select value={militaryCivilianFilter} onValueChange={(value) => setMilitaryCivilianFilter(value)}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
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
           </div>
         )}
       </div>

      {/* Action Bar */}
      {selectedEmployees.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
              {selectedEmployees.length} quân nhân đã chọn
            </Badge>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleBulkDelete}
            className="shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa đã chọn
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
