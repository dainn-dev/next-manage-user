"use client"

import { useEffect, useState } from "react"
import { memberApi, type MemberVehicleGarageItem } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"

export default function MemberGaragePage() {
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
          title: "Không tải được danh sách xe",
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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Xe của tôi</h1>
        <p className="text-sm text-muted-foreground">
          Hồ sơ xe trên ParkVision và các tổ chức đã đăng ký biển của bạn.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có xe. Khi nhà trọ / trường đăng ký biển của bạn, xe sẽ hiện tại đây.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((v) => (
            <li
              key={v.vehicleId}
              className="border-b border-border/60 pb-4 last:border-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-medium tracking-wide">{v.licensePlate}</p>
                <p className="text-xs uppercase text-muted-foreground">{v.status}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[v.brand, v.model, v.color, v.vehicleType].filter(Boolean).join(" · ") || "—"}
              </p>
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Đăng ký tại
                </p>
                {v.registeredAt?.length ? (
                  <ul className="mt-1 space-y-1 text-sm">
                    {v.registeredAt.map((org) => (
                      <li key={`${v.vehicleId}-${org.tenantId}`}>
                        {org.tenantName || org.tenantId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Chưa đăng ký tại org nào</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
