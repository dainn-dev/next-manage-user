"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Car, Image as ImageIcon, X } from "lucide-react"

interface RequestImagesDialogProps {
  isOpen: boolean
  onClose: () => void
  requestId: string | null
}

interface RequestImages {
  requestId: string
  licensePlate: string
  entryImagePath: string | null
  exitImagePath: string | null
  hasEntryImage: boolean
  hasExitImage: boolean
}

export function RequestImagesDialog({ isOpen, onClose, requestId }: RequestImagesDialogProps) {
  const [images, setImages] = useState<RequestImages | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && requestId) {
      fetchImages()
    }
  }, [isOpen, requestId])

  const fetchImages = async () => {
    if (!requestId) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`http://localhost:8080/api/entry-exit-requests/${requestId}/images`)
      
      if (!response.ok) {
        throw new Error('Không thể tải hình ảnh')
      }
      
      const data = await response.json()
      setImages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      console.error('Error fetching images:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setImages(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Hình ảnh xe ra/vào
            {images && (
              <Badge variant="outline" className="ml-2">
                <Car className="h-3 w-3 mr-1" />
                {images.licensePlate}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Đang tải hình ảnh...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2 text-red-600">
                <X className="h-8 w-8" />
                <p className="text-sm font-medium">Lỗi tải hình ảnh</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchImages}>
                  Thử lại
                </Button>
              </div>
            </div>
          )}

          {images && !loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entry Image */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    Hình ảnh vào
                  </Badge>
                  {!images.hasEntryImage && (
                    <Badge variant="secondary">Chưa có</Badge>
                  )}
                </div>
                
                {images.hasEntryImage ? (
                  <div className="relative">
                    <img
                      src={`http://localhost:8080${images.entryImagePath}`}
                      alt={`Entry image for ${images.licensePlate}`}
                      className="w-full h-64 object-cover rounded-lg border shadow-sm"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder.svg'
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(`http://localhost:8080${images.entryImagePath}`, '_blank')}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Chưa có hình ảnh</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Exit Image */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-red-600">
                    Hình ảnh ra
                  </Badge>
                  {!images.hasExitImage && (
                    <Badge variant="secondary">Chưa có</Badge>
                  )}
                </div>
                
                {images.hasExitImage ? (
                  <div className="relative">
                    <img
                      src={`http://localhost:8080${images.exitImagePath}`}
                      alt={`Exit image for ${images.licensePlate}`}
                      className="w-full h-64 object-cover rounded-lg border shadow-sm"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder.svg'
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.open(`http://localhost:8080${images.exitImagePath}`, '_blank')}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Chưa có hình ảnh</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          {images && !loading && !error && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Biển kiểm soát: <strong>{images.licensePlate}</strong></span>
                <span>
                  {images.hasEntryImage && images.hasExitImage && "Đầy đủ hình ảnh"}
                  {(images.hasEntryImage || images.hasExitImage) && !(images.hasEntryImage && images.hasExitImage) && "Một phần hình ảnh"}
                  {!images.hasEntryImage && !images.hasExitImage && "Chưa có hình ảnh"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
