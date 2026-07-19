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
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import {
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Cpu,
  Layers,
  Loader2
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
    <AdminPage className="min-h-dvh">
      <AdminPageHeader
        eyebrow="MODULE // QUẢN TRỊ"
        title="DANH SÁCH KHU VỰC"
        description="Địa điểm / cơ sở thuộc tổ chức — không phải cổng ra/vào. Cổng (Gate) gắn với từng khu vực để giám sát phương tiện."
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        actions={
          <div className="flex shrink-0 items-start justify-end gap-2.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 w-10 border-border bg-card text-slate-700 hover:text-foreground hover:bg-muted rounded-xl p-0 transition-all shadow-none shrink-0"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={openCreate}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-10 px-4 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>ADD_SITE</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {/* Section 1: Overview Dashboard Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

            <div className="p-2.5 rounded-lg bg-muted/80 border border-border text-cyan-600 shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">ACTIVE_SITES_COUNT</p>
              <p className="text-xl font-mono font-bold text-foreground tracking-tight">{sites.length} PHÂN KHU</p>
            </div>
          </div>
          <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-emerald-200 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-emerald-200 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-emerald-200 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-emerald-200 transition-colors" />

            <div className="p-2.5 rounded-lg bg-muted/80 border border-border text-emerald-700 shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">SYS_LIMITS</p>
              <p className="text-xs font-mono font-bold text-slate-700 leading-normal uppercase">GIỚI HẠN THEO GÓI KHAI THÁC</p>
            </div>
          </div>
          <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 sm:col-span-2 lg:col-span-1 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-amber-200 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-amber-200 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-amber-200 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-amber-200 transition-colors" />

            <div className="p-2.5 rounded-lg bg-muted/80 border border-border text-amber-700 shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">INTEGRATION_STATUS</p>
              <p className="text-xs font-mono font-bold text-emerald-700 leading-normal uppercase">GATEWAY_CONNECTED</p>
            </div>
          </div>
        </div>

        {/* Section 2: Sites List Panel */}
        <section className="border border-border bg-card text-foreground shadow-xl rounded-xl relative overflow-hidden backdrop-blur-xl" aria-label="Danh sách khu vực">
          {/* Cyber ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border" />

          {/* Cyber grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />

          <div className="border-b border-border px-5 py-4 sm:px-6 flex items-center justify-between relative z-10">
            <div>
              <h2 className="text-xs font-mono tracking-wider text-cyan-600 uppercase">SITE_REGISTRY // THÔNG TIN KHU VỰC THÀNH VIÊN</h2>
              <p className="mt-1 font-mono text-[10px] text-slate-500 uppercase">
                Quản lý phân khu độc lập được đồng bộ trực tiếp lên gateway kiểm soát bãi đỗ.
              </p>
            </div>
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest hidden sm:inline">[NODE_COUNT: {sites.length}]</span>
          </div>

          <div className="p-5 sm:p-6 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 font-mono text-xs text-cyan-600">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">SYNCHRONIZING_DATABASE...</span>
              </div>
            ) : sites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border rounded-xl bg-background/10 gap-3">
                <MapPinned className="h-8 w-8 text-slate-600 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-mono text-cyan-600 uppercase tracking-wider">NO_SITES_FOUND // CHƯA CÓ KHU VỰC NÀO</p>
                  <p className="text-[10px] font-mono text-slate-500 uppercase max-w-sm leading-normal">
                    Tạo khu vực đầu tiên để bắt đầu liên kết các cổng thông tin, luồng camera giám sát và quản lý trạng thái bãi đỗ xe.
                  </p>
                </div>
                <Button
                  onClick={openCreate}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-9 px-4 rounded-lg mt-2 flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  INITIALIZE_FIRST_SITE
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => (
                  <article
                    key={site.id}
                    className="border border-border bg-muted/80 rounded-xl p-5 relative overflow-hidden group hover:border-cyan-200 transition-all duration-300 shadow-lg"
                  >
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-border group-hover:border-cyan-300 transition-colors" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-border group-hover:border-cyan-300 transition-colors" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-border group-hover:border-cyan-300 transition-colors" />
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-border group-hover:border-cyan-300 transition-colors" />

                    <div className="flex justify-between items-start border-b border-border pb-3.5 mb-3.5">
                      <div className="space-y-1">
                        <span className="font-mono text-[9px] text-slate-500 tracking-wider block">
                          [SITE_{site.id.substring(0, 8).toUpperCase()}]
                        </span>
                        <h3 className="text-sm font-mono font-bold text-foreground group-hover:text-cyan-600 transition-colors uppercase tracking-wide">
                          {site.name}
                        </h3>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse mt-1" />
                    </div>

                    <div className="flex items-start gap-2.5 min-h-[36px] mb-4">
                      <MapPinned className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-mono text-[8px] text-slate-500 block uppercase">OPERATIONAL_ADDRESS</span>
                        <p className="text-[11px] font-mono text-muted-foreground uppercase leading-relaxed break-words">
                          {site.location || "UNSPECIFIED // CHƯA KHAI BÁO VỊ TRÍ"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end border-t border-border pt-3.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(site)}
                        className="border-border bg-background text-slate-700 hover:text-foreground hover:bg-muted font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                      >
                        <Pencil className="mr-1 h-3 w-3 text-cyan-600" />
                        EDIT
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(site)}
                        className="border-border bg-background text-rose-700 hover:text-rose-300 hover:bg-rose-50/50 font-mono text-[10px] uppercase h-8 px-3 rounded-lg border-rose-200"
                      >
                        <Trash2 className="mr-1 h-3 w-3 text-rose-700" />
                        DELETE
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border border-border bg-background text-foreground shadow-sm relative overflow-hidden backdrop-blur-xl max-w-md">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-200" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-200" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-200" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-200" />

          <DialogHeader className="border-b border-border pb-3 mb-4">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-600 uppercase flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-cyan-600" />
              {editing ? "EDIT_SITE // CẬP NHẬT KHU VỰC" : "CREATE_SITE // THÊM KHU VỰC"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name" className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase pl-0.5">
                TÊN KHU VỰC / CƠ SỞ
              </Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VÍ DỤ: CƠ SỞ QUẬN 1"
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location" className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase pl-0.5">
                ĐỊA CHỈ / VỊ TRÍ TRẠM VẬN HÀNH (TUỲ CHỌN)
              </Label>
              <Input
                id="site-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VÍ DỤ: 123 ĐƯỜNG ABC, QUẬN 1"
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs shadow-inner"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-border bg-background/60 hover:bg-muted text-slate-700 hover:text-foreground font-mono text-xs uppercase h-10 px-4 rounded-lg transition-all"
            >
              HỦY
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-10 px-5 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-white" />
              )}
              <span>{saving ? "SAVING..." : editing ? "UPDATE" : "CREATE"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border border-border bg-background text-foreground shadow-sm relative overflow-hidden backdrop-blur-xl max-w-md">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-rose-200" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-rose-200" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-rose-200" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-rose-200" />

          <DialogHeader className="border-b border-border pb-3 mb-4">
            <DialogTitle className="text-sm font-mono tracking-wider text-rose-700 uppercase flex items-center gap-2">
              <Trash2 className="h-4 w-4 shrink-0 text-rose-500" />
              DELETE_CONFIRMATION // XÓA KHU VỰC?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs font-mono text-slate-700 uppercase leading-relaxed">
              Bạn có chắc chắn muốn giải phóng và xóa khu vực: <span className="text-rose-700 font-bold">&quot;{deleteTarget?.name}&quot;</span>?
            </p>
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed uppercase">
              [!] CẢNH BÁO: HÀNH ĐỘNG NÀY CÓ THỂ LÀM ẢNH HƯỜNG TRỰC TIẾP ĐẾN CÁC CỔNG KIỂM SOÁT (GATES) VÀ THIẾT BỊ CAMERA ĐANG LIÊN KẾT VỚI PHÂN KHU NÀY. KHÔNG THỂ KHÔI PHỤC DỮ LIỆU ĐÃ XÓA.
            </p>
          </div>
          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border bg-background/60 hover:bg-muted text-slate-700 hover:text-foreground font-mono text-xs uppercase h-10 px-4 rounded-lg transition-all"
            >
              HỦY
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={saving}
              className="bg-rose-500 hover:bg-rose-600 text-foreground font-mono font-bold uppercase tracking-wider text-xs h-10 px-5 rounded-lg transition-all shadow-lg hover:shadow-rose-500/20 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-foreground" />
              )}
              <span>{saving ? "DELETING..." : "CONFIRM_DELETE"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}
