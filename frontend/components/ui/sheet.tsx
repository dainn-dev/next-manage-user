"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  )
}

type SheetSide = "top" | "right" | "bottom" | "left"

const sideClasses: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 max-h-[calc(100dvh-1rem)] rounded-b-[var(--radius-sheet)] border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  right: "inset-y-0 right-0 h-dvh w-[min(22rem,calc(100%-2rem))] rounded-l-[var(--radius-sheet)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  bottom: "inset-x-0 bottom-0 max-h-[calc(100dvh-1rem)] rounded-t-[var(--radius-sheet)] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  left: "inset-y-0 left-0 h-dvh w-[min(20rem,calc(100%-2rem))] rounded-r-[var(--radius-sheet)] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
}

function SheetContent({ className, children, side = "right", ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: SheetSide }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-[calc(var(--z-modal)+1)] flex flex-col border-border bg-card text-card-foreground shadow-[var(--shadow-overlay)] outline-none duration-[var(--dur-short)] ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex shrink-0 items-start justify-between gap-3 border-b border-border p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="sheet-title" className={cn("text-base font-semibold", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="sheet-description" className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />
}

function SheetDismissButton({ className, label = "Đóng" }: { className?: string; label?: string }) {
  return (
    <DialogPrimitive.Close
      data-slot="sheet-close"
      aria-label={label}
      className={cn("grid size-11 shrink-0 place-items-center rounded-[var(--radius-input)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      <X className="size-5" aria-hidden="true" />
    </DialogPrimitive.Close>
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetDismissButton,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
