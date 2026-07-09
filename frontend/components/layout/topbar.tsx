"use client"

import * as React from "react"
import { Bell, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "./mode-toggle"

/**
 * Lightweight operations topbar. Holds the site context (single-site today;
 * multi-site switcher is a roadmap P0 item) plus the dark-mode toggle and a
 * notifications bell placeholder (notification center is roadmap P6).
 */
export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/40">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-medium text-sidebar-foreground">Bãi đỗ xe trung tâm</span>
        <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Đơn bãi
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          disabled
          title="Trung tâm thông báo — sắp ra mắt"
          aria-label="Thông báo"
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
        </Button>
        <ModeToggle />
      </div>
    </header>
  )
}
