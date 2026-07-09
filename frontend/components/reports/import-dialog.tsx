"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X, Download, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { vehicleApi, VehicleImportResult } from "@/lib/api/vehicle-api"
import { downloadBlob } from "@/lib/utils/download-blob"

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  // Called after a successful import so the parent can refresh its data
  onImported?: () => void
}

export function ImportDialog({ isOpen, onClose, onImported }: ImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<VehicleImportResult | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const blob = await vehicleApi.downloadImportTemplate()
      downloadBlob(blob, "mau-nhap-xe.xlsx")
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải file mẫu. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Thông báo",
        description: "Vui lòng chọn tập tin để nhập.",
      })
      return
    }

    try {
      setUploading(true)
      setResult(null)
      const importResult = await vehicleApi.importVehicles(file)
      setResult(importResult)

      toast({
        title: "Nhập dữ liệu hoàn tất",
        description: `Thành công: ${importResult.successCount}, Bỏ qua: ${importResult.skippedCount}, Lỗi: ${importResult.failureCount}`,
        variant: importResult.failureCount > 0 ? "destructive" : "default",
      })

      if (importResult.successCount > 0) {
        onImported?.()
      }
    } catch (error) {
      toast({
        title: "Lỗi nhập dữ liệu",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi nhập dữ liệu.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Nhập danh sách xe</DialogTitle>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>File mẫu</Label>
            <div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Tải file mẫu (.xlsx)
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Hỗ trợ file Excel (.xlsx, .xls) hoặc CSV. Các cột có (*) là bắt buộc.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chọn tập tin</Label>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setResult(null)
                }}
              />
              <Button
                variant="outline"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => fileInputRef.current?.click()}
              >
                Duyệt
              </Button>
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                {file ? file.name : "Chưa được tải lên"}
              </span>
            </div>
          </div>

          {result && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <div>Tổng số dòng: <span className="font-medium">{result.totalRows}</span></div>
              <div className="text-green-600">Thành công: {result.successCount}</div>
              <div className="text-amber-600">Bỏ qua (đã tồn tại): {result.skippedCount}</div>
              <div className="text-red-600">Lỗi: {result.failureCount}</div>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-auto text-xs text-red-600 list-disc list-inside">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>Dòng {err.row}{err.licensePlate ? ` (${err.licensePlate})` : ""}: {err.message}</li>
                  ))}
                  {result.errors.length > 10 && <li>... và {result.errors.length - 10} lỗi khác</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Đóng
          </Button>
          <Button onClick={handleImport} disabled={uploading || !file} className="bg-green-600 hover:bg-green-700">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Đang nhập..." : "Nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
