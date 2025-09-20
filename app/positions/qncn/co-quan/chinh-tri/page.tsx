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

export default function ChinhTriQNCNPage() {
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
      const chinhTriPositions = data.filter(pos => pos.filterBy === 'CHUC_VU')
      setPositions(chinhTriPositions)
    } catch (error) {
      console.error("Error loading positions:", error)
      toast({
        title: "Lá»—i",
        description: "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)",
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
          name: position.name,
          description: position.description,
          parentId: position.parentId,
          isActive: position.isActive,
          displayOrder: position.displayOrder,
          filterBy: 'CHUC_VU',
        })
        setPositions(prev => [...prev, newPosition])
        toast({
          title: "ThÃ nh cÃ´ng",
          description: "Chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ Ä‘Æ°á»£c táº¡o thÃ nh cÃ´ng!",
        })
      } else {
        const updatedPosition = await dataService.updatePosition(position.id, position)
        if (updatedPosition) {
          setPositions(prev => prev.map(p => p.id === position.id ? updatedPosition : p))
          toast({
            title: "ThÃ nh cÃ´ng", 
            description: "Chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t thÃ nh cÃ´ng!",
          })
        }
      }
      setIsFormOpen(false)
      setEditingPosition(null)
    } catch (error) {
      console.error("Error saving position:", error)
      toast({
        title: "Lá»—i",
        description: formMode === "create" ? "KhÃ´ng thá»ƒ táº¡o chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)" : "KhÃ´ng thá»ƒ cáº­p nháº­t chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)",
        variant: "destructive",
      })
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) nÃ y?")) {
      try {
        const success = await dataService.deletePosition(positionId)
        if (success) {
          setPositions(prev => prev.filter(p => p.id !== positionId))
          setSelectedPositions(prev => prev.filter(id => id !== positionId))
          toast({
            title: "ThÃ nh cÃ´ng",
            description: "Chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ Ä‘Æ°á»£c xÃ³a thÃ nh cÃ´ng!",
          })
        }
      } catch (error) {
        console.error("Error deleting position:", error)
        toast({
          title: "Lá»—i",
          description: "KhÃ´ng thá»ƒ xÃ³a chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)",
          variant: "destructive",
        })
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPositions.length === 0) {
      toast({
        title: "Cáº£nh bÃ¡o",
        description: "Vui lÃ²ng chá»n Ã­t nháº¥t má»™t chá»©c vá»¥ Ä‘á»ƒ xÃ³a",
        variant: "destructive",
      })
      return
    }

    if (confirm(`Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a ${selectedPositions.length} chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ chá»n?`)) {
      try {
        const success = await dataService.bulkDeletePositions(selectedPositions)
        if (success) {
          setPositions(prev => prev.filter(p => !selectedPositions.includes(p.id)))
          setSelectedPositions([])
          toast({
            title: "ThÃ nh cÃ´ng",
            description: `${selectedPositions.length} chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ Ä‘Æ°á»£c xÃ³a thÃ nh cÃ´ng!`,
          })
        }
      } catch (error) {
        console.error("Error bulk deleting positions:", error)
        toast({
          title: "Lá»—i",
          description: "KhÃ´ng thá»ƒ xÃ³a cÃ¡c chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN) Ä‘Ã£ chá»n",
          variant: "destructive",
        })
      }
    }
  }

  const handleViewDetails = (position: Position) => {
    alert("TÃ­nh nÄƒng xem chi tiáº¿t sáº½ Ä‘Æ°á»£c triá»ƒn khai sau")
  }

  const handleExport = () => {
    alert("TÃ­nh nÄƒng xuáº¥t dá»¯ liá»‡u sáº½ Ä‘Æ°á»£c triá»ƒn khai sau")
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
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-green-600 font-medium">Äang táº£i dá»¯ liá»‡u chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)...</p>
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
            onClick={() => router.push('/positions/qncn/co-quan')}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay láº¡i CÆ¡ quan (QNCN)
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)</h1>
            <p className="text-muted-foreground text-lg">Quáº£n lÃ½ chá»©c vá»¥ bá»™ pháº­n ChÃ­nh trá»‹ QNCN</p>
          </div>
        </div>
        <Button onClick={handleCreatePosition} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          ThÃªm chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tá»•ng chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} Ä‘ang hoáº¡t Ä‘á»™ng
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NhÃ¢n sá»±</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Tá»•ng sá»‘ QNCN ChÃ­nh trá»‹
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tá»· lá»‡ hoáº¡t Ä‘á»™ng</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Chá»©c vá»¥ Ä‘ang hoáº¡t Ä‘á»™ng
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
              placeholder="TÃ¬m kiáº¿m chá»©c vá»¥ ChÃ­nh trá»‹ (QNCN)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tráº¡ng thÃ¡i" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Táº¥t cáº£</SelectItem>
              <SelectItem value="active">Hoáº¡t Ä‘á»™ng</SelectItem>
              <SelectItem value="inactive">KhÃ´ng hoáº¡t Ä‘á»™ng</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPositions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            LÃ m má»›i
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Xuáº¥t Excel
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      {selectedPositions.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg mb-6">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {selectedPositions.length} Ä‘Ã£ chá»n
          </Badge>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            XÃ³a Ä‘Ã£ chá»n
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

