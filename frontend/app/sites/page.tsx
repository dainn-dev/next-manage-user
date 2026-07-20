"use client"

import { useCallback, useEffect, useState } from "react"
import { siteApi, type Site } from "@/lib/api/site-api"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Building2,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

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
      const payload = { name: name.trim(), location: location.trim() || undefined }
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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Quản trị tổ chức"
        title="Khu vực vận hành"
        description="Quản lý địa điểm và cơ sở thuộc tổ chức. Cổng ra vào được liên kết với từng khu vực."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Làm mới
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              Thêm khu vực
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Tổng quan khu vực">
        <Card className="bg-primary-container/35">
          <CardContent className="flex items-center gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng khu vực</p>
              <p className="text-2xl font-semibold text-foreground">{sites.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <MapPinned className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Danh mục khu vực</p>
              <p className="mt-1 text-sm text-muted-foreground">Cập nhật tên và vị trí để quản lý cơ sở rõ ràng hơn.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="gap-2 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Danh sách khu vực</CardTitle>
              <CardDescription className="mt-1">Các cơ sở hiện có trong tổ chức của bạn.</CardDescription>
            </div>
            <Badge variant="secondary">{sites.length} khu vực</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Đang tải danh sách khu vực.</p>
            </div>
          ) : sites.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <MapPinned className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">Chưa có khu vực nào</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Tạo khu vực đầu tiên để bắt đầu liên kết cổng và cấu hình vận hành tại cơ sở.
                </p>
              </div>
              <Button onClick={openCreate}>
                <Plus />
                Thêm khu vực đầu tiên
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sites.map((site) => (
                <article key={site.id} className="rounded-xl border border-border bg-muted/25 p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-foreground">{site.name}</h3>
                      <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                        <MapPinned className="mt-1 size-4 shrink-0" aria-hidden="true" />
                        <span>{site.location || "Chưa khai báo vị trí"}</span>
                      </p>
                    </div>
                    <Badge variant="outline">Đang dùng</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
                    <Button variant="outline" size="sm" onClick={() => openEdit(site)}>
                      <Pencil />
                      Chỉnh sửa
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(site)}>
                      <Trash2 />
                      Xóa
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật khu vực" : "Thêm khu vực"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="site-name">Tên khu vực hoặc cơ sở</Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cơ sở Quận 1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-location">Địa chỉ hoặc vị trí</Label>
              <Input
                id="site-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ví dụ: 123 Đường ABC, Quận 1"
              />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:flex">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              {saving ? "Đang lưu" : editing ? "Lưu thay đổi" : "Tạo khu vực"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa khu vực?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Bạn có chắc chắn muốn xóa khu vực <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
            </p>
            <p>Hành động này có thể ảnh hưởng đến cổng và camera đang liên kết với khu vực này.</p>
          </div>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:flex">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {saving ? "Đang xóa" : "Xóa khu vực"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}
