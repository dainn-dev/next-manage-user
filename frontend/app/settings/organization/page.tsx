"use client"

import { useCallback, useEffect, useState } from "react"
import {
  tenantSettingsApi,
  type TenantSettings,
} from "@/lib/api/tenant-settings-api"
import {
  MANAGEMENT_MODELS,
  managementModelLabel,
} from "@/lib/management-models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useToast } from "@/hooks/use-toast"
import {
  RefreshCw,
  Save,
  Building2,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  Loader2,
  Activity
} from "lucide-react"

export default function OrganizationSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [name, setName] = useState("")
  const [managementModel, setManagementModel] = useState("")
  const [areaCount, setAreaCount] = useState("1")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await tenantSettingsApi.getMe()
      setSettings(data)
      setName(data.name)
      setManagementModel(data.managementModel || "")
      setAreaCount(String(data.areaCount ?? 1))
    } catch (error) {
      toast({
        title: "Không tải được hồ sơ tổ chức",
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedArea = Number.parseInt(areaCount, 10)
    if (!name.trim() || !managementModel || Number.isNaN(parsedArea)) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền tên, mô hình và số khu vực ước lượng.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const updated = await tenantSettingsApi.updateMe({
        name: name.trim(),
        managementModel,
        areaCount: parsedArea,
      })
      setSettings(updated)
      toast({ title: "Đã lưu hồ sơ tổ chức" })
    } catch (error) {
      toast({
        title: "Lưu thất bại",
        description: error instanceof Error ? error.message : "Lỗi không xác định",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !settings) {
    return (
      <AdminPage>
        <div className="flex min-h-[40vh] items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900">
          <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">FETCHING_PROFILE...</span>
          </div>
        </div>
      </AdminPage>
    )
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="MODULE // THIẾT LẬP"
        title="HỒ SƠ TỔ CHỨC"
        description="Thông tin cấu hình doanh nghiệp và quy mô khai báo hệ thống. Quản trị phân khu thực tế được điều phối tại màn hình phân khu."
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
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {/* Section 1: Read-Only Meta Data Surface */}
        <section className="space-y-4" aria-label="Thông tin tổ chức chỉ đọc">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              01 // THÔNG TIN ĐỊNH DANH (SYS_READ_ONLY)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              PLATFORM_MANAGED_METRICS
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Mã Định Danh (Slug)",
                value: settings?.slug ?? "—",
                code: "TENANT_SLUG",
                icon: Database,
                color: "cyan"
              },
              {
                label: "Trạng Thái Hệ Thống",
                value: settings?.status ?? "—",
                code: "CONN_STATUS",
                icon: ShieldCheck,
                color: "emerald"
              },
              {
                label: "Gói Dịch Vụ",
                value: settings?.planName || settings?.planCode || "—",
                code: "SERVICE_LEVEL",
                icon: Cpu,
                color: "cyan"
              },
              {
                label: "Quy Mô Khai Báo",
                value: `${settings?.siteCount ?? 0} Site`,
                sub: settings?.areaCount != null ? `Khai báo ~${settings.areaCount} khu vực` : undefined,
                code: "DEPLOYED_NODES",
                icon: Layers,
                color: "slate"
              }
            ].map((item) => (
              <div
                key={item.label}
                className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 hover:border-slate-700/60 group"
              >
                {/* Tech ticks */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

                <div className="flex items-center justify-between gap-2 border-b border-slate-900/60 pb-3 mb-3">
                  <div className="space-y-0.5">
                    <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">{item.code}</p>
                    <p className="text-[11px] font-mono tracking-wide text-slate-300 uppercase">{item.label}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                </div>

                <p className="text-sm font-mono font-bold text-white tracking-wide break-words select-all uppercase">
                  {item.value}
                </p>
                {item.sub && (
                  <p className="text-[10px] font-mono text-slate-500 mt-1 leading-normal uppercase">
                    {item.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Editable Profile Form Surface */}
        <section className="space-y-4" aria-label="Chỉnh sửa hồ sơ tổ chức">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              02 // CẬP NHẬT THÔNG TIN HỒ SƠ (PROFILE_CONFIGURATION)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              SECURE_WRITE_GATEWAY
            </span>
          </div>

          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
            {/* Tech brackets */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-500/30" />

            <div className="mb-6 border-b border-slate-900 pb-4">
              <h2 className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-cyan-500" />
                EDIT_ORGANIZATION_METADATA // CHỈNH SỬA THÔNG TIN DOANH NGHIỆP
              </h2>
              <p className="mt-1.5 font-mono text-[10px] text-slate-400 leading-relaxed uppercase">
                Mô hình quản lý nghiệp vụ hiện hành:{" "}
                <span className="text-cyan-400 font-bold">
                  {managementModelLabel(settings?.managementModel)}
                </span>
                . Số lượng khu vực cấu hình chỉ mang tính chất thống kê ước lượng ban đầu.
              </p>
            </div>

            <form onSubmit={submit} className="w-full max-w-2xl space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="org-name"
                  className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5"
                >
                  TÊN TỔ CHỨC / DOANH NGHIỆP
                </Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={150}
                  required
                  placeholder="VÍ DỤ: VINHOMES METROPOLIS..."
                  className="bg-slate-950/70 border-slate-800 text-cyan-100 placeholder-slate-700 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 tracking-wide text-xs shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5">
                  MÔ HÌNH VẬN HÀNH QUẢN LÝ
                </Label>
                <Select value={managementModel} onValueChange={setManagementModel}>
                  <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-11 rounded-lg">
                    <SelectValue placeholder="CHỌN MÔ HÌNH..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    {MANAGEMENT_MODELS.map((model) => (
                      <SelectItem
                        key={model.value}
                        value={model.value}
                        className="focus:bg-slate-900 font-mono text-xs text-slate-200"
                      >
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="area-count"
                  className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5"
                >
                  SỐ KHU VỰC ƯỚC LƯỢNG (CAPACITY_HINT)
                </Label>
                <Input
                  id="area-count"
                  type="number"
                  min={1}
                  max={999}
                  value={areaCount}
                  onChange={(e) => setAreaCount(e.target.value)}
                  required
                  className="bg-slate-950/70 border-slate-800 text-cyan-100 placeholder-slate-700 font-mono h-11 rounded-lg focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 tracking-wide text-xs shadow-inner"
                />
                <p className="font-mono text-[9px] text-slate-500 uppercase leading-normal tracking-wide pt-1">
                  [!] GIỚI HẠN PHÂN KHU ĐỖ XE THẬT SẼ ĐƯỢC ĐỊNH DANH THEO GÓI KHAI THÁC THANH TOÁN (MAX_SITES) CỦA DOANH NGHIỆP.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-900 flex justify-end">
                <Button
                  className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-11 px-6 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-40"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  ) : (
                    <Save className="h-4 w-4 text-slate-950" />
                  )}
                  <span>{saving ? "SAVING_CHANGES..." : "SAVE_CONFIGURATION"}</span>
                </Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </AdminPage>
  )
}
