"use client"

import { useState, useEffect } from "react"
import type { DocumentLibrary } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { DocumentTable } from "@/components/library/document-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function LibraryPage() {
  const [documents, setDocuments] = useState<DocumentLibrary[]>([])

  useEffect(() => {
    setDocuments(dataService.getDocuments())
  }, [])

  const handleEdit = (document: DocumentLibrary) => {
    console.log("Edit document:", document)
  }

  const handleDelete = (documentId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) {
      dataService.deleteDocument(documentId)
      setDocuments(dataService.getDocuments())
    }
  }

  const handleDownload = (document: DocumentLibrary) => {
    console.log("Download document:", document)
    alert(`Đang tải xuống: ${document.name}`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nhân sự / Quản lý nhân sự / Danh sách thư viện</h1>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Thêm tài liệu
        </Button>
      </div>

      <DocumentTable documents={documents} onEdit={handleEdit} onDelete={handleDelete} onDownload={handleDownload} />
    </div>
  )
}
