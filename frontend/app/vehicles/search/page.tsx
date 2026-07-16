"use client"

import * as React from 'react'
import { AlertCircle, Camera, Car, Clock, Loader2, MapPin, QrCode, ScanLine, Search, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AdminEmptyState, AdminPage, AdminPageHeader } from '@/components/layout/admin-page'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { validPlateQuery } from '@/lib/plate-search.mjs'

type DetectedBarcode = { rawValue?: string }
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance
type ScannerStatus = 'idle' | 'requesting' | 'granted' | 'scanning' | 'denied' | 'unavailable' | 'error'

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' } },
  audio: false,
}

function cameraAccessErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Trình duyệt đang chặn quyền camera. Hãy chọn Cho phép camera trong trình duyệt rồi thử lại.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Không tìm thấy camera phù hợp trên thiết bị này. Bạn vẫn có thể nhập biển số thủ công.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Camera đang bận hoặc không thể đọc được. Hãy đóng app khác đang dùng camera rồi thử lại.'
    default:
      return 'Không thể mở camera. Hãy cấp quyền camera rồi thử lại, hoặc nhập biển số thủ công.'
  }
}

function scannerStatusMessage(status: ScannerStatus): string {
  switch (status) {
    case 'requesting':
      return 'Đang yêu cầu quyền camera từ thiết bị…'
    case 'granted':
      return 'Đã được cấp quyền camera, đang khởi động khung quét…'
    case 'scanning':
      return 'Đang tìm mã QR trong khung hình…'
    case 'denied':
      return 'Camera đang bị chặn. Hãy cấp quyền camera để quét QR.'
    case 'unavailable':
      return 'Thiết bị hoặc trình duyệt hiện không hỗ trợ truy cập camera.'
    case 'error':
      return 'Không thể khởi động quét QR từ camera.'
    default:
      return 'Sẵn sàng xin quyền camera để quét QR.'
  }
}

function plateFromQr(value: string): string {
  const payload = value.trim()
  try {
    const data = JSON.parse(payload) as { plate?: string; licensePlate?: string; licensePlateNumber?: string }
    const fromPayload = data.plate || data.licensePlate || data.licensePlateNumber
    if (fromPayload) return fromPayload.toUpperCase()
  } catch {
    // QR payload may be plain text rather than JSON.
  }
  try {
    const url = new URL(payload)
    const fromParameter = url.searchParams.get('plate') || url.searchParams.get('licensePlate')
    if (fromParameter) return fromParameter.toUpperCase()
  } catch {
    // QR payload may be the plate itself rather than a URL.
  }
  return payload.toUpperCase()
}

export default function VehiclePlateSearchPage() {
  const [query, setQuery] = React.useState('')
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const [scannerError, setScannerError] = React.useState<string | null>(null)
  const [scannerStatus, setScannerStatus] = React.useState<ScannerStatus>('idle')
  const [scannerStream, setScannerStream] = React.useState<MediaStream | null>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const scannerStreamRef = React.useRef<MediaStream | null>(null)
  const { vehicles, searchVehicles, searchStatus, searchError, searchQuery, realtime } = useDashboardData()
  const { selectedSiteId } = useDashboardScope()
  const searchVehiclesRef = React.useRef(searchVehicles)

  React.useEffect(() => {
    searchVehiclesRef.current = searchVehicles
  }, [searchVehicles])

  const stopScannerStream = React.useCallback(() => {
    scannerStreamRef.current?.getTracks().forEach((track) => track.stop())
    scannerStreamRef.current = null
    setScannerStream(null)
  }, [])

  const closeScanner = React.useCallback(() => {
    setScannerOpen(false)
    setScannerError(null)
    setScannerStatus('idle')
    stopScannerStream()
  }, [stopScannerStream])

  const requestCameraAccess = React.useCallback(async () => {
    setScannerOpen(true)
    setScannerError(null)
    setScannerStatus('requesting')
    stopScannerStream()

    if (!window.isSecureContext) {
      setScannerStatus('unavailable')
      setScannerError('Trình duyệt chỉ cho phép dùng camera trên HTTPS hoặc localhost. Hãy mở trang bằng HTTPS để quét QR.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus('unavailable')
      setScannerError('Trình duyệt này không hỗ trợ truy cập camera. Hãy nhập biển số thủ công hoặc dùng trình duyệt khác.')
      return
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      scannerStreamRef.current = nextStream
      setScannerStream(nextStream)
      setScannerStatus('granted')
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setScannerStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      setScannerError(cameraAccessErrorMessage(error))
    }
  }, [stopScannerStream])

  const handleScannerToggle = React.useCallback(() => {
    if (scannerOpen) {
      closeScanner()
      return
    }
    void requestCameraAccess()
  }, [closeScanner, requestCameraAccess, scannerOpen])

  React.useEffect(() => () => stopScannerStream(), [stopScannerStream])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void searchVehicles(query)
  }

  React.useEffect(() => {
    if (!scannerOpen || !scannerStream) return

    let scanTimer: number | null = null
    let scannerControls: { stop: () => void } | null = null
    let detecting = false
    let cancelled = false
    let scanned = false

    const stopCamera = () => {
      if (scanTimer !== null) window.clearInterval(scanTimer)
      scannerControls?.stop()
      if (videoRef.current?.srcObject === scannerStream) {
        videoRef.current.srcObject = null
      }
    }

    const submitScannedValue = (rawValue: string) => {
      if (scanned) return
      scanned = true
      const nextQuery = plateFromQr(rawValue)
      setQuery(nextQuery)
      if (validPlateQuery(nextQuery)) {
        closeScanner()
        void searchVehiclesRef.current(nextQuery)
      } else {
        scanned = false
        setScannerError('Mã QR không có biển số hoặc mã tìm kiếm hợp lệ.')
      }
    }

    const startScanner = async () => {
      setScannerError(null)
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
      if (!videoRef.current) {
        return
      }

      try {
        if (!Detector) {
          const { BrowserQRCodeReader } = await import('@zxing/browser')
          if (cancelled || !videoRef.current) return
          const reader = new BrowserQRCodeReader()
          const controls = await reader.decodeFromStream(
            scannerStream,
            videoRef.current,
            (result) => {
              if (result?.getText()) submitScannedValue(result.getText())
            },
          )
          if (cancelled) controls.stop()
          else {
            scannerControls = controls
            setScannerStatus('scanning')
          }
          return
        }

        if (cancelled || !videoRef.current) {
          stopCamera()
          return
        }
        const detector = new Detector({ formats: ['qr_code'] })
        videoRef.current.srcObject = scannerStream
        await videoRef.current.play()
        setScannerStatus('scanning')
        scanTimer = window.setInterval(async () => {
          if (detecting || !videoRef.current) return
          detecting = true
          try {
            const [code] = await detector.detect(videoRef.current)
            if (!code?.rawValue) return
            submitScannedValue(code.rawValue)
          } catch {
            // A frame without a readable code is expected while scanning.
          } finally {
            detecting = false
          }
        }, 300)
      } catch (error) {
        setScannerStatus('error')
        setScannerError(cameraAccessErrorMessage(error))
      }
    }

    void startScanner()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [closeScanner, scannerOpen, scannerStream])

  return <AdminPage>
    <AdminPageHeader
      eyebrow="Phương tiện"
      title="Tìm phương tiện theo biển số"
      description={`Quét QR hoặc nhập biển số. Kết quả được giới hạn trong site đang chọn và cập nhật theo ${realtime === 'live' ? 'realtime' : 'polling'}.`}
    />

    <form onSubmit={submit} className="grid gap-2 sm:flex">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Ví dụ: 51A-123.45" className="pl-9 font-mono uppercase" aria-label="Biển số xe" /></div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" onClick={handleScannerToggle} disabled={!selectedSiteId || scannerStatus === 'requesting'} aria-expanded={scannerOpen} aria-controls="vehicle-qr-scanner">{scannerStatus === 'requesting' ? <Loader2 className="h-4 w-4 animate-spin" /> : scannerOpen ? <X className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}{scannerStatus === 'requesting' ? 'Đang xin quyền' : scannerOpen ? 'Đóng quét' : 'Quét QR'}</Button>
        <Button type="submit" disabled={!selectedSiteId || !validPlateQuery(query) || searchStatus === 'loading'}>{searchStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Tìm kiếm</Button>
      </div>
    </form>

    {scannerOpen && <section id="vehicle-qr-scanner" className="platform-data-surface overflow-hidden p-3 sm:p-4" aria-labelledby="vehicle-qr-scanner-title">
      <div className="mb-3 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-input)] bg-primary/10 text-primary"><QrCode className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h2 id="vehicle-qr-scanner-title" className="font-semibold">Đưa mã QR vào khung hình</h2><p className="mt-1 text-sm text-muted-foreground">Ứng dụng sẽ xin quyền camera của thiết bị trước, ưu tiên camera sau, rồi tự điền biển số khi đọc được QR.</p></div></div>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-input)] bg-black">
        {scannerStream ? <>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Khung xem trước camera quét QR" />
          <div className="pointer-events-none absolute inset-[18%] rounded-[var(--radius-input)] border-2 border-primary shadow-[0_0_0_999px_rgb(0_0_0_/_0.35)]" aria-hidden="true" />
        </> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
          <span className="grid size-14 place-items-center rounded-full bg-white/10">
            {scannerStatus === 'requesting' ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-7" />}
          </span>
          <div>
            <p className="font-medium">{scannerStatus === 'requesting' ? 'Đang chờ bạn cấp quyền camera' : 'Camera chưa sẵn sàng'}</p>
            <p className="mt-1 max-w-md text-sm text-slate-400">Nếu trình duyệt hỏi quyền, hãy chọn “Cho phép” để bắt đầu quét QR.</p>
          </div>
        </div>}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${scannerError ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">{scannerError || scannerStatusMessage(scannerStatus)}</p>
        {(scannerStatus === 'denied' || scannerStatus === 'unavailable' || scannerStatus === 'error') && <Button className="w-full sm:w-auto" type="button" variant="outline" size="sm" onClick={() => void requestCameraAccess()}><Camera className="h-4 w-4" />Cấp quyền lại</Button>}
      </div>
    </section>}

    {!selectedSiteId && <StatePanel icon={MapPin} title="Chưa có site để tìm kiếm" description="Chọn một site hoặc liên hệ quản trị viên để được cấp phạm vi." />}
    {selectedSiteId && searchStatus === 'idle' && <StatePanel icon={Car} title="Nhập biển số để bắt đầu" description="Có thể nhập có hoặc không có dấu chấm và dấu gạch ngang." />}
    {searchStatus === 'loading' && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-muted" />)}</div>}
    {searchStatus === 'empty' && <StatePanel icon={Search} title="Không tìm thấy phương tiện" description={`Không có kết quả cho “${searchQuery}” trong site hiện tại.`} />}
    {searchStatus === 'error' && <StatePanel icon={AlertCircle} title="Không thể tìm kiếm" description={searchError || 'API tìm kiếm đang không khả dụng.'} action={<Button variant="outline" onClick={() => void searchVehicles(query || searchQuery)}>Thử lại</Button>} />}
    {searchStatus === 'ready' && vehicles.length > 0 && <div className="grid gap-4 md:grid-cols-2">{vehicles.map((vehicle) => <VehicleResult key={vehicle.id} vehicle={vehicle} />)}</div>}
  </AdminPage>
}

function VehicleResult({ vehicle }: { vehicle: ReturnType<typeof useDashboardData>['vehicles'][number] }) {
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  React.useEffect(() => setSnapshotFailed(false), [vehicle.snapshotUrl])
  const snapshot = vehicle.snapshotUrl && !snapshotFailed ? vehicle.snapshotUrl : null
  const inSlot = !!vehicle.currentSlotId
  return <Card className="overflow-hidden">
    <div className="flex aspect-video items-center justify-center bg-slate-950">
      {snapshot ? <img src={snapshot} alt={`Ảnh gần nhất của ${vehicle.licensePlateNumber}`} className="h-full w-full object-cover" onError={() => setSnapshotFailed(true)} /> : <div className="flex flex-col items-center gap-2 text-sm text-slate-400"><Camera className="h-9 w-9" />Chưa có snapshot</div>}
    </div>
    <CardHeader><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="min-w-0 break-words font-[family:var(--font-outlier)] text-xl tabular-nums">{vehicle.licensePlateNumber}</CardTitle><Badge className="w-fit" variant={inSlot ? 'default' : 'secondary'}>{inSlot ? 'Trong bãi' : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Không xác định vị trí'}</Badge></div></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{vehicle.currentSlotCode ? `Ô ${vehicle.currentSlotCode}` : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Chưa có dữ liệu ô đỗ'}</span></div>
      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString('vi-VN') : 'Chưa có lần nhìn thấy gần nhất'}</span></div>
      {!inSlot && !snapshot && <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"><WifiOff className="h-4 w-4" />Không có occupancy hiện tại hoặc snapshot gần nhất.</div>}
    </CardContent>
  </Card>
}

function StatePanel({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description: string; action?: React.ReactNode }) {
  return <AdminEmptyState icon={<Icon className="size-6" />} title={title} description={description} action={action} />
}
