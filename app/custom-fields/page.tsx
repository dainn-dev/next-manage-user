"use client"

import { useState, useEffect } from "react"
import type { CustomField } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { CustomFieldsTable } from "@/components/access-control/custom-fields-table"
import { SettingsForm } from "@/components/access-control/settings-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CustomFieldsPage() {
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  useEffect(() => {
    setCustomFields(dataService.getCustomFields())
  }, [])

  const handleEdit = (field: CustomField) => {
    // Handle edit logic
    console.log("Edit field:", field)
  }

  const handleDelete = (fieldId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa trường này?")) {
      dataService.deleteCustomField(fieldId)
      setCustomFields(dataService.getCustomFields())
    }
  }

  const handleSaveSettings = (settings: any) => {
    console.log("Save settings:", settings)
    alert("Cài đặt đã được lưu!")
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Nhân sự / Quản lý nhân sự / Thuộc tính tùy chỉnh</h1>
      </div>

      <Tabs defaultValue="fields" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fields">Cài đặt ID nhân sự</TabsTrigger>
          <TabsTrigger value="settings">Cài đặt thẻ</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <SettingsForm onSave={handleSaveSettings} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <CustomFieldsTable customFields={customFields} onEdit={handleEdit} onDelete={handleDelete} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
