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
      <Card>
        <CardHeader>
          <CardTitle>Cài đặt ID nhân sự</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Độ dài tối đa:</Label>
            <Input
              type="number"
              value={settings.passwordLength}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, passwordLength: Number.parseInt(e.target.value) || 9 }))
              }
              className="w-32"
            />
          </div>

          <div className="space-y-3">
            <Label>Hỗ trợ kí tự:</Label>
            <RadioGroup
              value={settings.supportFingerprint}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, supportFingerprint: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="support-yes" />
                <Label htmlFor="support-yes">Có</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="support-no" />
                <Label htmlFor="support-no">Không</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>ID nhân sự tự động tăng:</Label>
            <RadioGroup
              value={settings.autoGenerateId}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, autoGenerateId: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="auto-yes" />
                <Label htmlFor="auto-yes">Có</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="auto-no" />
                <Label htmlFor="auto-no">Không</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cài đặt thẻ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Hiển thị định dạng thẻ:</Label>
            <RadioGroup
              value={settings.displayFormat}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, displayFormat: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="decimal" id="format-decimal" />
                <Label htmlFor="format-decimal">Số thập phân</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hex" id="format-hex" />
                <Label htmlFor="format-hex">Hệ thập lục phân</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Nhiều thẻ mỗi người:</Label>
            <RadioGroup
              value={settings.allowMultipleUsers}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, allowMultipleUsers: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="multiple-yes" />
                <Label htmlFor="multiple-yes">Có</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="multiple-no" />
                <Label htmlFor="multiple-no">Không</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleSubmit} className="px-8">
          OK
        </Button>
      </div>
    </div>
  )
}
