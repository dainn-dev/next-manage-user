"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SettingsFormProps {
  onSave: (settings: any) => void
}

export function SettingsForm({ onSave }: SettingsFormProps) {
  const [settings, setSettings] = useState({
    passwordLength: 9,
    supportFingerprint: "no",
    autoGenerateId: "yes",
    displayFormat: "decimal",
    allowMultipleUsers: "no",
  })

  const handleSubmit = () => {
    onSave(settings)
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-lg">👤</span>
            </div>
            Cài đặt ID nhân sự
          </CardTitle>
          <p className="text-sm text-muted-foreground">Cấu hình các thông số cho mã nhân viên</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Độ dài tối đa</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={settings.passwordLength}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, passwordLength: Number.parseInt(e.target.value) || 9 }))
                  }
                  className="w-24"
                  min="1"
                  max="20"
                />
                <span className="text-sm text-muted-foreground">ký tự</span>
              </div>
              <p className="text-xs text-muted-foreground">Số ký tự tối đa cho mã nhân viên</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Hỗ trợ ký tự đặc biệt</Label>
              <RadioGroup
                value={settings.supportFingerprint}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, supportFingerprint: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="support-yes" />
                  <Label htmlFor="support-yes" className="text-sm">Có</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="support-no" />
                  <Label htmlFor="support-no" className="text-sm">Không</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Cho phép sử dụng ký tự đặc biệt trong mã</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">ID nhân sự tự động tăng</Label>
            <RadioGroup
              value={settings.autoGenerateId}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, autoGenerateId: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="auto-yes" />
                <Label htmlFor="auto-yes" className="text-sm">Có</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="auto-no" />
                <Label htmlFor="auto-no" className="text-sm">Không</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Tự động tạo mã nhân viên theo thứ tự tăng dần</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-green-100 bg-green-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-lg">💳</span>
            </div>
            Cài đặt thẻ
          </CardTitle>
          <p className="text-sm text-muted-foreground">Cấu hình các thông số cho thẻ nhân viên</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Hiển thị định dạng thẻ</Label>
              <RadioGroup
                value={settings.displayFormat}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, displayFormat: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="decimal" id="format-decimal" />
                  <Label htmlFor="format-decimal" className="text-sm">Số thập phân</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hex" id="format-hex" />
                  <Label htmlFor="format-hex" className="text-sm">Hệ thập lục phân</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Định dạng hiển thị số thẻ</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Nhiều thẻ mỗi người</Label>
              <RadioGroup
                value={settings.allowMultipleUsers}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, allowMultipleUsers: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="multiple-yes" />
                  <Label htmlFor="multiple-yes" className="text-sm">Có</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="multiple-no" />
                  <Label htmlFor="multiple-no" className="text-sm">Không</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Cho phép một người có nhiều thẻ</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4">
        <Button onClick={handleSubmit} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium">
          <span className="mr-2">💾</span>
          Lưu cài đặt
        </Button>
      </div>
    </div>
  )
}
