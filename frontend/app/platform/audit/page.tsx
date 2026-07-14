"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, RefreshCw, ScrollText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { platformApi, type PlatformAuditEntry } from "@/lib/api/platform-api"

function formattedDetail(detail?: string | null): string {
  if (!detail) return "{}"
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}

export default function PlatformAuditPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<PlatformAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [action, setAction] = useState("all")
  const [actionInput, setActionInput] = useState("")
  const [resourceType, setResourceType] = useState("all")
  const [resourceId, setResourceId] = useState("")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qResource = params.get("resourceType")
    if (qResource === "tenant" || qResource === "platform_admin") setResourceType(qResource)
    const qId = params.get("resourceId")
    if (qId) setResourceId(qId)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const data = await platformApi.listAudit({
        page,
        size: 30,
        action: action === "all" ? undefined : action,
        resourceType: resourceType === "all" ? undefined : resourceType,
        resourceId: resourceId.trim() || undefined,
      })
      setRows(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch {
      setHasError(true)
      toast({ title: "Không tải được audit log", description: "Hãy thử lại.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [action, page, resourceType, resourceId, toast])

  useEffect(() => { void load() }, [load])

  const applyActionFilter = () => {
    setPage(0)
    setAction(actionInput.trim() || "all")
  }

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Platform audit</h1>
          <p className="platform-page-description">
            Nhật ký hành động control-plane — onboarding, rename, lifecycle và quản lý platform admin.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}
            data-state={loading ? "loading" : "default"}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải audit log" : `Hiển thị ${totalElements} audit entry`}
      </p>

      <div className="platform-toolbar flex-wrap gap-2">
        <div className="flex flex-1 basis-48 gap-2">
          <Input
            placeholder="Lọc theo action…"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyActionFilter()}
            className="flex-1"
          />
          <Button variant="outline" onClick={applyActionFilter}>Áp dụng</Button>
        </div>
        <Select value={resourceType} onValueChange={(v) => { setPage(0); setResourceType(v) }}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Resource type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả resource</SelectItem>
            <SelectItem value="tenant">tenant</SelectItem>
            <SelectItem value="platform_admin">platform_admin</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Resource ID (UUID)…"
          value={resourceId}
          onChange={(e) => { setPage(0); setResourceId(e.target.value) }}
          className="w-full sm:w-[260px] platform-mono text-xs"
        />
      </div>

      {/* Error state — distinct from empty */}
      {!loading && hasError && (
        <div className="platform-data-surface flex items-center gap-3 px-6 py-10 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>Không tải được audit log.</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>Thử lại</Button>
        </div>
      )}

      {/* Empty state — distinct from error */}
      {!loading && !hasError && rows.length === 0 && (
        <div className="platform-data-surface">
          <div className="platform-empty-state">
            <ScrollText className="size-5" aria-hidden="true" />
            <p>
              {action !== "all" || resourceType !== "all" || resourceId.trim()
                ? "Không tìm thấy audit entry nào khớp bộ lọc."
                : "Chưa có audit entry. Các thay đổi platform sẽ xuất hiện ở đây."}
            </p>
          </div>
        </div>
      )}

      {(loading || (!hasError && rows.length > 0)) && (
        <div className="platform-data-surface hidden overflow-x-auto md:block">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Platform audit log</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-6">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60" : undefined}>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Đang tải…</td>
                </tr>
              )}
              {!loading && rows.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground sm:px-6 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    {entry.actorUsername || (entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—")}
                  </td>
                  <td className="platform-mono px-4 py-3 text-xs font-medium">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="platform-mono text-xs">{entry.resourceType}</span>
                    {entry.resourceId && (
                      <span className="platform-mono ml-1 text-xs opacity-60">
                        {entry.resourceId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Xem
                      </summary>
                      <pre className="platform-mono mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all text-xs">
                        {formattedDetail(entry.detail)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile list */}
      {!loading && !hasError && rows.length > 0 && (
        <div className="platform-data-surface md:hidden">
          <div className="platform-mobile-list">
            {rows.map((entry) => (
              <article key={entry.id} className="platform-mobile-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="platform-mono text-xs font-semibold">{entry.action}</p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                  </time>
                </div>
                <p className="text-sm">
                  {entry.actorUsername || (entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—")}
                </p>
                <p className="platform-mono text-xs text-muted-foreground">
                  {entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ""}
                </p>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Detail</summary>
                  <pre className="platform-mono mt-1 whitespace-pre-wrap break-all text-xs">
                    {formattedDetail(entry.detail)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="text-sm text-muted-foreground">{totalElements} entries</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Trước
            </Button>
            <span className="flex items-center px-2 text-sm">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
