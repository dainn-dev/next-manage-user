"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Upload, Camera, X } from "lucide-react"

interface EmployeePhotoUploadProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (photo: File) => void
  currentPhoto?: string
}

export function EmployeePhotoUpload({ isOpen, onClose, onUpload, currentPhoto }: EmployeePhotoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto || null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile)
      onClose()
    }
  }

  const handleClose = () => {
    if (previewUrl && previewUrl !== currentPhoto) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(currentPhoto || null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Tải lên ảnh nhân viên</DialogTitle>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center space-y-4">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl || "/placeholder.svg"}
                  alt="Employee photo preview"
                  className="w-32 h-32 object-cover rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={() => {
                    if (previewUrl !== currentPhoto) {
                      URL.revokeObjectURL(previewUrl)
                    }
                    setPreviewUrl(null)
                    setSelectedFile(null)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Chọn ảnh
                </label>
              </Button>
              <input id="photo-upload" type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Định dạng hỗ trợ: JPG, PNG, GIF
              <br />
              Kích thước tối đa: 5MB
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button onClick={handleUpload} className="bg-green-600 hover:bg-green-700" disabled={!selectedFile}>
            Tải lên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
