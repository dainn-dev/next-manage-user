"use client"

import { useCallback, useEffect, useState } from "react"
import { memberApi, type MemberVehicleGarageItem } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  BookmarkCheck,
  Building2,
  Car,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react"

export default function MemberGaragePage() {
  const [items, setItems] = useState<MemberVehicleGarageItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await memberApi.listVehicles()
      setItems(data)
    } catch (e) {
      toast({
        title: "Không tải được danh sách xe",
        description: e instanceof Error ? e.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary">Khu vực thành viên</p>
            <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Xe của tôi</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              Xem phương tiện đã đăng ký và những tổ chức đang cấp quyền đỗ xe cho bạn.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới danh sách xe"
            title="Làm mới danh sách xe"
            className="shrink-0 self-start sm:self-center"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </CardHeader>
      </Card>

      {loading ? (
        <Card className="min-h-56 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải danh sách phương tiện...</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="min-h-56 justify-center border-dashed">
          <CardContent className="mx-auto flex max-w-lg flex-col items-center gap-3 py-3 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Car className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Chưa có phương tiện nào</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Khi ban quản lý đăng ký biển số của bạn, phương tiện sẽ tự động xuất hiện tại đây.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((vehicle) => {
            const isActive = vehicle.status === "active" || vehicle.status === "ACTIVE"
            const vehicleName = [vehicle.brand, vehicle.model, vehicle.color]
              .filter(Boolean)
              .join(" · ")

            return (
              <Card key={vehicle.vehicleId} className="gap-4 transition-shadow hover:shadow-md">
                <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                  <div className="row-span-2 grid size-11 place-items-center rounded-full bg-primary-container text-primary">
                    <Car className="size-5" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {vehicleName || "Hồ sơ phương tiện"}
                    </CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {vehicle.vehicleType || "Chưa xác định"}
                    </Badge>
                  </div>
                  <CardDescription className="truncate">
                    Mã hồ sơ: {vehicle.vehicleId}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/45 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Biển số xe</p>
                    <p className="mt-1 text-xl font-bold tracking-wide text-foreground sm:text-2xl">
                      {vehicle.licensePlate}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="size-4 shrink-0" aria-hidden="true" />
                      <span>Đăng ký tại tổ chức</span>
                    </div>
                    <Badge
                      variant={isActive ? "secondary" : "outline"}
                      className={cn(
                        "font-medium",
                        isActive && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
                      )}
                    >
                      {vehicle.status || "Chưa xác định"}
                    </Badge>
                  </div>

                  {vehicle.registeredAt?.length ? (
                    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Tổ chức đã đăng ký">
                      {vehicle.registeredAt.map((organization) => (
                        <li
                          key={`${vehicle.vehicleId}-${organization.tenantId}`}
                          className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm"
                        >
                          <BookmarkCheck className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                          <span className="truncate" title={organization.tenantName || organization.tenantId}>
                            {organization.tenantName || organization.tenantId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-sm leading-6 text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <p>Phương tiện này chưa liên kết với tổ chức nào trên hệ thống.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
