"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Info,
  Loader2,
  MapPin,
  Navigation,
} from "lucide-react"

export default function MemberVisitDetailPage() {
  const params = useParams()
  const sessionId = String(params.sessionId || "")
  const [session, setSession] = useState<MemberParkingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await memberApi.getSession(sessionId)
        if (!cancelled) setSession(data)
      } catch (e) {
        toast({
          title: "Không tải được phiên",
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
  }, [sessionId, toast])

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader>
          <Link
            href="/me/visit"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[var(--radius-input)] px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Quay lại liên kết vé
          </Link>
          <p className="mt-3 text-xs font-semibold tracking-wide text-primary">Phiên gửi xe</p>
          <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Xe đang ở đâu?</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">
            Xem thông tin phiên gửi xe và vị trí mà bãi đỗ đang cập nhật cho bạn.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card className="min-h-56 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải thông tin phiên gửi xe...</p>
          </CardContent>
        </Card>
      ) : !session ? (
        <Card className="min-h-56 justify-center border-dashed">
          <CardContent className="mx-auto flex max-w-lg flex-col items-center gap-3 py-3 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <Info className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Không tìm thấy phiên gửi xe</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Vui lòng kiểm tra lại mã vé hoặc liên hệ với bộ phận quản lý bãi đỗ.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
          <Card className="gap-5 lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Thông tin phiên gửi xe</CardTitle>
                <CardDescription className="mt-1">Cập nhật từ hệ thống bãi đỗ</CardDescription>
              </div>
              <Badge
                variant={session.status === "active" || session.status === "ACTIVE" ? "secondary" : "outline"}
                className={cn(
                  "self-start",
                  (session.status === "active" || session.status === "ACTIVE") && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
                )}
              >
                <span className={cn("size-2 rounded-full", session.status === "active" || session.status === "ACTIVE" ? "bg-emerald-600" : "bg-muted-foreground")} aria-hidden="true" />
                {session.status || "Chưa xác định"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/45 p-4 sm:p-5">
                <p className="text-sm font-medium text-muted-foreground">Biển số phương tiện</p>
                <p className="mt-1 text-3xl font-bold tracking-wide text-foreground sm:text-4xl">{session.licensePlate}</p>
              </div>

              <dl className="grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Bãi đỗ / tổ chức</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm font-medium leading-6 text-foreground">
                    <Building2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{session.tenantName || session.tenantId || "Chưa xác định"}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Thời gian vào bãi</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{session.startedAt ? new Date(session.startedAt).toLocaleString("vi-VN") : "—"}</span>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="min-h-64 gap-4 bg-muted/35">
            <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <div className="row-span-2 grid size-10 place-items-center rounded-full bg-primary-container text-primary">
                <Navigation className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">Vị trí xe</CardTitle>
              <CardDescription>Thông tin vị trí do bãi đỗ cung cấp</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-5">
              <div>
                <p className="text-sm text-muted-foreground">Ô đỗ hiện tại</p>
                {session.locationLabel ? (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-container/55 p-3 text-sm font-semibold leading-6 text-on-primary-container">
                    <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{session.locationLabel}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Xe đã vào bãi. Hệ thống đang xác định ô đỗ của bạn.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                Vị trí có thể thay đổi khi bãi đỗ cập nhật dữ liệu mới.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
