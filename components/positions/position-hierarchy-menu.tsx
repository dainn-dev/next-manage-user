"use client"

import React from "react"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PositionLevel } from "@/lib/types"

interface PositionHierarchyMenuProps {
  onSelect: (level: PositionLevel) => void
  selectedLevel?: PositionLevel
  className?: string
}

export function PositionHierarchyMenu({ 
  onSelect, 
  selectedLevel, 
  className = "" 
}: PositionHierarchyMenuProps) {
  const getSelectedDisplayName = () => {
    // Check traditional levels
    const traditionalLevels = [
      { level: PositionLevel.INTERN, displayName: "Thực tập sinh" },
      { level: PositionLevel.JUNIOR, displayName: "Nhân viên" },
      { level: PositionLevel.SENIOR, displayName: "Nhân viên cao cấp" },
      { level: PositionLevel.LEAD, displayName: "Trưởng nhóm" },
      { level: PositionLevel.MANAGER, displayName: "Quản lý" },
      { level: PositionLevel.DIRECTOR, displayName: "Giám đốc" },
      { level: PositionLevel.EXECUTIVE, displayName: "Điều hành" },
    ]
    
    const traditional = traditionalLevels.find(item => item.level === selectedLevel)
    return traditional?.displayName || "Chọn chức vụ"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 ${className}`}>
          <span>{getSelectedDisplayName()}</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Traditional levels */}
        <div className="px-3 py-1 text-xs text-gray-500 font-medium">
          Cấp bậc truyền thống
        </div>
        {[
          { level: PositionLevel.INTERN, displayName: "Thực tập sinh" },
          { level: PositionLevel.JUNIOR, displayName: "Nhân viên" },
          { level: PositionLevel.SENIOR, displayName: "Nhân viên cao cấp" },
          { level: PositionLevel.LEAD, displayName: "Trưởng nhóm" },
          { level: PositionLevel.MANAGER, displayName: "Quản lý" },
          { level: PositionLevel.DIRECTOR, displayName: "Giám đốc" },
          { level: PositionLevel.EXECUTIVE, displayName: "Điều hành" },
        ].map((item) => (
          <DropdownMenuItem
            key={item.level}
            onClick={() => onSelect(item.level)}
            className={
              selectedLevel === item.level
                ? "bg-blue-100 text-blue-800 font-medium"
                : ""
            }
          >
            {item.displayName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
