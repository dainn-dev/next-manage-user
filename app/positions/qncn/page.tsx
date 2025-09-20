"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Download, Plus, RefreshCw, Trash2, Users, TrendingUp } from "lucide-react"
import { PositionForm } from "@/components/positions/position-form"
import { PositionTable } from "@/components/positions/position-table"
import { dataService } from "@/lib/data-service"
import type { Position } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export default function QNCNPage() {
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

  // QNCN position names that should be displayed
  const QNCN_POSITION_NAMES = [
    "QNCN",
    "Tiểu đoàn (QNCN)",
    "Cơ quan (QNCN)",
    "Tham mưu",
    "Chính trị",
    "Hậu cần - Kỹ thuật",
  ]

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
      // Filter to show only QNCN positions
      const qncnPositions = data.filter(pos => QNCN_POSITION_NAMES.includes(pos.name))
      setPositions(qncnPositions)
    } catch (error) {
      console.error("Error loading positions:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách chức vụ QNCN",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterPositions = () => {
    let filtered = [...positions]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(pos =>
        pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pos.parentName && pos.parentName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Status filter
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
          name: position.name,
          description: position.description,
          parentId: position.parentId,
          isActive: position.isActive,
          displayOrder: position.displayOrder,
          childrenCount: position.childrenCount,
        })
        if (QNCN_POSITION_NAMES.includes(newPosition.name)) {
          setPositions(prev => [...prev, newPosition])
        }
        toast({
          title: "Thành công",
          description: "Chức vụ QNCN đã được tạo thành công!",
        })
      } else {
        const updatedPosition = await dataService.updatePosition(position.id, position)
        if (updatedPosition) {
          setPositions(prev => prev.map(p => p.id === position.id ? updatedPosition : p))
          toast({
            title: "Thành công", 
            description: "Chức vụ QNCN đã được cập nhật thành công!",
          })
        }
      }
      setIsFormOpen(false)
      setEditingPosition(null)
    } catch (error) {
      console.error("Error saving position:", error)
      toast({
        title: "Lỗi",
        description: formMode === "create" ? "Không thể tạo chức vụ QNCN" : "Không thể cập nhật chức vụ QNCN",
        variant: "destructive",
      })
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa chức vụ QNCN này?")) {
      try {
        const success = await dataService.deletePosition(positionId)
        if (success) {
          setPositions(prev => prev.filter(p => p.id !== positionId))
          setSelectedPositions(prev => prev.filter(id => id !== positionId))
          toast({
            title: "Thành công",
            description: "Chức vụ QNCN đã được xóa thành công!",
          })
        }
      } catch (error) {
        console.error("Error deleting position:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa chức vụ QNCN",
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

    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedPositions.length} chức vụ QNCN đã chọn?`)) {
      try {
        const success = await dataService.bulkDeletePositions(selectedPositions)
        if (success) {
          setPositions(prev => prev.filter(p => !selectedPositions.includes(p.id)))
          setSelectedPositions([])
          toast({
            title: "Thành công",
            description: `${selectedPositions.length} chức vụ QNCN đã được xóa thành công!`,
          })
        }
      } catch (error) {
        console.error("Error bulk deleting positions:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa các chức vụ QNCN đã chọn",
          variant: "destructive",
        })
      }
    }
  }

  const handleViewDetails = (position: Position) => {
    alert("Tính năng xem chi tiết sẽ được triển khai sau")
  }

  const handleExport = () => {
    alert("Tính năng xuất dữ liệu sẽ được triển khai sau")
  }

  const getStatistics = () => {
    const total = positions.length
    const active = positions.filter(p => p.isActive).length
    const totalEmployees = positions.reduce((sum, p) => sum + (p.childrenCount || 0), 0)
    const avgLevel = positions.length > 0 ? (positions.reduce((sum, p) => sum + p.displayOrder, 0) / positions.length).toFixed(1) : 0

    return { total, active, totalEmployees, avgLevel }
  }

  const stats = getStatistics()

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu chức vụ QNCN...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chức vụ QNCN</h1>
          <p className="text-muted-foreground text-lg">Quản lý chức vụ Quân nhân chuyên nghiệp trong đơn vị</p>
        </div>
        <Button onClick={handleCreatePosition} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Thêm chức vụ QNCN
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chức vụ QNCN</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} đang hoạt động
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QNCN</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Tổng số QNCN
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cấp độ trung bình</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.avgLevel}</div>
            <p className="text-xs text-muted-foreground">
              Cấp độ chức vụ TB
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoạt động</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
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
              placeholder="Tìm kiếm chức vụ QNCN..."
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
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-6">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
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
