"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Users, Eye } from "lucide-react"
import type { Position } from "@/lib/types"

interface PositionTableProps {
  positions: Position[]
  onEdit: (position: Position) => void
  onDelete: (positionId: string) => void
  onViewDetails: (position: Position) => void
  selectedPositions: string[]
  onSelectionChange: (selectedIds: string[]) => void
}

export function PositionTable({ 
  positions, 
  onEdit, 
  onDelete, 
  onViewDetails,
  selectedPositions,
  onSelectionChange 
}: PositionTableProps) {
  const [sortField, setSortField] = useState<keyof Position>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: keyof Position) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedPositions = [...positions].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (aValue == null && bValue == null) return 0
    if (aValue == null) return sortDirection === "asc" ? -1 : 1
    if (bValue == null) return sortDirection === "asc" ? 1 : -1
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(positions.map(p => p.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectPosition = (positionId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedPositions, positionId])
    } else {
      onSelectionChange(selectedPositions.filter(id => id !== positionId))
    }
  }

  const getPositionBadgeColor = (positionName?: string) => {
    if (!positionName) return "bg-gray-100 text-gray-800"
    
    if (positionName.includes("Chức vụ")) return "bg-purple-100 text-purple-800"
    if (positionName.includes("Sĩ quan")) return "bg-red-100 text-red-800"
    if (positionName.includes("QNCN")) return "bg-blue-100 text-blue-800"
    if (positionName.includes("Tham mưu") || positionName.includes("Chính trị") || positionName.includes("Hậu cần")) return "bg-green-100 text-green-800"
    if (positionName.includes("Trung đoàn") || positionName.includes("Tiểu đoàn")) return "bg-orange-100 text-orange-800"
    return "bg-gray-100 text-gray-800"
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedPositions.length === positions.length && positions.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("id")}
            >
              Mã chức vụ
              {sortField === "id" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("name")}
            >
              Tên chức vụ
              {sortField === "name" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead>Chức vụ cấp cao</TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("name")}
            >
              Loại chức vụ
              {sortField === "name" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("childrenCount")}
            >
              Số chức vụ con
              {sortField === "childrenCount" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("isActive")}
            >
              Trạng thái
              {sortField === "isActive" && (
                <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
            <TableHead className="w-32">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPositions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Không có dữ liệu chức vụ</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedPositions.map((position) => (
              <TableRow key={position.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedPositions.includes(position.id)}
                    onCheckedChange={(checked) => handleSelectPosition(position.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Badge variant="outline">{position.id.substring(0, 8)}</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{position.name}</div>
                    {position.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {position.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {position.parentName ? (
                    <div>
                      <div className="text-sm font-medium">{position.parentName}</div>
                      <div className="text-xs text-muted-foreground">{position.parentId?.substring(0, 8)}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={getPositionBadgeColor(position.name)}>
                    {position.name || "Không có tên"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{position.childrenCount || 0}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={position.isActive ? "default" : "secondary"}>
                    {position.isActive ? "Hoạt động" : "Không hoạt động"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const menu = document.getElementById(`menu-${position.id}`)
                          if (menu) {
                            menu.classList.toggle('hidden')
                          }
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <div 
                        id={`menu-${position.id}`}
                        className="absolute right-0 top-8 hidden z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <div 
                          className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            onEdit(position)
                            document.getElementById(`menu-${position.id}`)?.classList.add('hidden')
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Chỉnh sửa
                        </div>
                        <div 
                          className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-red-600"
                          onClick={() => {
                            onDelete(position.id)
                            document.getElementById(`menu-${position.id}`)?.classList.add('hidden')
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Xóa
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
