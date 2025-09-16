"use client"

import { useState, useEffect } from "react"
import type { Employee, Department, VehicleStatistics } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { StatisticsDashboard } from "@/components/reports/statistics-dashboard"
import { VehicleStatisticsDashboard } from "@/components/vehicles/vehicle-statistics-dashboard"
import { ExportDialog } from "@/components/reports/export-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, RefreshCw } from "lucide-react"

export default function StatisticsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [vehicleStatistics, setVehicleStatistics] = useState<VehicleStatistics | null>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [employeesData, departmentsData, vehicleStats] = await Promise.all([
        dataService.getEmployees(),
        Promise.resolve(dataService.getDepartments()),
        dataService.getVehicleStatistics()
      ])
      setEmployees(employeesData)
      setDepartments(departmentsData)
      setVehicleStatistics(vehicleStats)
    } catch (err) {
      setError('Không thể tải dữ liệu thống kê')
      console.error('Error loading statistics data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (options: any) => {
    console.log("Exporting with options:", options)
    // Simulate export process
    alert(`Đang xuất dữ liệu định dạng ${options.format}...`)
  }

  const handleRefresh = () => {
    loadData()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu thống kê...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Thống kê hệ thống</h1>
          <p className="text-muted-foreground">Thống kê Quân nhân và phương tiện</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button onClick={() => setIsExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees">Thống kê Quân nhân</TabsTrigger>
          <TabsTrigger value="vehicles">Thống kê xe</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          <StatisticsDashboard employees={employees} departments={departments} />
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          {vehicleStatistics && (
            <VehicleStatisticsDashboard statistics={vehicleStatistics} />
          )}
        </TabsContent>
      </Tabs>

      <ExportDialog isOpen={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} onExport={handleExport} />
    </div>
  )
}
