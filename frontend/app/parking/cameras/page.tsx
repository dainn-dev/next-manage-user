"use client"

import { AlertCircle, Camera, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CameraTile } from '@/components/dashboard/camera-tile'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'

export default function LiveCamerasPage() {
  const { cameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()

  return (
    <div className="admin-mobile-page space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Camera trực tiếp</h1>
          <p className="text-sm text-muted-foreground">Chỉ hiển thị camera thuộc site và zone đang chọn.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{realtime === 'live' ? 'Đang trực tiếp' : 'Đang đồng bộ định kỳ'}{lastUpdatedAt ? ` · ${new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}` : ''}</span>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={status === 'loading'}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertCircle className="h-4 w-4" />{error}</div>}

      {!selectedSiteId ? (
        <EmptyState title="Chưa có site để hiển thị" description="Tài khoản chưa được gán site hoặc danh sách site đang trống." />
      ) : status === 'loading' || status === 'idle' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="aspect-video animate-pulse rounded-xl bg-muted" />)}</div>
      ) : cameras.length === 0 ? (
        <EmptyState title="Không có camera" description={selectedZoneId ? 'Zone được chọn chưa có camera.' : 'Site được chọn chưa có camera.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cameras.map((camera) => <CameraTile key={camera.id} camera={camera} />)}</div>
      )}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"><div className="rounded-full bg-muted p-4"><Camera className="h-8 w-8 text-muted-foreground" /></div><div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>
}
