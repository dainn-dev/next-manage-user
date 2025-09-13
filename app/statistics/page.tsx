"use client"

import { useState, useEffect } from "react"
import type { Employee, Department } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { StatisticsDashboard } from "@/components/reports/statistics-dashboard"
import { ExportDialog } from "@/components/reports/export-dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function StatisticsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  useEffect(() => {
    setEmployees(dataService.getEmployees())
    setDepartments(dataService.getDepartments())
  }, [])

  const handleExport = (options: any) => {
    console.log("Exporting with options:", options)
    // Simulate export process
    alert(`Đang xuất dữ liệu định dạng ${options.format}...`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nhân sự / Quản lý nhân sự / Thống kê</h1>
        </div>
        <Button onClick={() => setIsExportDialogOpen(true)}>
          <Download className="h-4 w-4 mr-2" />
          Xuất báo cáo
        </Button>
      </div>

      <StatisticsDashboard employees={employees} departments={departments} />

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} onExport={handleExport} />
    </div>
  )
}
