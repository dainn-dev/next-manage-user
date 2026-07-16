/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
 * page: audit · data-form: filter command row + responsive event ledger · enrichment: none
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, ScrollText } from "lucide-react"

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
  const [action, setAction] = useState("all")
  const [resourceType, setResourceType] = useState("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [actionInput, setActionInput] = useState("")

  useEffect(() => {
    const queryResource = new URLSearchParams(window.location.search).get("resourceType")
    if (queryResource === "tenant" || queryResource === "platform_admin") {
      setResourceType(queryResource)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await platformApi.listAudit({
        page,
        size: 30,
        action: action === "all" ? undefined : action,
        resourceType: resourceType === "all" ? undefined : resourceType,
      })
      setRows(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch (error) {
      toast({
        title: "Không tải được audit log",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [action, page, resourceType, toast])

  useEffect(() => {
    void load()
  }, [load])

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
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            data-state={loading ? "loading" : "default"}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            {loading ? "Đang tải" : "Làm mới"}
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {loading ? "Đang tải audit log" : `Đã tải ${totalElements} audit entry`}
      </p>

      <div className="platform-toolbar">
        <Input
          className="min-w-0 flex-1 basis-64"
          aria-label="Lọc theo action"
          placeholder="Lọc action"
          value={actionInput}
          onChange={(event) => setActionInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyActionFilter()
          }}
        />
        <Select
          value={resourceType}
          onValueChange={(value) => {
            setPage(0)
            setResourceType(value)
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Lọc resource type">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả resource</SelectItem>
            <SelectItem value="tenant">tenant</SelectItem>
            <SelectItem value="platform_admin">platform_admin</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={applyActionFilter}>Áp dụng</Button>
      </div>

      <section aria-label="Audit entries" className="platform-data-surface">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[72rem] text-sm">
            <caption className="sr-only">Platform audit entries</caption>
            <thead className="text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">Time</th>
                <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Resource</th>
                <th scope="col" className="px-4 py-3 font-medium sm:pr-6">Detail</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-70" : undefined}>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Không có audit entry khớp bộ lọc.
                  </td>
                </tr>
              )}
              {rows.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground sm:px-6">
                    {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">{entry.actorUsername || "—"}</td>
                  <td className="platform-mono px-4 py-3 text-xs font-semibold">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.resourceType}
                    {entry.resourceId ? <div className="platform-mono mt-1 max-w-64 break-all text-xs">{entry.resourceId}</div> : null}
                  </td>
                  <td className="max-w-md px-4 py-3 sm:pr-6">
                    <pre className="platform-mono whitespace-pre-wrap break-all text-xs leading-5 text-muted-foreground">
                      {formattedDetail(entry.detail)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="platform-mobile-list lg:hidden">
          {!loading && rows.length === 0 && (
            <div className="platform-empty-state">
              <ScrollText className="size-5" aria-hidden="true" />
              <p>Không có audit entry khớp bộ lọc.</p>
            </div>
          )}
          {rows.map((entry) => (
            <article key={entry.id} className="platform-mobile-card">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="platform-mono truncate text-xs font-semibold">{entry.action}</h2>
                  <p className="mt-1 truncate text-sm">{entry.actorUsername || "—"}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                </time>
              </div>
              <div className="min-w-0 text-xs text-muted-foreground">
                <p>{entry.resourceType}</p>
                {entry.resourceId && <p className="platform-mono mt-1 break-all">{entry.resourceId}</p>}
              </div>
              <details className="group rounded-[var(--radius-input)] border border-border bg-card p-3">
                <summary className="cursor-pointer text-sm font-medium">Chi tiết entry</summary>
                <pre className="platform-mono mt-3 whitespace-pre-wrap break-all text-xs leading-5 text-muted-foreground">
                  {formattedDetail(entry.detail)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      </section>

      <div className="platform-pagination">
        <span>{totalElements} entry · trang {page + 1}/{Math.max(totalPages, 1)}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Trước
          </Button>
          <Button variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  )
}
