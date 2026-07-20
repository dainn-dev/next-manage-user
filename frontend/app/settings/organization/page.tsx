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
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Building2,
  Layers,
  Loader2,
  PackageCheck,
  RefreshCw,
  Save,
  Tag,
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
        <Card className="min-h-64 justify-center">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Đang tải hồ sơ tổ chức</p>
              <p className="mt-1 text-sm text-muted-foreground">Vui lòng chờ trong giây lát.</p>
            </div>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  const overviewMetrics = [
    {
      label: "Mã tổ chức",
      value: settings?.slug ?? "—",
      note: "Định danh của tổ chức",
      icon: Tag,
      tone: "primary",
    },
    {
      label: "Gói dịch vụ",
      value: settings?.planName || settings?.planCode || "—",
      note: "Gói dịch vụ đang áp dụng",
      icon: PackageCheck,
      tone: "warning",
    },
    {
      label: "Khu vực đã tạo",
      value: (settings?.siteCount ?? 0).toLocaleString("vi-VN"),
      note: "Đang được cấu hình trong hệ thống",
      icon: Building2,
      tone: "success",
    },
    {
      label: "Quy mô khai báo",
      value: (settings?.areaCount ?? 0).toLocaleString("vi-VN"),
      note: "Số khu vực theo hồ sơ tổ chức",
      icon: Layers,
      tone: "serious",
    },
  ] as const

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Thiết lập tổ chức"
        title="Hồ sơ tổ chức"
        description="Cập nhật thông tin doanh nghiệp và quy mô vận hành khai báo cho tổ chức của bạn."
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới"
            title="Làm mới"
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        }
      />

      <DashboardMetricsSection
        id="organization-overview"
        title="Thông tin hệ thống"
        description="Các thông tin được quản lý ở cấp tổ chức và gói dịch vụ."
        badge={<Badge variant="secondary">Trạng thái: {settings?.status ?? "Chưa xác định"}</Badge>}
        metrics={overviewMetrics}
      />

      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa hồ sơ</CardTitle>
          <CardDescription>
            Mô hình đang áp dụng: {managementModelLabel(settings?.managementModel)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid max-w-3xl gap-5">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Tên tổ chức hoặc doanh nghiệp</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                required
                placeholder="Ví dụ: Vinhomes Metropolis"
              />
            </div>

            <div className="grid gap-2">
              <Label>Mô hình vận hành quản lý</Label>
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

            <div className="grid gap-2">
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
              <p className="text-sm leading-6 text-muted-foreground">
                Giới hạn khu vực thực tế được xác định theo gói dịch vụ của tổ chức.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "Đang lưu" : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AdminPage>
  )
}
