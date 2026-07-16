"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, DoorOpen, MapPin, RefreshCw, Radio, Monitor } from "lucide-react"
import { gateApi, isGateOnline, type Gate } from "@/lib/api/gate-api"
import { ErrorBoundary } from "@/components/error-boundary"

const REFRESH_INTERVAL_MS = 30000

function GateList() {
  const [gates, setGates] = useState<Gate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gateApi.getGates()
      setGates(data)
      setError(null)
    } catch {
      setError(
        "Không thể tải danh sách cổng. Bạn cần quyền quản trị (ADMIN) để xem trang này.",
      )
    } finally {
      setLoading(false)
      setNow(Date.now())
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      load()
    }, REFRESH_INTERVAL_MS)
    // Re-tick the clock every 15s so the online/offline badge decays even between
    // full refreshes.
    const tick = setInterval(() => setNow(Date.now()), 15000)
    return () => {
      clearInterval(id)
      clearInterval(tick)
    }
  }, [load])

  const onlineCount = gates.filter((g) => isGateOnline(g, now)).length

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
              <DoorOpen className="h-6 w-6 text-blue-600" />
              Cổng kiểm soát
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Chọn một cổng để mở màn hình kiosk hiển thị realtime.
              {gates.length > 0 && (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {onlineCount}/{gates.length}
                  </span>{" "}
                  cổng đang trực tuyến.
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href="/gate/health" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                <Activity className="h-4 w-4 mr-2" />
                Sức khỏe cổng
              </Button>
            </Link>
            <Button variant="outline" onClick={load} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && gates.length === 0 && !error && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Đang tải danh sách cổng…
          </div>
        )}

        {!loading && gates.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <DoorOpen className="h-10 w-10 mb-2 opacity-50" />
            <p>Chưa có cổng nào được đăng ký.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gates.map((gate) => {
            const online = isGateOnline(gate, now)
            return (
              <Card key={gate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          online ? "bg-emerald-100" : "bg-slate-100"
                        }`}
                      >
                        <Radio
                          className={`h-5 w-5 ${
                            online ? "text-emerald-600" : "text-slate-400"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground">{gate.name}</h3>
                        {gate.location && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{gate.location}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${
                        online
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : gate.status === "disabled"
                            ? "border-slate-300 bg-slate-50 text-slate-500"
                            : "border-red-300 bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                          online
                            ? "bg-emerald-500 animate-pulse"
                            : gate.status === "disabled"
                              ? "bg-slate-400"
                              : "bg-red-500"
                        }`}
                      />
                      {online
                        ? "Trực tuyến"
                        : gate.status === "disabled"
                          ? "Vô hiệu"
                          : "Ngoại tuyến"}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground mb-4">
                    {gate.lastHeartbeatAt ? (
                      <>
                        Nhịp cuối:{" "}
                        {new Date(gate.lastHeartbeatAt).toLocaleString("vi-VN")}
                      </>
                    ) : (
                      "Chưa nhận nhịp tim"
                    )}
                  </div>

                  <Link href={`/gate/${gate.id}`}>
                    <Button className="w-full" size="sm">
                      <Monitor className="h-4 w-4 mr-2" />
                      Mở kiosk
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function GatePage() {
  return (
    <ErrorBoundary>
      <GateList />
    </ErrorBoundary>
  )
}
