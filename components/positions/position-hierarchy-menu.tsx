"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronRight } from "lucide-react"
import { PositionLevel } from "@/lib/types"

interface HierarchyItem {
  level: PositionLevel
  displayName: string
  children?: HierarchyItem[]
}

interface PositionHierarchyMenuProps {
  onSelect: (level: PositionLevel) => void
  selectedLevel?: PositionLevel
  className?: string
}

const POSITION_HIERARCHY: HierarchyItem[] = [
  {
    level: PositionLevel.CHUC_VU,
    displayName: "Chức vụ",
    children: [
      {
        level: PositionLevel.SI_QUAN,
        displayName: "Sĩ quan",
        children: [
          { level: PositionLevel.TRUNG_DOI, displayName: "Trung đội" },
          { level: PositionLevel.DAI_DOI, displayName: "Đại đội" },
          { level: PositionLevel.TIEU_DOAN, displayName: "Tiểu đoàn" },
          { level: PositionLevel.TRUNG_DOAN, displayName: "Trung đoàn" },
          { level: PositionLevel.CO_QUAN_SQ, displayName: "Cơ quan (SQ)" },
        ]
      },
      {
        level: PositionLevel.QNCN,
        displayName: "QNCN",
        children: [
          { level: PositionLevel.TIEU_DOAN_QNCN, displayName: "Tiểu đoàn (QNCN)" },
          {
            level: PositionLevel.CO_QUAN_QNCN,
            displayName: "Cơ quan (QNCN)",
            children: [
              { level: PositionLevel.THAM_MUU, displayName: "Tham mưu" },
              { level: PositionLevel.CHINH_TRI, displayName: "Chính trị" },
              { level: PositionLevel.HAU_CAN_KY_THUAT, displayName: "Hậu cần - Kỹ thuật" },
            ]
          },
        ]
      },
    ]
  },
]

interface MenuItemProps {
  item: HierarchyItem
  onSelect: (level: PositionLevel) => void
  selectedLevel?: PositionLevel
  depth?: number
}

function MenuItem({ item, onSelect, selectedLevel, depth = 0 }: MenuItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showSubmenu, setShowSubmenu] = useState(false)
  const hasChildren = item.children && item.children.length > 0
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    
    setIsHovered(true)
    if (hasChildren) {
      // Add slight delay before showing submenu to prevent accidental triggers
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = setTimeout(() => setShowSubmenu(true), 100)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    
    if (hasChildren) {
      // Add delay before hiding submenu to allow user to move to it
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        setShowSubmenu(false)
      }, 200)
    } else {
      setShowSubmenu(false)
    }
    
    // Clear show timeout if user leaves before submenu appears
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`
          flex items-center justify-between px-3 py-2 text-sm cursor-pointer
          transition-colors duration-150
          ${selectedLevel === item.level 
            ? 'bg-blue-100 text-blue-800 font-medium' 
            : 'hover:bg-gray-100 text-gray-700'
          }
          ${depth > 0 ? 'pl-6' : ''}
        `}
        onClick={() => onSelect(item.level)}
      >
        <span>{item.displayName}</span>
        {hasChildren && (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Submenu */}
      {hasChildren && (isHovered || showSubmenu) && (
        <div 
          className={`
            absolute ${depth === 0 ? 'left-full top-0' : 'left-full top-0'}
            min-w-[200px] bg-white border border-gray-200 rounded-md shadow-lg z-50
            py-1 transition-all duration-200 ease-in-out
          `}
          data-submenu="true"
          onMouseEnter={() => {
            // Clear hide timeout when entering submenu
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current)
              hideTimeoutRef.current = null
            }
            setShowSubmenu(true)
            setIsHovered(true)
          }}
          onMouseLeave={() => {
            // Add delay before hiding when leaving submenu
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = setTimeout(() => {
              setShowSubmenu(false)
              setIsHovered(false)
            }, 150)
          }}
        >
          {item.children!.map((child) => (
            <MenuItem
              key={child.level}
              item={child}
              onSelect={onSelect}
              selectedLevel={selectedLevel}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PositionHierarchyMenu({ 
  onSelect, 
  selectedLevel, 
  className = "" 
}: PositionHierarchyMenuProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md shadow-lg py-1 ${className}`}>
      {POSITION_HIERARCHY.map((item) => (
        <MenuItem
          key={item.level}
          item={item}
          onSelect={onSelect}
          selectedLevel={selectedLevel}
        />
      ))}
      
      {/* Separator */}
      <div className="border-t border-gray-200 my-1" />
      
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
        <div
          key={item.level}
          className={`
            px-3 py-2 text-sm cursor-pointer transition-colors duration-150
            ${selectedLevel === item.level 
              ? 'bg-blue-100 text-blue-800 font-medium' 
              : 'hover:bg-gray-100 text-gray-700'
            }
          `}
          onClick={() => onSelect(item.level)}
        >
          {item.displayName}
        </div>
      ))}
    </div>
  )
}
