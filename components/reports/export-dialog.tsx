"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: ExportOptions) => void
}

interface ExportOptions {
  format: string
  includeHeaders: boolean
  encoding: string
  encryptFile: boolean
  maxRecords: number
}

export function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "EXCEL",
    includeHeaders: true,
    encoding: "UTF-8",
    encryptFile: false,
    maxRecords: 100000,
  })

  const handleExport = () => {
    onExport(exportOptions)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Xuất báo cáo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Mã hóa tập tin</Label>
            <Input
              value={exportOptions.encoding}
              onChange={(e) => setExportOptions((prev) => ({ ...prev, encoding: e.target.value }))}
              placeholder="UTF-8"
            />
          </div>

          <div className="space-y-3">
            <Label>Định dạng tập tin</Label>
            <Select
              value={exportOptions.format}
              onValueChange={(value) => setExportOptions((prev) => ({ ...prev, format: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCEL">EXCEL</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="XML">XML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Dữ liệu để xuất</Label>
            <RadioGroup
              value={exportOptions.includeHeaders ? "all" : "selected"}
              onValueChange={(value) => setExportOptions((prev) => ({ ...prev, includeHeaders: value === "all" }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="export-all" />
                <Label htmlFor="export-all">Tất cả (tối đa 100000 bản ghi)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selected" id="export-selected" />
                <Label htmlFor="export-selected">Chỉ các bản ghi được chọn</Label>
              </div>
            </RadioGroup>
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
