"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, FileSpreadsheet, Calendar, Filter } from "lucide-react"
import { entryExitRequestExcelApi } from "@/lib/api/entry-exit-request-excel-api"
import { useToast } from "@/hooks/use-toast"

interface EntryExitExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function EntryExitExportDialog({ isOpen, onClose }: EntryExitExportDialogProps) {
  const [exportType, setExportType] = useState<"all" | "status" | "dateRange">("all")
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    try {
      setIsExporting(true)

      switch (exportType) {
        case "all":
          await entryExitRequestExcelApi.exportAllToExcel()
          toast({
            variant: "success",
            title: "Xuất thành công",
            description: "Đã xuất tất cả yêu cầu ra vào ra file Excel.",
          })
          break
        case "status":
          await entryExitRequestExcelApi.exportByStatusToExcel(status)
          toast({
            variant: "success",
            title: "Xuất thành công",
            description: `Đã xuất yêu cầu có trạng thái "${status}" ra file Excel.`,
          })
          break
        case "dateRange":
          if (!startDate || !endDate) {
            toast({
              variant: "destructive",
              title: "Lỗi",
              description: "Vui lòng chọn khoảng thời gian.",
            })
            return
          }
          await entryExitRequestExcelApi.exportByDateRangeToExcel(startDate, endDate)
          toast({
            variant: "success",
            title: "Xuất thành công",
            description: `Đã xuất yêu cầu từ ${startDate} đến ${endDate} ra file Excel.`,
          })
          break
      }

      onClose()
    } catch (error) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Lỗi xuất file",
        description: "Không thể xuất file Excel. Vui lòng thử lại sau.",
      })
    } finally {
      setIsExporting(false)
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Xuất dữ liệu Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Loại xuất dữ liệu</Label>
            <Select value={exportType} onValueChange={(value: "all" | "status" | "dateRange") => setExportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Tất cả yêu cầu
                  </div>
                </SelectItem>
                <SelectItem value="status">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Theo trạng thái
                  </div>
                </SelectItem>
                <SelectItem value="dateRange">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Theo khoảng thời gian
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exportType === "status" && (
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={(value: "pending" | "approved" | "rejected") => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {exportType === "dateRange" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Từ ngày</Label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Đến ngày</Label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium mb-2 text-blue-800">Lưu ý</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• File Excel sẽ chứa tất cả thông tin yêu cầu ra vào</li>
              <li>• Có thể sử dụng file này để sao lưu hoặc phân tích dữ liệu</li>
              <li>• Định dạng thời gian: yyyy-MM-dd HH:mm:ss</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Tải template
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
