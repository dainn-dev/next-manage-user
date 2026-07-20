"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Building2, Car, Loader2, RefreshCw } from "lucide-react"

export default function MemberOrgsPage() {
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
        title: "Không tải được đăng ký",
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

  const byOrg = useMemo(() => {
    const map = new Map<string, { name: string; plates: string[] }>()
    for (const vehicle of items) {
      for (const organization of vehicle.registeredAt || []) {
        const key = organization.tenantId
        const entry = map.get(key) || {
          name: organization.tenantName || key,
          plates: [],
        }
        entry.plates.push(vehicle.licensePlate)
        map.set(key, entry)
      }
    }
    return Array.from(map.entries()).map(([id, value]) => ({ id, ...value }))
  }, [items])

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary">Khu vực thành viên</p>
            <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Đăng ký tại tổ chức</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              Tra cứu các tổ chức nơi phương tiện của bạn được cấp quyền ra vào bãi đỗ xe.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới danh sách tổ chức"
            title="Làm mới danh sách tổ chức"
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
            <p className="text-sm text-muted-foreground">Đang tải các tổ chức đã liên kết...</p>
          </CardContent>
        </Card>
      ) : byOrg.length === 0 ? (
        <Card className="min-h-56 justify-center border-dashed">
          <CardContent className="mx-auto flex max-w-lg flex-col items-center gap-3 py-3 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Building2 className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Chưa có tổ chức liên kết</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Tài khoản của bạn chưa được ghi nhận trong danh sách thành viên của tổ chức nào.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byOrg.map((organization) => (
            <Card key={organization.id} className="gap-4 transition-shadow hover:shadow-md">
              <CardHeader className="grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base leading-6">{organization.name}</CardTitle>
                  <CardDescription className="mt-1 truncate">Mã tổ chức: {organization.id}</CardDescription>
                </div>
                <div className="grid size-11 place-items-center rounded-full bg-primary-container text-primary">
                  <Building2 className="size-5" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Car className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span>Biển số được phép</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {organization.plates.map((plate) => (
                      <Badge key={plate} variant="secondary" className="bg-primary-container text-on-primary-container">
                        {plate}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-emerald-800">
                  <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>Liên kết đang hoạt động</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
