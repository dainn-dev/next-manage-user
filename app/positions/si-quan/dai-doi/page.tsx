"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Download, Plus, RefreshCw, Trash2, Users, TrendingUp, ArrowLeft } from "lucide-react"
import { PositionForm } from "@/components/positions/position-form"
import { PositionTable } from "@/components/positions/position-table"
import { dataService } from "@/lib/data-service"
import type { Position } from "@/lib/types"
import { PositionLevel } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function DaiDoiPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    loadPositions()
  }, [])

  useEffect(() => {
    filterPositions()
  }, [positions, searchTerm, statusFilter])

  const loadPositions = async () => {
    try {
      setLoading(true)
      const data = await dataService.getPositions()
      const daiDoiPositions = data.filter(pos => pos.level === PositionLevel.DAI_DOI)
      setPositions(daiDoiPositions)
    } catch (error) {
      console.error("Error loading positions:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách chức vụ Đại đội",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterPositions = () => {
    let filtered = [...positions]

    if (searchTerm) {
      filtered = filtered.filter(pos =>
        pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(pos => 
        statusFilter === "active" ? pos.isActive : !pos.isActive
      )
    }

    setFilteredPositions(filtered)
  }

  const handleCreatePosition = () => {
    setEditingPosition(null)
    setFormMode("create")
    setIsFormOpen(true)
  }

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position)
    setFormMode("edit")
    setIsFormOpen(true)
  }

  const handleSavePosition = async (position: Position) => {
    try {
      if (formMode === "create") {
        const newPosition = await dataService.createPosition({
          ...position,
          level: PositionLevel.DAI_DOI,
        })
        setPositions(prev => [...prev, newPosition])
        toast({
          title: "Thành công",
          description: "Chức vụ Đại đội đã được tạo thành công!",
        })
      } else {
        const updatedPosition = await dataService.updatePosition(position.id, position)
        if (updatedPosition) {
          setPositions(prev => prev.map(p => p.id === position.id ? updatedPosition : p))
          toast({
            title: "Thành công", 
            description: "Chức vụ Đại đội đã được cập nhật thành công!",
          })
        }
      }
      setIsFormOpen(false)
      setEditingPosition(null)
    } catch (error) {
      console.error("Error saving position:", error)
      toast({
        title: "Lỗi",
        description: formMode === "create" ? "Không thể tạo chức vụ Đại đội" : "Không thể cập nhật chức vụ Đại đội",
        variant: "destructive",
      })
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa chức vụ Đại đội này?")) {
      try {
        const success = await dataService.deletePosition(positionId)
        if (success) {
          setPositions(prev => prev.filter(p => p.id !== positionId))
          setSelectedPositions(prev => prev.filter(id => id !== positionId))
          toast({
            title: "Thành công",
            description: "Chức vụ Đại đội đã được xóa thành công!",
          })
        }
      } catch (error) {
        console.error("Error deleting position:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa chức vụ Đại đội",
          variant: "destructive",
        })
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPositions.length === 0) {
      toast({
        title: "Cảnh báo",
        description: "Vui lòng chọn ít nhất một chức vụ để xóa",
        variant: "destructive",
      })
      return
    }

    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedPositions.length} chức vụ Đại đội đã chọn?`)) {
      try {
        const success = await dataService.bulkDeletePositions(selectedPositions)
        if (success) {
          setPositions(prev => prev.filter(p => !selectedPositions.includes(p.id)))
          setSelectedPositions([])
          toast({
            title: "Thành công",
            description: `${selectedPositions.length} chức vụ Đại đội đã được xóa thành công!`,
          })
        }
      } catch (error) {
        console.error("Error bulk deleting positions:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa các chức vụ Đại đội đã chọn",
          variant: "destructive",
        })
      }
    }
  }

  const handleViewDetails = (position: Position) => {
    console.log("View Đại đội position details:", position)
  }

  const handleExport = () => {
    console.log("Export Đại đội positions")
  }

  const getStatistics = () => {
    const total = positions.length
    const active = positions.filter(p => p.isActive).length
    const totalEmployees = positions.reduce((sum, p) => sum + (p.childrenCount || 0), 0)
    
    return { total, active, totalEmployees }
  }

  const stats = getStatistics()

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-red-600 font-medium">Đang tải dữ liệu chức vụ Đại đội...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/positions/si-quan')}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại Sĩ quan
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chức vụ Đại đội</h1>
            <p className="text-muted-foreground text-lg">Quản lý chức vụ cấp Đại đội trong Sĩ quan</p>
          </div>
        </div>
        <Button onClick={handleCreatePosition} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          Thêm chức vụ Đại đội
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chức vụ Đại đội</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} đang hoạt động
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nhân sự</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Tổng số cán bộ Đại đội
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoạt động</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Chức vụ đang hoạt động
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm chức vụ Đại đội..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="active">Hoạt động</SelectItem>
              <SelectItem value="inactive">Không hoạt động</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPositions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Xuất Excel
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      {selectedPositions.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg mb-6">
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            {selectedPositions.length} đã chọn
          </Badge>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa đã chọn
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="mb-6">
        <PositionTable
          positions={filteredPositions}
          onEdit={handleEditPosition}
          onDelete={handleDeletePosition}
          onViewDetails={handleViewDetails}
          selectedPositions={selectedPositions}
          onSelectionChange={setSelectedPositions}
        />
      </div>

      {/* Position Form Dialog */}
      <PositionForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingPosition(null)
        }}
        onSave={handleSavePosition}
        position={editingPosition}
        mode={formMode}
      />
    </div>
  )
}
