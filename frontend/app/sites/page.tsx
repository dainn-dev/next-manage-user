"use client"

import { useCallback, useEffect, useState } from "react"
import { siteApi, type Site } from "@/lib/api/site-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { MapPinned, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

export default function SitesPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Site | null>(null)
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSites(await siteApi.list())
    } catch (error) {
      toast({
        title: "Không tải được danh sách khu vực",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setName("")
    setLocation("")
    setDialogOpen(true)
  }

  const openEdit = (site: Site) => {
    setEditing(site)
    setName(site.name)
    setLocation(site.location || "")
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Tên khu vực là bắt buộc", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        location: location.trim() || undefined,
      }
      if (editing) {
        await siteApi.update(editing.id, payload)
        toast({ title: "Đã cập nhật khu vực" })
      } else {
        await siteApi.create(payload)
        toast({ title: "Đã tạo khu vực" })
      }
      setDialogOpen(false)
      await load()
    } catch (error) {
      toast({
        title: editing ? "Cập nhật thất bại" : "Tạo khu vực thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await siteApi.delete(deleteTarget.id)
      toast({ title: "Đã xóa khu vực" })
      setDeleteTarget(null)
      await load()
    } catch (error) {
      toast({
        title: "Xóa thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="platform-page">
      <header className="platform-page-header">
        <div className="min-w-0">
          <h1 className="platform-page-title">Khu vực (Sites)</h1>
          <p className="platform-page-description">
            Địa điểm / cơ sở thuộc tổ chức — không phải cổng ra/vào. Cổng (Gate) gắn với từng khu vực.
          </p>
        </div>
        <div className="platform-page-actions">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm khu vực
          </Button>
        </div>
      </header>

      <section className="platform-data-surface" aria-label="Danh sách khu vực">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold">Danh sách khu vực</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Số lượng bị giới hạn bởi gói thanh toán (max_sites), không bởi số khu vực khai báo khi đăng ký.
          </p>
        </div>
        <div className="platform-mobile-list">
          {loading ? (
            <div className="platform-empty-state">Đang tải…</div>
          ) : sites.length === 0 ? (
            <div className="platform-empty-state">Chưa có khu vực nào. Tạo khu vực đầu tiên để gắn cổng và camera.</div>
          ) : (
            sites.map((site) => (
                <article
                  key={site.id}
                  className="platform-mobile-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <MapPinned className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{site.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {site.location || "Chưa có địa chỉ"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(site)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(site)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Xóa
                    </Button>
                  </div>
                </article>
              ))
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khu vực" : "Thêm khu vực"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Tên khu vực / cơ sở</Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cơ sở Quận 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location">Địa chỉ (tuỳ chọn)</Label>
              <Input
                id="site-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Địa chỉ hoặc mô tả vị trí"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa khu vực?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Xóa &quot;{deleteTarget?.name}&quot; có thể ảnh hưởng cổng và dữ liệu gắn với khu vực này.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? "Đang xóa…" : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
