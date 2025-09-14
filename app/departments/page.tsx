"use client"

import { useState, useEffect } from "react"
import type { Department } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { DepartmentTable } from "@/components/departments/department-table"
import { DepartmentForm } from "@/components/departments/department-form"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<Department | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    setDepartments(dataService.getDepartments())
  }, [])

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department)
    setIsFormOpen(true)
  }

  const handleDelete = (departmentId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa bộ phận này?")) {
      dataService.deleteDepartment(departmentId)
      setDepartments(dataService.getDepartments())
    }
  }

  const handleSave = (departmentData: Omit<Department, "id" | "createdAt" | "updatedAt">) => {
    if (selectedDepartment) {
      dataService.updateDepartment(selectedDepartment.id, departmentData)
    } else {
      dataService.createDepartment(departmentData)
    }
    setDepartments(dataService.getDepartments())
    setIsFormOpen(false)
    setSelectedDepartment(undefined)
  }

  const handleAddNew = () => {
    setSelectedDepartment(undefined)
    setIsFormOpen(true)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nhân sự / Quản lý nhân sự / Phòng ban</h1>
        </div>
      </div>

      <DepartmentTable departments={departments} onEdit={handleEdit} onDelete={handleDelete} onAddNew={handleAddNew} />

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
