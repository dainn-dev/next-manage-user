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
              className="h-10 w-10 border-slate-800 bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl p-0 transition-all shadow-none shrink-0"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={openCreate}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-10 px-4 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4 text-slate-950" />
              <span>ADD_SITE</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {/* Section 1: Overview Dashboard Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-900 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-900 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-900 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-900 group-hover:border-cyan-500/30 transition-colors" />

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">ACTIVE_SITES_COUNT</p>
              <p className="text-xl font-mono font-bold text-white tracking-tight">{sites.length} PHÂN KHU</p>
            </div>
          </div>
          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-900 group-hover:border-emerald-500/30 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-900 group-hover:border-emerald-500/30 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-900 group-hover:border-emerald-500/30 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-900 group-hover:border-emerald-500/30 transition-colors" />

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">SYS_LIMITS</p>
              <p className="text-xs font-mono font-bold text-slate-300 leading-normal uppercase">GIỚI HẠN THEO GÓI KHAI THÁC</p>
            </div>
          </div>
          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex items-center gap-4 sm:col-span-2 lg:col-span-1 group">
            {/* Corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-900 group-hover:border-amber-500/30 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-900 group-hover:border-amber-500/30 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-900 group-hover:border-amber-500/30 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-900 group-hover:border-amber-500/30 transition-colors" />

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">INTEGRATION_STATUS</p>
              <p className="text-xs font-mono font-bold text-emerald-400 leading-normal uppercase">GATEWAY_CONNECTED</p>
            </div>
          </div>
        </div>

        {/* Section 2: Sites List Panel */}
        <section className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl relative overflow-hidden backdrop-blur-xl" aria-label="Danh sách khu vực">
          {/* Cyber ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800" />

          {/* Cyber grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />

          <div className="border-b border-slate-900 px-5 py-4 sm:px-6 flex items-center justify-between relative z-10">
            <div>
              <h2 className="text-xs font-mono tracking-wider text-cyan-400 uppercase">SITE_REGISTRY // THÔNG TIN KHU VỰC THÀNH VIÊN</h2>
              <p className="mt-1 font-mono text-[10px] text-slate-500 uppercase">
                Quản lý phân khu độc lập được đồng bộ trực tiếp lên gateway kiểm soát bãi đỗ.
              </p>
            </div>
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest hidden sm:inline">[NODE_COUNT: {sites.length}]</span>
          </div>

          <div className="p-5 sm:p-6 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 font-mono text-xs text-cyan-400">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">SYNCHRONIZING_DATABASE...</span>
              </div>
            ) : sites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10 gap-3">
                <MapPinned className="h-8 w-8 text-slate-600 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-mono text-cyan-400 uppercase tracking-wider">NO_SITES_FOUND // CHƯA CÓ KHU VỰC NÀO</p>
                  <p className="text-[10px] font-mono text-slate-500 uppercase max-w-sm leading-normal">
                    Tạo khu vực đầu tiên để bắt đầu liên kết các cổng thông tin, luồng camera giám sát và quản lý trạng thái bãi đỗ xe.
                  </p>
                </div>
                <Button
                  onClick={openCreate}
                  className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-9 px-4 rounded-lg mt-2 flex items-center gap-1.5"
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
                    className="border border-slate-855 bg-slate-950/80 rounded-xl p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300 shadow-lg"
                  >
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-800 group-hover:border-cyan-500/40 transition-colors" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-800 group-hover:border-cyan-500/40 transition-colors" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-800 group-hover:border-cyan-500/40 transition-colors" />
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-800 group-hover:border-cyan-500/40 transition-colors" />

                    <div className="flex justify-between items-start border-b border-slate-900/60 pb-3.5 mb-3.5">
                      <div className="space-y-1">
                        <span className="font-mono text-[9px] text-slate-500 tracking-wider block">
                          [SITE_{site.id.substring(0, 8).toUpperCase()}]
                        </span>
                        <h3 className="text-sm font-mono font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wide">
                          {site.name}
                        </h3>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse mt-1" />
                    </div>

                    <div className="flex items-start gap-2.5 min-h-[36px] mb-4">
                      <MapPinned className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-mono text-[8px] text-slate-500 block uppercase">OPERATIONAL_ADDRESS</span>
                        <p className="text-[11px] font-mono text-slate-400 uppercase leading-relaxed break-words">
                          {site.location || "UNSPECIFIED // CHƯA KHAI BÁO VỊ TRÍ"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end border-t border-slate-900/40 pt-3.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(site)}
                        className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-900 font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                      >
                        <Pencil className="mr-1 h-3 w-3 text-cyan-400" />
                        EDIT
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(site)}
                        className="border-slate-800 bg-slate-950 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 font-mono text-[10px] uppercase h-8 px-3 rounded-lg border-rose-950/20"
                      >
                        <Trash2 className="mr-1 h-3 w-3 text-rose-400" />
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
        <DialogContent className="border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl relative overflow-hidden backdrop-blur-xl max-w-md">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-500/30" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-500/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-500/30" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-500/30" />

          <DialogHeader className="border-b border-slate-900 pb-3 mb-4">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-cyan-500" />
              {editing ? "EDIT_SITE // CẬP NHẬT KHU VỰC" : "CREATE_SITE // THÊM KHU VỰC"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name" className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5">
                TÊN KHU VỰC / CƠ SỞ
              </Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VÍ DỤ: CƠ SỞ QUẬN 1"
                className="bg-slate-950/70 border-slate-800 text-cyan-100 placeholder-slate-700 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 tracking-wide text-xs shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location" className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5">
                ĐỊA CHỈ / VỊ TRÍ TRẠM VẬN HÀNH (TUỲ CHỌN)
              </Label>
              <Input
                id="site-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VÍ DỤ: 123 ĐƯỜNG ABC, QUẬN 1"
                className="bg-slate-950/70 border-slate-800 text-cyan-100 placeholder-slate-700 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 tracking-wide text-xs shadow-inner"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-900 pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white font-mono text-xs uppercase h-10 px-4 rounded-lg transition-all"
            >
              HỦY
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-10 px-5 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-950" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-slate-950" />
              )}
              <span>{saving ? "SAVING..." : editing ? "UPDATE" : "CREATE"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl relative overflow-hidden backdrop-blur-xl max-w-md">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-rose-500/30" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-rose-500/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-rose-500/30" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-rose-500/30" />

          <DialogHeader className="border-b border-slate-900 pb-3 mb-4">
            <DialogTitle className="text-sm font-mono tracking-wider text-rose-400 uppercase flex items-center gap-2">
              <Trash2 className="h-4 w-4 shrink-0 text-rose-500" />
              DELETE_CONFIRMATION // XÓA KHU VỰC?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs font-mono text-slate-300 uppercase leading-relaxed">
              Bạn có chắc chắn muốn giải phóng và xóa khu vực: <span className="text-rose-400 font-bold">&quot;{deleteTarget?.name}&quot;</span>?
            </p>
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed uppercase">
              [!] CẢNH BÁO: HÀNH ĐỘNG NÀY CÓ THỂ LÀM ẢNH HƯỜNG TRỰC TIẾP ĐẾN CÁC CỔNG KIỂM SOÁT (GATES) VÀ THIẾT BỊ CAMERA ĐANG LIÊN KẾT VỚI PHÂN KHU NÀY. KHÔNG THỂ KHÔI PHỤC DỮ LIỆU ĐÃ XÓA.
            </p>
          </div>
          <DialogFooter className="border-t border-slate-900 pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white font-mono text-xs uppercase h-10 px-4 rounded-lg transition-all"
            >
              HỦY
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={saving}
              className="bg-rose-500 hover:bg-rose-600 text-white font-mono font-bold uppercase tracking-wider text-xs h-10 px-5 rounded-lg transition-all shadow-lg hover:shadow-rose-500/20 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-white" />
              )}
              <span>{saving ? "DELETING..." : "CONFIRM_DELETE"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}
