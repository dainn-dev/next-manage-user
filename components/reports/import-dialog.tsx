"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (options: ImportOptions) => void
}

interface ImportOptions {
  format: string
  handleExisting: string
  updateExisting: boolean
}

export function ImportDialog({ isOpen, onClose, onImport }: ImportDialogProps) {
  const [format, setFormat] = useState("Excel")
  const [handleExisting, setHandleExisting] = useState("skip")
  const [updateExisting, setUpdateExisting] = useState(false)

  const handleImportClick = () => {
    onImport({
      format,
      handleExisting,
      updateExisting,
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Nhập Quân nhân</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Định dạng tập</Label>
            <RadioGroup value={format} onValueChange={setFormat}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Excel" id="format-excel" />
                <Label htmlFor="format-excel">Excel</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Chọn tập tin</Label>
            <div className="flex items-center space-x-2">
              <Button variant="outline" className="bg-green-600 text-white hover:bg-green-700">
                Duyệt
              </Button>
              <span className="text-sm text-muted-foreground">Chưa được tải lên</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cập nhật dữ liệu hiện có</Label>
            <RadioGroup
              value={updateExisting ? "yes" : "no"}
              onValueChange={(value) => setUpdateExisting(value === "yes")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="update-yes" />
                <Label htmlFor="update-yes">Có</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="update-no" />
                <Label htmlFor="update-no">Không</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="text-sm text-orange-600">Mặc định là hàng thứ hai</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleImportClick} className="bg-green-600 hover:bg-green-700">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
