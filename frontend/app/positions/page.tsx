"use client"

import { useEffect, useState } from "react"
import type { Position } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { PositionForm } from "@/components/positions/position-form"
import { PositionTable } from "@/components/positions/position-table"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Download, Loader2, Plus, RefreshCw, Search, Trash2, TrendingUp, Users } from "lucide-react"

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [levelFilter, setLevelFilter] = useState<"all" | string>("all")
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    void loadPositions()
  }, [])

  useEffect(() => {
    filterPositions()
  }, [positions, searchTerm, statusFilter, levelFilter])

  const loadPositions = async () => {
    try {
      setLoading(true)
      setPositions(await dataService.getPositions())
    } catch (error) {
      console.error("Error loading positions:", error)
      toast({ title: "Lỗi", description: "Không thể tải danh sách chức vụ", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filterPositions = () => {
    let filtered = [...positions]

    if (searchTerm) {
      filtered = filtered.filter((position) =>
        position.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (position.description && position.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (position.parentName && position.parentName.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((position) => statusFilter === "active" ? position.isActive : !position.isActive)
    }

    if (levelFilter !== "all") {
      filtered = filtered.filter((position) => position.filterBy === levelFilter)
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
          filterBy: position.filterBy,
        })
        setPositions((current) => [...current, newPosition])
        toast({ title: "Thành công", description: "Chức vụ đã được tạo thành công!" })
      } else {
        const updatedPosition = await dataService.updatePosition(position.id, position)
        if (updatedPosition) {
          setPositions((current) => current.map((item) => item.id === position.id ? updatedPosition : item))
          toast({ title: "Thành công", description: "Chức vụ đã được cập nhật thành công!" })
        }
      }
      setIsFormOpen(false)
      setEditingPosition(null)
    } catch (error) {
      console.error("Error saving position:", error)
      toast({
        title: "Lỗi",
        description: formMode === "create" ? "Không thể tạo chức vụ" : "Không thể cập nhật chức vụ",
        variant: "destructive",
      })
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa chức vụ này?")) {
      try {
        const success = await dataService.deletePosition(positionId)
        if (success) {
          setPositions((current) => current.filter((position) => position.id !== positionId))
          setSelectedPositions((current) => current.filter((id) => id !== positionId))
          toast({ title: "Thành công", description: "Chức vụ đã được xóa thành công!" })
        }
      } catch (error) {
        console.error("Error deleting position:", error)
        toast({ title: "Lỗi", description: "Không thể xóa chức vụ", variant: "destructive" })
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPositions.length === 0) {
      toast({ title: "Cảnh báo", description: "Vui lòng chọn ít nhất một chức vụ để xóa", variant: "destructive" })
      return
    }

    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedPositions.length} chức vụ đã chọn?`)) {
      try {
        const success = await dataService.bulkDeletePositions(selectedPositions)
        if (success) {
          setPositions((current) => current.filter((position) => !selectedPositions.includes(position.id)))
          setSelectedPositions([])
          toast({ title: "Thành công", description: `${selectedPositions.length} chức vụ đã được xóa thành công!` })
        }
      } catch (error) {
        console.error("Error bulk deleting positions:", error)
        toast({ title: "Lỗi", description: "Không thể xóa các chức vụ đã chọn", variant: "destructive" })
      }
    }
  }

  const handleViewDetails = () => {
    alert("Tính năng xem chi tiết sẽ được triển khai sau")
  }

  const handleExport = () => {
    alert("Tính năng xuất dữ liệu sẽ được triển khai sau")
  }

  const stats = (() => {
    const total = positions.length
    const active = positions.filter((position) => position.isActive).length
    const totalEmployees = positions.reduce((sum, position) => sum + (position.childrenCount || 0), 0)
    const avgLevel = positions.length > 0
      ? (positions.reduce((sum, position) => sum + position.displayOrder, 0) / positions.length).toFixed(1)
      : 0
    return { total, active, totalEmployees, avgLevel }
  })()

  if (loading) {
    return (
      <AdminPage>
        <Card className="min-h-64 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu chức vụ.</p>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  const metricCards = [
    { label: "Tổng chức vụ", value: stats.total, description: `${stats.active} đang hoạt động`, icon: Users },
    { label: "Nhân sự có chức vụ", value: stats.totalEmployees, description: "Tổng số vị trí con đang được ghi nhận", icon: Users },
    { label: "Cấp độ trung bình", value: stats.avgLevel, description: "Cấp độ chức vụ trung bình", icon: TrendingUp },
    {
      label: "Tỷ lệ hoạt động",
      value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%`,
      description: "Chức vụ đang hoạt động",
      icon: TrendingUp,
    },
  ]

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị nhân sự"
        title="Chức vụ và cấp bậc"
        description="Quản lý hệ thống chức vụ, trạng thái hoạt động và cấp độ trong đơn vị."
        actions={
          <Button onClick={handleCreatePosition}>
            <Plus />
            Thêm chức vụ
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan chức vụ">
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
        <CardHeader>
          <CardTitle>Tìm kiếm và lọc</CardTitle>
          <CardDescription>Thu hẹp danh sách theo tên, trạng thái và loại chức vụ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_auto] lg:items-end">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground" htmlFor="position-search">Tìm kiếm</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="position-search"
                placeholder="Tìm theo tên, mô tả hoặc chức vụ cha"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Trạng thái</label>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="inactive">Không hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Loại chức vụ</label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger><SelectValue placeholder="Cấp độ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả cấp</SelectItem>
                <SelectItem value="CO_QUAN_DON_VI">Cơ quan đơn vị</SelectItem>
                <SelectItem value="CHUC_VU">Chức vụ</SelectItem>
                <SelectItem value="N_A">Không xác định</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <Button variant="outline" onClick={() => void loadPositions()}>
              <RefreshCw />
              Làm mới
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download />
              Xuất
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedPositions.length > 0 && (
        <Card className="border-primary/25 bg-primary-container/35">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary">{selectedPositions.length} chức vụ đã chọn</Badge>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 />
              Xóa đã chọn
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách chức vụ</CardTitle>
          <CardDescription>Thông tin được hiển thị theo bộ lọc hiện tại.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          <PositionTable
            positions={filteredPositions}
            onEdit={handleEditPosition}
            onDelete={handleDeletePosition}
            onViewDetails={handleViewDetails}
            selectedPositions={selectedPositions}
            onSelectionChange={setSelectedPositions}
          />
        </CardContent>
      </Card>

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
    </AdminPage>
  )
}
