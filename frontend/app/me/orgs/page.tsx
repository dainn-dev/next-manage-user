"use client"

import { useEffect, useMemo, useState } from "react"
import { memberApi, type MemberVehicleGarageItem } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"

export default function MemberOrgsPage() {
  const [items, setItems] = useState<MemberVehicleGarageItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await memberApi.listVehicles()
        if (!cancelled) setItems(data)
      } catch (e) {
        toast({
          title: "Không tải được đăng ký",
          description: e instanceof Error ? e.message : "Lỗi không xác định",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  const byOrg = useMemo(() => {
    const map = new Map<string, { name: string; plates: string[] }>()
    for (const v of items) {
      for (const org of v.registeredAt || []) {
        const key = org.tenantId
        const entry = map.get(key) || { name: org.tenantName || key, plates: [] }
        entry.plates.push(v.licensePlate)
        map.set(key, entry)
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
  }, [items])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Đăng ký tại org</h1>
        <p className="text-sm text-muted-foreground">
          Các tổ chức (trọ, trường…) đã đưa biển của bạn vào trang quản lý.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : byOrg.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có đăng ký tại tổ chức nào.</p>
      ) : (
        <ul className="space-y-5">
          {byOrg.map((org) => (
            <li key={org.id} className="border-b border-border/60 pb-4 last:border-0">
              <p className="font-medium">{org.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{org.plates.join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
