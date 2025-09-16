"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface AdvancedExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: AdvancedExportOptions) => void
}

interface AdvancedExportOptions {
  selectedFields: string[]
  format: string
  includePassword: boolean
  password?: string
  encryptFile: boolean
  maxRecords: number
}

const FIELD_OPTIONS = [
  { id: "basicInfo", label: "Thông tin cơ bản", checked: true },
  { id: "employeeId", label: "ID Quân nhân", checked: false },
  { id: "name", label: "Tên", checked: true },
  { id: "lastName", label: "Họ", checked: false },
  { id: "phone", label: "Số điện thoại", checked: true },
  { id: "gender", label: "Giới tính", checked: true },
  { id: "birthDate", label: "Sinh nhật", checked: true },
  { id: "cardNumber", label: "Số hiệu quân nhân", checked: true },
  { id: "email", label: "Email", checked: true },
  { id: "idNumber", label: "Số chứng chỉ", checked: true },
  { id: "position", label: "Tên chức vụ", checked: true },
  { id: "birthDate2", label: "Ngày nhập ngũ", checked: true },
  { id: "officePhone", label: "Office Phone", checked: false },
  { id: "jobTitle", label: "Job Title", checked: false },
  { id: "street", label: "Street", checked: false },
  { id: "officeAddress", label: "Office Address", checked: false },
  { id: "birthplace", label: "Birthplace", checked: false },
  { id: "hireType", label: "Hire Type", checked: false },
  { id: "homePhone", label: "Home Phone", checked: false },
  { id: "homeAddress", label: "Home Address", checked: false },
  { id: "country", label: "Country", checked: false },
]

export function AdvancedExportDialog({ isOpen, onClose, onExport }: AdvancedExportDialogProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>(
    FIELD_OPTIONS.filter((field) => field.checked).map((field) => field.id),
  )
  const [format, setFormat] = useState("EXCEL")
  const [includePassword, setIncludePassword] = useState(false)
  const [password, setPassword] = useState("")
  const [encryptFile, setEncryptFile] = useState(false)
  const [maxRecords, setMaxRecords] = useState(100)

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      setSelectedFields((prev) => [...prev, fieldId])
    } else {
      setSelectedFields((prev) => prev.filter((id) => id !== fieldId))
    }
  }

  const handleExport = () => {
    onExport({
      selectedFields,
      format,
      includePassword,
      password,
      encryptFile,
      maxRecords,
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Tải xuống mẫu nhập Quân nhân</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Field Selection */}
          <div className="grid grid-cols-4 gap-4">
            {FIELD_OPTIONS.map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={field.id}
                  checked={selectedFields.includes(field.id)}
                  onCheckedChange={(checked) => handleFieldToggle(field.id, checked as boolean)}
                />
                <Label htmlFor={field.id} className="text-sm">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>

          {/* Export Options */}
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thuộc tính tùy chỉnh</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="officePhone" />
                    <Label htmlFor="officePhone" className="text-sm">
                      Office Phone
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="jobTitle" />
                    <Label htmlFor="jobTitle" className="text-sm">
                      Job Title
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="street" />
                    <Label htmlFor="street" className="text-sm">
                      Street
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="birthplace" />
                    <Label htmlFor="birthplace" className="text-sm">
                      Birthplace
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="country" />
                    <Label htmlFor="country" className="text-sm">
                      Country
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="homePhone" />
                    <Label htmlFor="homePhone" className="text-sm">
                      Home Phone
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="homeAddress" />
                    <Label htmlFor="homeAddress" className="text-sm">
                      Home Address
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="officePhone2" />
                    <Label htmlFor="officePhone2" className="text-sm">
                      Office Phone
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mật khẩu người dùng</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mã hóa tập tin</Label>
                  <RadioGroup
                    value={encryptFile ? "yes" : "no"}
                    onValueChange={(value) => setEncryptFile(value === "yes")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="encrypt-yes" />
                      <Label htmlFor="encrypt-yes">Có</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="encrypt-no" />
                      <Label htmlFor="encrypt-no">Không</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Mật khẩu mã hóa tập tin</Label>
                  <div className="flex items-center space-x-2">
                    <Input type="password" placeholder="••••••••" />
                    <Button variant="outline" size="sm">
                      🔄
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Định dạng tập</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXCEL">EXCEL</SelectItem>
                      <SelectItem value="PDF">PDF</SelectItem>
                      <SelectItem value="CSV">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dữ liệu để xuất</Label>
                  <RadioGroup defaultValue="all">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="export-all" />
                      <Label htmlFor="export-all">Tất cả (tối đa 100000 bản ghi)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Tổng số bản ghi</Label>
                  <Input
                    type="number"
                    value={maxRecords}
                    onChange={(e) => setMaxRecords(Number.parseInt(e.target.value) || 100)}
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
