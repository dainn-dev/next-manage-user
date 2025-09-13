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

  useEffect(() => {
    setEmployees(dataService.getEmployees())
    setDepartments(dataService.getDepartments())
  }, [])

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleDelete = (employeeId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) {
      dataService.deleteEmployee(employeeId)
      setEmployees(dataService.getEmployees())
    }
  }

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleSave = (employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">) => {
    if (selectedEmployee) {
      dataService.updateEmployee(selectedEmployee.id, employeeData)
    } else {
      dataService.createEmployee(employeeData)
    }
    setEmployees(dataService.getEmployees())
    setIsFormOpen(false)
    setSelectedEmployee(undefined)
  }

  const handleAddNew = () => {
    setSelectedEmployee(undefined)
    setIsFormOpen(true)
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý nhân sự</h1>
          <p className="text-muted-foreground text-lg">Nhân sự được xem xét</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 flex items-center gap-3 font-medium shadow-md hover:shadow-lg"
        >
          <span className="text-lg">➕</span>
          Thêm nhân viên
        </button>
      </div>

      <EmployeeTable employees={employees} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />

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
