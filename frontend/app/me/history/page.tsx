"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  History,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

interface MetricCardProps {
  label: string
  value: string | number
  note: string
  icon: LucideIcon
  tone?: "primary" | "success" | "neutral" | "warning"
}

function MetricCard({ label, value, note, icon: Icon, tone = "primary" }: MetricCardProps) {
  const toneClasses = {
    primary: "bg-primary-container text-primary",
    success: "bg-emerald-100 text-emerald-800",
    neutral: "bg-muted text-muted-foreground",
    warning: "bg-amber-100 text-amber-800",
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        </div>
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-full", toneClasses[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function MemberHistoryPage() {
  const [sessions, setSessions] = useState<MemberParkingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await memberApi.listSessions()
      setSessions(data)
    } catch (e) {
      toast({
        title: "Không tải được lịch sử",
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

  const stats = useMemo(() => {
    const total = sessions.length
    const active = sessions.filter((session) => session.status === "active" || session.status === "ACTIVE").length
    const completed = total - active
    const latestTenant = sessions[0]?.tenantName || "Chưa có"

    return { total, active, completed, latestTenant }
  }, [sessions])

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions
    const query = searchTerm.toLowerCase().trim()
    return sessions.filter((session) => {
      const plateMatch = session.licensePlate?.toLowerCase().includes(query)
      const tenantMatch = session.tenantName?.toLowerCase().includes(query)
      const sessionMatch = session.sessionId?.toLowerCase().includes(query)
      return plateMatch || tenantMatch || sessionMatch
    })
  }, [sessions, searchTerm])

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary">Khu vực thành viên</p>
            <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Lịch sử gửi xe</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              Theo dõi các phiên gửi xe đã liên kết và xem lại vị trí đỗ xe khi cần.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới lịch sử gửi xe"
            title="Làm mới lịch sử gửi xe"
            className="shrink-0 self-start sm:self-center"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </CardHeader>
      </Card>

      {loading && sessions.length === 0 ? (
        <Card className="min-h-56 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Đang tải lịch sử gửi xe...</p>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="min-h-56 justify-center border-dashed">
          <CardContent className="mx-auto flex max-w-lg flex-col items-center gap-3 py-3 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <History className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Chưa có lịch sử gửi xe</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Những phiên gửi xe bạn liên kết sẽ được lưu lại tại đây.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan lịch sử gửi xe">
            <MetricCard label="Tổng số lượt gửi" value={stats.total} note="Tất cả phiên đã ghi nhận" icon={History} />
            <MetricCard label="Đang trong bãi" value={stats.active} note="Phiên đang hoạt động" icon={PlayCircle} tone="success" />
            <MetricCard label="Đã hoàn thành" value={stats.completed} note="Phiên đã kết thúc" icon={CheckCircle2} tone="neutral" />
            <MetricCard label="Bãi đỗ gần nhất" value={stats.latestTenant} note="Tổ chức liên kết gần đây" icon={Building2} tone="warning" />
          </section>

          <Card className="gap-3 py-4">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label="Tìm kiếm lịch sử"
                  placeholder="Tìm theo biển số, bãi đỗ hoặc mã phiên"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-11 pl-10 text-sm"
                />
              </div>
              {searchTerm && (
                <Button variant="outline" onClick={() => setSearchTerm("")} className="h-11 shrink-0">
                  <X className="size-4" aria-hidden="true" />
                  Xóa tìm kiếm
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4">
              <div>
                <CardTitle className="text-base">Các phiên gửi xe</CardTitle>
                <CardDescription className="mt-1">
                  Hiển thị {filteredSessions.length} trên {sessions.length} phiên
                </CardDescription>
              </div>
            </CardHeader>

            {filteredSessions.length === 0 ? (
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Không tìm thấy phiên gửi xe phù hợp.</p>
              </CardContent>
            ) : (
              <div className="divide-y divide-border">
                {filteredSessions.map((session) => {
                  const isActive = session.status === "active" || session.status === "ACTIVE"
                  return (
                    <Link
                      key={session.sessionId}
                      href={`/me/visit/${session.sessionId}`}
                      className="group block p-4 transition-colors hover:bg-accent/60 sm:px-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-sm font-semibold tracking-wide text-foreground">
                              {session.licensePlate}
                            </span>
                            <Badge
                              variant={isActive ? "secondary" : "outline"}
                              className={cn(isActive && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100")}
                            >
                              {session.status || "Đã hoàn thành"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{session.tenantName || "ParkVision"}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {session.startedAt ? new Date(session.startedAt).toLocaleString("vi-VN") : "Chưa có thời gian vào bãi"}
                          </p>
                        </div>
                        <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
