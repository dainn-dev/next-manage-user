"use client"

import { useCallback, useEffect, useState } from "react"
import { platformApi, type PlatformAuditEntry } from "@/lib/api/platform-api"
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
import { RefreshCw } from "lucide-react"

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
        title: "Không tải được audit",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [action, page, resourceType, toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
          <p className="text-sm text-muted-foreground">
            Log hành động platform (onboard, rename, status, admin CRUD).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Lọc action (Enter)"
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(0)
              setAction(actionInput.trim() || "all")
            }
          }}
        />
        <Select
          value={resourceType}
          onValueChange={(value) => {
            setPage(0)
            setResourceType(value)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả resource</SelectItem>
            <SelectItem value="tenant">tenant</SelectItem>
            <SelectItem value="platform_admin">platform_admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setPage(0)
            setAction(actionInput.trim() || "all")
          }}
        >
          Áp dụng
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Không có entry.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">{entry.actorUsername || "—"}</td>
                  <td className="px-4 py-3 font-medium">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.resourceType}
                    {entry.resourceId ? (
                      <div className="font-mono text-xs">{entry.resourceId}</div>
                    ) : null}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <pre className="whitespace-pre-wrap break-all text-xs text-muted-foreground">
                      {entry.detail || "{}"}
                    </pre>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalElements} · trang {page + 1}/{Math.max(totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  )
}
