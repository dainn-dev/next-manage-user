"use client"

import { useState, useEffect } from "react"
import type { CustomField } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { CustomFieldsTable } from "@/components/access-control/custom-fields-table"
import { SettingsForm } from "@/components/access-control/settings-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CustomFieldsPage() {
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCustomFields()
  }, [])

  const loadCustomFields = async () => {
    try {
      setLoading(true)
      setError(null)
      const fields = await dataService.getCustomFields()
      setCustomFields(fields)
    } catch (err) {
      setError('Không thể tải danh sách trường tùy chỉnh')
      console.error('Error loading custom fields:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (field: CustomField) => {
    // Handle edit logic
    console.log("Edit field:", field)
  }

  const handleDelete = async (fieldId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa trường này?")) {
      try {
        await dataService.deleteCustomField(fieldId)
        await loadCustomFields() // Reload the list
      } catch (err) {
        setError('Không thể xóa trường tùy chỉnh')
        console.error('Error deleting custom field:', err)
      }
    }
  }

  const handleSaveSettings = (settings: any) => {
    console.log("Save settings:", settings)
    alert("Cài đặt đã được lưu!")
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Thuộc tính tùy chỉnh</h1>
          <p className="text-muted-foreground text-lg">Quản lý các trường dữ liệu tùy chỉnh cho nhân viên</p>
        </div>
      </div>

      <Tabs defaultValue="fields" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            Cài đặt hệ thống
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            Trường tùy chỉnh
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-6">
          <SettingsForm onSave={handleSaveSettings} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-2xl">⚠️</span>
                </div>
                <div>
                  <p className="text-red-600 font-medium">{error}</p>
                  <button 
                    onClick={loadCustomFields}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <CustomFieldsTable 
              customFields={customFields} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
              onRefresh={loadCustomFields}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
