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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, Save } from "lucide-react"

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
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tổ chức</h1>
          <p className="text-sm text-muted-foreground">
            Hồ sơ tổ chức và quy mô khai báo khi đăng ký. Số khu vực thật quản lý ở trang Khu vực.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin chỉ đọc</CardTitle>
          <CardDescription>Slug và trạng thái do nền tảng quản lý.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Slug</div>
            <div className="font-medium">{settings?.slug ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Trạng thái</div>
            <div className="font-medium">{settings?.status ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Gói hiện tại</div>
            <div className="font-medium">
              {settings?.planName || settings?.planCode || "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Quy mô</div>
            <div className="font-medium">
              Đã có {settings?.siteCount ?? 0} khu vực
              {settings?.areaCount != null
                ? ` / khai báo ~${settings.areaCount} khu vực`
                : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chỉnh sửa hồ sơ</CardTitle>
          <CardDescription>
            Mô hình quản lý: {managementModelLabel(settings?.managementModel)}. Số khu vực
            khai báo là ước lượng, không tự tạo site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="org-name">Tên tổ chức</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mô hình quản lý</Label>
              <Select value={managementModel} onValueChange={setManagementModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mô hình" />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-count">Số khu vực ước lượng</Label>
              <Input
                id="area-count"
                type="number"
                min={1}
                max={999}
                value={areaCount}
                onChange={(e) => setAreaCount(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Hint quy mô — giới hạn site thật theo gói thanh toán (max_sites), không theo số này.
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
