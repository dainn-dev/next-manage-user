"use client"

import { useState, useEffect } from "react"
import type { Employee, Department } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { EmployeeTable } from "@/components/employees/employee-table"
import { EmployeeForm } from "@/components/employees/employee-form"

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [employeesData, departmentsData] = await Promise.all([
        dataService.getEmployees(),
        Promise.resolve(dataService.getDepartments())
      ])
      setEmployees(employeesData)
      setDepartments(departmentsData)
    } catch (err) {
      setError('Không thể tải dữ liệu nhân viên')
      console.error('Error loading employees data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleDelete = async (employeeId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) {
      try {
        await dataService.deleteEmployee(employeeId)
        await loadData()
      } catch (err) {
        setError('Không thể xóa nhân viên')
        console.error('Error deleting employee:', err)
      }
    }
  }

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleSave = async (employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (selectedEmployee) {
        await dataService.updateEmployee(selectedEmployee.id, employeeData)
      } else {
        await dataService.createEmployee(employeeData)
      }
      await loadData()
      setIsFormOpen(false)
      setSelectedEmployee(undefined)
    } catch (err) {
      setError('Không thể lưu nhân viên')
      console.error('Error saving employee:', err)
    }
  }

  const handleAddNew = () => {
    setSelectedEmployee(undefined)
    setIsFormOpen(true)
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

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý nhân sự</h1>
          <p className="text-muted-foreground text-lg">Nhân sự được xem xét</p>
        </div>
      </div>

      <EmployeeTable employees={employees} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} onAdd={handleAddNew} />

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
