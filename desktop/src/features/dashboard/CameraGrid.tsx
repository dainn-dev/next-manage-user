import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Activity, AlertTriangle, Camera, ChevronLeft, ChevronRight, Clock3, Eye, Gauge, LogIn, LogOut, MapPin, Maximize2, Radio, SlidersHorizontal, X } from 'lucide-react'

type CameraDirection = 'entry' | 'exit'

interface CameraHealth {
  camera_id: string
  name: string
  direction: CameraDirection
  state: 'streaming' | 'offline' | 'error'
  last_frame_at: string | null
  fps: number
  resolution: string
  source: string
  error: string | null
}

interface OverviewCamera {
  camera_id: string
  name: string
  zones: string[]
  state: 'streaming' | 'offline'
  motion_detected: boolean
  last_motion_at: string | null
  fps: number
}

const DEMO_ENABLED = import.meta.env.DEV || import.meta.env.VITE_AGENT_DEMO_CAMERAS === 'true'
const OVERVIEW_PAGE_SIZE = 8

function createDemoCameras(): CameraHealth[] {
  const now = new Date().toISOString()
  return [
    {
      camera_id: 'demo-entry-camera',
      name: 'Camera cổng vào',
      direction: 'entry',
      state: 'streaming',
      last_frame_at: now,
      fps: 24.8,
      resolution: '1920 × 1080',
      source: 'RTSP · Khu vực chính',
      error: null,
    },
    {
      camera_id: 'demo-exit-camera',
      name: 'Camera cổng ra',
      direction: 'exit',
      state: 'streaming',
      last_frame_at: now,
      fps: 25.1,
      resolution: '1920 × 1080',
      source: 'RTSP · Khu vực chính',
      error: null,
    },
  ]
}

function createDemoOverviewCameras(): OverviewCamera[] {
  const now = new Date().toISOString()
  return [
    {
      camera_id: 'demo-overview-a',
      name: 'Overview khu A',
      zones: ['Zone A1', 'Zone A2'],
      state: 'streaming',
      motion_detected: true,
      last_motion_at: now,
      fps: 20.1,
    },
    {
      camera_id: 'demo-overview-b',
      name: 'Overview khu B',
      zones: ['Zone B1', 'Zone B2', 'Zone B3'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 19.8,
    },
    {
      camera_id: 'demo-overview-ramp',
      name: 'Overview đường dốc',
      zones: ['Zone Ramp', 'Zone B1'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 20.0,
    },
    {
      camera_id: 'demo-overview-yard',
      name: 'Overview toàn cảnh',
      zones: ['Zone A1', 'Zone B2'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 19.9,
    },
    {
      camera_id: 'demo-overview-c',
      name: 'Overview khu C',
      zones: ['Zone C1', 'Zone C2'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 20.2,
    },
    {
      camera_id: 'demo-overview-d',
      name: 'Overview khu D',
      zones: ['Zone D1', 'Zone D2'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 19.7,
    },
    {
      camera_id: 'demo-overview-elevator',
      name: 'Overview sảnh thang máy',
      zones: ['Zone Lobby', 'Zone C1'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 20.0,
    },
    {
      camera_id: 'demo-overview-motorbike',
      name: 'Overview khu xe máy',
      zones: ['Zone M1', 'Zone M2'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 19.8,
    },
    {
      camera_id: 'demo-overview-loading',
      name: 'Overview khu giao nhận',
      zones: ['Zone Loading', 'Zone D2'],
      state: 'offline',
      motion_detected: false,
      last_motion_at: null,
      fps: 0,
    },
    {
      camera_id: 'demo-overview-corridor',
      name: 'Overview hành lang',
      zones: ['Zone Corridor', 'Zone Lobby'],
      state: 'streaming',
      motion_detected: false,
      last_motion_at: null,
      fps: 20.1,
    },
  ]
}

export default function CameraGrid() {
  const [cameras, setCameras] = useState<CameraHealth[]>(() => DEMO_ENABLED ? createDemoCameras() : [])
  const [overviewCameras, setOverviewCameras] = useState<OverviewCamera[]>(
    () => DEMO_ENABLED ? createDemoOverviewCameras() : [],
  )

  useEffect(() => {
    if (!DEMO_ENABLED) return

    const interval = window.setInterval(() => {
      setCameras((current) => current.map((camera, index) => ({
        ...camera,
        fps: index === 0 ? 24.7 + Math.random() * 0.4 : 24.9 + Math.random() * 0.3,
        last_frame_at: new Date().toISOString(),
      })))
    }, 2000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!DEMO_ENABLED) return

    let activeIndex = 0
    const interval = window.setInterval(() => {
      const now = new Date().toISOString()
      setOverviewCameras((current) => {
        const streamingIndices = current
          .map((camera, index) => camera.state === 'streaming' ? index : -1)
          .filter((index) => index >= 0)
        if (streamingIndices.length === 0) return current

        activeIndex = (activeIndex + 1) % streamingIndices.length
        const activeCameraIndex = streamingIndices[activeIndex]
        return current.map((camera, index) => ({
          ...camera,
          motion_detected: index === activeCameraIndex,
          last_motion_at: index === activeCameraIndex ? now : camera.last_motion_at,
          fps: camera.state === 'streaming' ? 19.7 + Math.random() * 0.6 : camera.fps,
        }))
      })
    }, 4000)

    return () => window.clearInterval(interval)
  }, [])

  const streamingCount = useMemo(
    () => cameras.filter((camera) => camera.state === 'streaming').length,
    [cameras],
  )

  if (cameras.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <Camera className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold">Chưa cấu hình camera</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Thêm camera trên website, thiết bị sẽ tự động đồng bộ cấu hình.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3" aria-labelledby="camera-grid-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="camera-grid-title" className="text-xl font-semibold tracking-tight">Camera cổng</h2>
            {DEMO_ENABLED && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Dữ liệu demo
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi luồng nhận diện biển số tại lối vào và lối ra.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
          <Radio className="size-4 text-emerald-600" aria-hidden="true" />
          <span className="font-medium">{streamingCount}/{cameras.length} đang truyền hình</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {cameras.map((camera) => <CameraCard key={camera.camera_id} camera={camera} />)}
      </div>

      {overviewCameras.length > 0 && (
        <OverviewCameraList cameras={overviewCameras} />
      )}
    </section>
  )
}

function CameraCard({ camera }: { camera: CameraHealth }) {
  const isEntry = camera.direction === 'entry'
  const isStreaming = camera.state === 'streaming'
  const DirectionIcon = isEntry ? LogIn : LogOut

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${isEntry ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
            <DirectionIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{camera.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{camera.source}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          isStreaming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>
          <span className={`size-1.5 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
          {isStreaming ? 'Đang truyền' : 'Ngoại tuyến'}
        </span>
      </header>

      <div className="relative h-[440px] overflow-hidden bg-slate-950 sm:h-[500px] lg:h-[calc(100vh-390px)] lg:min-h-[500px] lg:max-h-[720px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(20,184,166,0.16),transparent_45%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(2,6,23,1))]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] text-white/90 backdrop-blur">
          {isEntry ? 'ENTRY · CAM 01' : 'EXIT · CAM 02'}
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-red-600/90 px-2 py-1 text-[11px] font-semibold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
        </div>
        <div className="absolute inset-0 grid place-items-center text-center text-slate-300">
          <div>
            <Camera className="mx-auto size-9 text-teal-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-white">Preview luồng camera</p>
            <p className="mt-1 text-xs text-slate-400">Khung hình demo cho kiểm thử giao diện</p>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 font-mono text-[11px] text-slate-300">
          {camera.resolution} · H.264
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x border-t text-sm sm:grid-cols-3">
        <Metric icon={<Gauge className="size-4" />} label="Tốc độ" value={`${camera.fps.toFixed(1)} FPS`} />
        <Metric
          icon={<Clock3 className="size-4" />}
          label="Frame cuối"
          value={camera.last_frame_at ? new Date(camera.last_frame_at).toLocaleTimeString('vi-VN') : '—'}
        />
        <Metric
          className="col-span-2 border-t sm:col-span-1 sm:border-t-0"
          icon={camera.error ? <AlertTriangle className="size-4 text-destructive" /> : <Radio className="size-4" />}
          label="Pipeline"
          value={camera.error ?? 'ANPR sẵn sàng'}
        />
      </div>
    </article>
  )
}

function OverviewCameraList({
  cameras,
}: {
  cameras: OverviewCamera[]
}) {
  const motionCount = cameras.filter((camera) => camera.motion_detected).length
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const selectedCamera = cameras.find((camera) => camera.camera_id === selectedCameraId) ?? null
  const zones = useMemo(
    () => Array.from(new Set(cameras.flatMap((camera) => camera.zones))).sort(),
    [cameras],
  )
  const filteredCameras = useMemo(() => cameras
    .filter((camera) => zoneFilter === 'all' || camera.zones.includes(zoneFilter))
    .filter((camera) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'motion') return camera.motion_detected
      return camera.state === statusFilter
    })
    .sort((left, right) => Number(right.motion_detected) - Number(left.motion_detected)),
  [cameras, statusFilter, zoneFilter])
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / OVERVIEW_PAGE_SIZE))
  const visibleCameras = filteredCameras.slice(
    (page - 1) * OVERVIEW_PAGE_SIZE,
    page * OVERVIEW_PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [statusFilter, zoneFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <section className="space-y-3 pt-5" aria-labelledby="overview-camera-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="overview-camera-title" className="text-xl font-semibold tracking-tight">Camera overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Giám sát chuyển động trên nhiều zone từ cùng một góc nhìn.
          </p>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
          motionCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
        }`} aria-live="polite">
          <Activity className={`size-4 ${motionCount > 0 ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {motionCount > 0 ? `${motionCount} camera phát hiện chuyển động` : 'Không phát hiện chuyển động'}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Bộ lọc
          </div>
          <select
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
            aria-label="Lọc camera theo zone"
            className="h-9 min-w-44 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">Tất cả zone</option>
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Lọc camera theo trạng thái"
            className="h-9 min-w-44 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="motion">Đang có chuyển động</option>
            <option value="streaming">Đang truyền</option>
            <option value="offline">Ngoại tuyến</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredCameras.length === 0
            ? 'Không có camera phù hợp'
            : `Hiển thị ${(page - 1) * OVERVIEW_PAGE_SIZE + 1}–${Math.min(page * OVERVIEW_PAGE_SIZE, filteredCameras.length)} / ${filteredCameras.length} camera`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleCameras.map((camera) => (
          <OverviewCameraCard
            key={camera.camera_id}
            camera={camera}
            index={cameras.findIndex((item) => item.camera_id === camera.camera_id)}
            onSelect={() => setSelectedCameraId(camera.camera_id)}
          />
        ))}
      </div>

      {filteredCameras.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Camera className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">Không tìm thấy camera</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử chọn zone hoặc trạng thái khác.</p>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between rounded-xl border bg-card px-3 py-2" aria-label="Phân trang camera overview">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Trang trước
          </button>
          <span className="text-sm font-medium tabular-nums">Trang {page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang sau <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </nav>
      )}

      <OverviewCameraDialog
        camera={selectedCamera}
        index={selectedCamera ? cameras.findIndex((camera) => camera.camera_id === selectedCamera.camera_id) : -1}
        open={selectedCamera !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCameraId(null)
        }}
      />
    </section>
  )
}

function OverviewCameraCard({
  camera,
  index,
  onSelect,
}: {
  camera: OverviewCamera
  index: number
  onSelect: () => void
}) {
  const hasMotion = camera.motion_detected
  const isStreaming = camera.state === 'streaming'

  return (
    <article className={`group w-full overflow-hidden rounded-xl border bg-card text-left transition-all duration-300 ${
      hasMotion
        ? 'border-amber-400 ring-2 ring-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.22)]'
        : 'shadow-sm hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md'
    }`}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Mở camera ${camera.name}`}
        className="relative block aspect-video w-full overflow-hidden bg-slate-950 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
      >
        <div className={`absolute inset-0 transition-colors duration-300 ${
          hasMotion
            ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.24),transparent_46%),linear-gradient(135deg,#172033,#080d19)]'
            : 'bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.13),transparent_45%),linear-gradient(135deg,#111827,#020617)]'
        }`} />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] text-white/90">
          OVERVIEW · CAM {String(index + 3).padStart(2, '0')}
        </div>
        {hasMotion && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold text-slate-950 shadow-lg">
            <Activity className="size-3 animate-pulse" aria-hidden="true" /> TÌNH NGHI
          </div>
        )}
        {!isStreaming && (
          <div className="absolute right-3 top-3 rounded-md bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-800 shadow-lg">
            NGOẠI TUYẾN
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className={`grid size-12 place-items-center rounded-full border backdrop-blur transition-colors ${
            hasMotion
              ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
              : 'border-sky-300/25 bg-sky-400/10 text-sky-300'
          }`}>
            {hasMotion ? <Activity className="size-6 animate-pulse" /> : <Eye className="size-6" />}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-slate-300">
          {isStreaming ? `${camera.fps.toFixed(1)} FPS · LIVE` : '0.0 FPS · OFFLINE'}
        </div>
        <div className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-md bg-black/55 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-3.5" aria-hidden="true" />
        </div>
      </button>

      <div className={`border-t p-3 transition-colors ${hasMotion ? 'border-amber-200 bg-amber-50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{camera.name}</h3>
            <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{camera.zones.join(' · ')}</span>
            </div>
          </div>
          <span className={`mt-1 size-2 shrink-0 rounded-full ${isStreaming ? 'bg-emerald-500' : 'bg-slate-400'}`} title={isStreaming ? 'Đang truyền' : 'Ngoại tuyến'} />
        </div>
        <p className={`mt-2 text-xs font-medium ${hasMotion ? 'text-amber-800' : 'text-muted-foreground'}`}>
          {hasMotion
            ? `Phát hiện lúc ${formatTime(camera.last_motion_at)}`
            : camera.last_motion_at
              ? `Chuyển động gần nhất: ${formatTime(camera.last_motion_at)}`
              : 'Chưa phát hiện chuyển động'}
        </p>

      </div>
    </article>
  )
}

function OverviewCameraDialog({
  camera,
  index,
  open,
  onOpenChange,
}: {
  camera: OverviewCamera | null
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!camera) return null

  const hasMotion = camera.motion_detected
  const isStreaming = camera.state === 'streaming'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-32px)] max-w-[1500px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-card shadow-2xl focus:outline-none">
          <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Dialog.Title className="truncate text-xl font-semibold">{camera.name}</Dialog.Title>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  isStreaming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className={`size-1.5 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                  {isStreaming ? 'Đang truyền' : 'Ngoại tuyến'}
                </span>
                {hasMotion && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Activity className="size-3.5 animate-pulse" aria-hidden="true" /> Phát hiện chuyển động
                  </span>
                )}
              </div>
              <Dialog.Description className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" /> {camera.zones.join(' · ')}
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Đóng popup camera">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className={`relative h-[55vh] min-h-[420px] overflow-hidden bg-slate-950 sm:h-[65vh] sm:max-h-[720px] ${
            hasMotion ? 'ring-4 ring-inset ring-amber-400' : ''
          }`}>
            <div className={`absolute inset-0 transition-colors duration-300 ${
              hasMotion
                ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.2),transparent_46%),linear-gradient(135deg,#172033,#080d19)]'
                : 'bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.13),transparent_45%),linear-gradient(135deg,#111827,#020617)]'
            }`} />
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />
            <div className="absolute left-4 top-4 rounded-md bg-black/60 px-2.5 py-1.5 font-mono text-xs text-white/90">
              OVERVIEW · CAM {String(index + 3).padStart(2, '0')}
            </div>
            <div className={`absolute right-4 top-4 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold shadow-lg ${
              isStreaming ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {isStreaming && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
              {isStreaming ? 'LIVE' : 'OFFLINE'}
            </div>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className={`mx-auto grid size-20 place-items-center rounded-full border backdrop-blur ${
                  hasMotion
                    ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                    : 'border-sky-300/25 bg-sky-400/10 text-sky-300'
                }`}>
                  {hasMotion ? <Activity className="size-9 animate-pulse" /> : <Eye className="size-9" />}
                </div>
                <p className="mt-4 text-lg font-medium text-white">Preview {camera.name}</p>
                <p className="mt-1 text-sm text-slate-400">Khung hình overview demo</p>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 font-mono text-xs text-slate-300">
              1920 × 1080 · {camera.fps.toFixed(1)} FPS · H.264
            </div>
          </div>

          <footer className="grid grid-cols-1 divide-y border-t text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Metric icon={<Gauge className="size-4" />} label="Tốc độ" value={isStreaming ? `${camera.fps.toFixed(1)} FPS` : 'Ngoại tuyến'} />
            <Metric icon={<MapPin className="size-4" />} label="Zone giám sát" value={camera.zones.join(', ')} />
            <Metric
              icon={<Activity className={`size-4 ${hasMotion ? 'text-amber-600' : ''}`} />}
              label="Chuyển động"
              value={hasMotion ? `Phát hiện lúc ${formatTime(camera.last_motion_at)}` : 'Không phát hiện'}
            />
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('vi-VN') : '—'
}

function Metric({
  className = '',
  icon,
  label,
  value,
}: {
  className?: string
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className={`min-w-0 p-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 truncate font-medium tabular-nums">{value}</div>
    </div>
  )
}
