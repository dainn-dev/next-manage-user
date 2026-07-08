"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { employeeApi } from "@/lib/api/employee-api"
import { vehicleApi } from "@/lib/api/vehicle-api"
import { downloadBlob } from "@/lib/utils/download-blob"

type ExportEntity = "employee" | "vehicle"

interface FieldOption {
  id: string
  label: string
  default: boolean
}

interface AdvancedExportDialogProps {
  isOpen: boolean
  onClose: () => void
  // Which dataset to export. Field list + backend endpoint are chosen from this.
  entity?: ExportEntity
  // Called after a successful export (optional)
  onExported?: () => void
}

// Field ids must match the backend column registry keys
// (EmployeeExportService / VehicleExportService).
const EMPLOYEE_FIELDS: FieldOption[] = [
  { id: "employeeId", label: "Mã quân nhân", default: true },
  { id: "name", label: "Họ tên", default: true },
  { id: "firstName", label: "Tên", default: false },
  { id: "lastName", label: "Họ", default: false },
  { id: "email", label: "Email", default: true },
  { id: "phone", label: "Số điện thoại", default: true },
  { id: "department", label: "Đơn vị", default: true },
  { id: "position", label: "Chức vụ", default: true },
  { id: "rank", label: "Cấp bậc", default: true },
  { id: "jobTitle", label: "Chức danh", default: false },
  { id: "militaryCivilian", label: "SQ/QNCN", default: false },
  { id: "gender", label: "Giới tính", default: false },
  { id: "birthDate", label: "Ngày sinh", default: false },
  { id: "hireDate", label: "Ngày nhập ngũ", default: false },
  { id: "address", label: "Địa chỉ", default: false },
  { id: "status", label: "Trạng thái", default: true },
]

const VEHICLE_FIELDS: FieldOption[] = [
  { id: "licensePlate", label: "Biển số", default: true },
  { id: "employeeName", label: "Chủ xe", default: true },
  { id: "vehicleType", label: "Loại xe", default: true },
  { id: "brand", label: "Hãng", default: true },
  { id: "model", label: "Mẫu", default: true },
  { id: "color", label: "Màu", default: false },
  { id: "year", label: "Năm SX", default: false },
  { id: "registrationDate", label: "Ngày đăng ký", default: true },
  { id: "expiryDate", label: "Ngày hết hạn", default: false },
  { id: "status", label: "Trạng thái", default: true },
  { id: "fuelType", label: "Nhiên liệu", default: false },
  { id: "capacity", label: "Sức chứa", default: false },
  { id: "notes", label: "Ghi chú", default: false },
]

export function AdvancedExportDialog({ isOpen, onClose, entity = "employee", onExported }: AdvancedExportDialogProps) {
  const { toast } = useToast()
  const fieldOptions = entity === "vehicle" ? VEHICLE_FIELDS : EMPLOYEE_FIELDS
  const [selectedFields, setSelectedFields] = useState<string[]>(
    fieldOptions.filter((f) => f.default).map((f) => f.id),
  )
  const [format, setFormat] = useState("EXCEL")
  const [exporting, setExporting] = useState(false)

  const title = entity === "vehicle" ? "Xuất danh sách xe (nâng cao)" : "Xuất danh sách quân nhân (nâng cao)"

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    setSelectedFields((prev) => (checked ? [...prev, fieldId] : prev.filter((id) => id !== fieldId)))
  }

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast({ title: "Thông báo", description: "Vui lòng chọn ít nhất một trường để xuất." })
      return
    }
    // Preserve canonical field order when sending to the backend
    const orderedFields = fieldOptions.filter((f) => selectedFields.includes(f.id)).map((f) => f.id)

    try {
      setExporting(true)
      const isCsv = format === "CSV"
      const fmt = isCsv ? "csv" : "excel"
      const blob = entity === "vehicle"
        ? await vehicleApi.exportVehicles(orderedFields, fmt)
        : await employeeApi.exportEmployees(orderedFields, fmt)

      const base = entity === "vehicle" ? "danh-sach-xe" : "danh-sach-quan-nhan"
      downloadBlob(blob, `${base}.${isCsv ? "csv" : "xlsx"}`)

      toast({ title: "Xuất file thành công", description: `Đã xuất dữ liệu ra file ${isCsv ? "CSV" : "Excel"}` })
      onExported?.()
      onClose()
    } catch (error) {
      toast({
        title: "Lỗi xuất file",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi xuất dữ liệu.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Chọn trường để xuất</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {fieldOptions.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`field-${field.id}`}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={(checked) => handleFieldToggle(field.id, checked as boolean)}
                  />
                  <Label htmlFor={`field-${field.id}`} className="text-sm">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4 max-w-xs">
            <Label>Định dạng tập tin</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCEL">EXCEL (.xlsx)</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Đang xuất..." : "Xuất"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
