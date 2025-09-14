"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { entryExitRequestExcelApi, ImportResult } from "@/lib/api/entry-exit-request-excel-api"
import { useToast } from "@/hooks/use-toast"

interface EntryExitImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

export function EntryExitImportDialog({ isOpen, onClose, onImportComplete }: EntryExitImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setSelectedFile(file)
        setImportResult(null)
      } else {
        toast({
          variant: "destructive",
          title: "Lỗi định dạng file",
          description: "Vui lòng chọn file Excel (.xlsx hoặc .xls).",
        })
      }
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn file Excel để import.",
      })
      return
    }

    try {
      setIsImporting(true)
      const result = await entryExitRequestExcelApi.importFromExcel(selectedFile)
      setImportResult(result)

      if (result.errorCount === 0) {
        toast({
          variant: "success",
          title: "Import thành công",
          description: `Đã import thành công ${result.successCount} yêu cầu.`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Import hoàn thành với lỗi",
          description: `Import thành công ${result.successCount} yêu cầu, ${result.errorCount} lỗi.`,
        })
      }

      onImportComplete?.()
    } catch (error) {
      console.error('Import error:', error)
      toast({
        variant: "destructive",
        title: "Lỗi import",
        description: "Không thể import file Excel. Vui lòng thử lại sau.",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await entryExitRequestExcelApi.downloadTemplate()
      toast({
        variant: "success",
        title: "Tải template thành công",
        description: "Đã tải file template Excel.",
      })
    } catch (error) {
      console.error('Template download error:', error)
      toast({
        variant: "destructive",
        title: "Lỗi tải template",
        description: "Không thể tải file template. Vui lòng thử lại sau.",
      })
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Import dữ liệu Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!importResult ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Chọn file Excel</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Kéo thả file Excel vào đây hoặc
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    Chọn file
                  </Button>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">{selectedFile.name}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium mb-2 text-yellow-800">Lưu ý quan trọng</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• File Excel phải có định dạng đúng theo template</li>
                  <li>• Employee ID và License Plate phải tồn tại trong hệ thống</li>
                  <li>• Request Type: "entry" hoặc "exit"</li>
                  <li>• Status: "pending", "approved", hoặc "rejected"</li>
                  <li>• Định dạng thời gian: yyyy-MM-dd HH:mm:ss</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Kết quả import</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importResult.totalRows}</div>
                    <div className="text-sm text-blue-800">Tổng số dòng</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
                    <div className="text-sm text-green-800">Thành công</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.errorCount}</div>
                    <div className="text-sm text-red-800">Lỗi</div>
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <h4 className="font-medium mb-2 text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Chi tiết lỗi
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 mb-1">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Tải template
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? "Đóng" : "Hủy"}
            </Button>
            {!importResult && (
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || isImporting}
              >
                {isImporting ? "Đang import..." : "Import"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
