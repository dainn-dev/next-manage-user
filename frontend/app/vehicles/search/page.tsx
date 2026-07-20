"use client"

import * as React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Car,
  Clock,
  Loader2,
  MapPin,
  QrCode,
  ScanLine,
  Search,
  WifiOff,
  X,
  RefreshCw,
  Cpu,
  Terminal,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AdminPage, AdminPageHeader } from '@/components/layout/admin-page'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { validPlateQuery } from '@/lib/plate-search.mjs'
import { cn } from '@/lib/utils'

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
      return 'Trình duyệt đang chặn quyền camera. Hãy cho phép camera để quét mã QR.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Không tìm thấy camera phù hợp. Bạn vẫn có thể nhập biển số thủ công.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Camera đang được một ứng dụng khác sử dụng. Vui lòng thử lại sau.'
    default:
      return 'Không thể truy cập camera. Hãy kiểm tra quyền của thiết bị rồi thử lại.'
  }
}

function scannerStatusMessage(status: ScannerStatus): string {
  switch (status) {
    case 'requesting':
      return 'Đang yêu cầu quyền truy cập camera...'
    case 'granted':
      return 'Đã kết nối camera, đang chuẩn bị quét...'
    case 'scanning':
      return 'Đang quét mã QR...'
    case 'denied':
      return 'Trình duyệt đã chặn quyền truy cập camera.'
    case 'unavailable':
      return 'Thiết bị này không hỗ trợ camera.'
    case 'error':
      return 'Không thể khởi động máy quét.'
    default:
      return 'Sẵn sàng kết nối camera.'
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
      setScannerError('Camera chỉ hoạt động trên kết nối bảo mật HTTPS hoặc localhost.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus('unavailable')
      setScannerError('Trình duyệt này không hỗ trợ truy cập camera.')
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
        setScannerError('Mã QR không chứa biển số hợp lệ.')
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

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Phương tiện"
        title="Tra cứu phương tiện"
        description={`Quét mã QR hoặc nhập biển số để tra cứu phương tiện. Dữ liệu được cập nhật ${realtime === 'live' ? 'trực tiếp' : 'định kỳ'}.`}
      />

      <div className="space-y-6">
        <Card className="rounded-2xl border-border bg-card text-foreground shadow-[var(--shadow-card)]">
                    <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Tra cứu phương tiện
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid gap-3 sm:flex">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value.toUpperCase())}
                  placeholder="Nhập biển số, ví dụ 51A-123.45"
                  className="min-h-11 rounded-xl border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-primary/20"
                  aria-label="Biển số xe"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScannerToggle}
                  disabled={!selectedSiteId || scannerStatus === 'requesting'}
                  className="min-h-11 rounded-xl px-4 text-sm"
                  aria-expanded={scannerOpen}
                  aria-controls="vehicle-qr-scanner"
                >
                  {scannerStatus === 'requesting' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : scannerOpen ? (
                    <X className="h-3.5 w-3.5 text-rose-700" />
                  ) : (
                    <ScanLine className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>{scannerStatus === 'requesting' ? 'Đang mở...' : scannerOpen ? 'Đóng máy quét' : 'Quét mã QR'}</span>
                </Button>

                <Button
                  type="submit"
                  disabled={!selectedSiteId || !validPlateQuery(query) || searchStatus === 'loading'}
                  className="min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                >
                  {searchStatus === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>Tra cứu</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {scannerOpen && (
          <section
            id="vehicle-qr-scanner"
            className="rounded-2xl border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
            aria-labelledby="vehicle-qr-scanner-title"
          >
            <div className="mb-4 flex items-start gap-3.5 border-b border-border pb-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <QrCode className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="vehicle-qr-scanner-title" className="text-base font-semibold text-foreground">
                  Quét mã QR
                </h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Đưa mã QR định danh xe vào khung hình. Kết quả hợp lệ sẽ được điền và tra cứu tự động.
                </p>
              </div>
            </div>

            <div className="relative mx-auto aspect-video max-w-2xl overflow-hidden rounded-xl border border-border bg-muted/40">
              {scannerStream ? (
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    aria-label="Khung xem trước camera quét QR"
                  />
                  
                  {/* Camera overlay metadata */}
                  <div className="absolute bottom-3 left-3 rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                    Camera đang hoạt động
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-foreground">
                  <span className="grid size-14 place-items-center rounded-full bg-background border border-border text-muted-foreground shadow-inner">
                    {scannerStatus === 'requesting' ? (
                      <Loader2 className="size-6 animate-spin text-primary" />
                    ) : (
                      <Camera className="size-6 text-muted-foreground" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {scannerStatus === 'requesting' ? 'Đang kết nối camera...' : 'Camera chưa sẵn sàng'}
                    </p>
                    <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">
                      Vui lòng ấn &quot;Cho phép&quot; trong trình duyệt khi được yêu cầu để kích hoạt ống kính camera.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3.5">
              <div className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  scannerError ? "bg-rose-500" : "bg-primary"
                )} />
                <p className={cn(
                  "text-xs tracking-wide",
                  scannerError ? 'text-rose-700' : 'text-muted-foreground'
                )} aria-live="polite">
                  {scannerError || scannerStatusMessage(scannerStatus)}
                </p>
              </div>
              
              {(scannerStatus === 'denied' || scannerStatus === 'unavailable' || scannerStatus === 'error') && (
                <Button
                  className="w-full sm:w-auto border-border bg-background hover:bg-muted text-foreground hover:text-foreground text-sm tracking-wider min-h-11"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void requestCameraAccess()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Cấp quyền lại cho camera
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Dynamic Search result rendering or appropriate Empty Panels */}
        {!selectedSiteId && (
          <StatePanel
            icon={MapPin}
            title="Chưa chọn khu vực"
            description="Vui lòng lựa chọn một phân khu bãi đỗ (site) từ menu điều hướng trên cùng để bắt đầu thực hiện truy vấn."
          />
        )}

        {selectedSiteId && searchStatus === 'idle' && (
          <StatePanel
            icon={Car}
            title="Sẵn sàng tra cứu"
            description="Nhập mã biển số xe thủ công hoặc khởi động quét mã QR định vị để bắt đầu khai thác thông tin từ cơ sở dữ liệu."
          />
        )}

        {searchStatus === 'loading' && (
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="relative min-h-80 animate-pulse overflow-hidden rounded-2xl border border-border bg-muted/20"
              >
                <div className="h-44 bg-muted/80 border-b border-border" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {searchStatus === 'empty' && (
          <StatePanel
            icon={Search}
            title="Không tìm thấy phương tiện"
            description={`Hệ thống không ghi nhận bất kỳ dấu vết nào của phương tiện mang mã biển số “${searchQuery}” trong site hiện hành.`}
          />
        )}

        {searchStatus === 'error' && (
          <StatePanel
            icon={AlertCircle}
            title="Tra cứu chưa thành công"
            description={searchError || 'Hệ thống Gateway API đang quá tải hoặc gặp lỗi đồng bộ hóa. Vui lòng thử lại.'}
            action={
              <Button
                variant="outline"
                className="border-border bg-background/60 hover:bg-muted text-foreground text-xs"
                onClick={() => void searchVehicles(query || searchQuery)}
              >
                Thử lại
              </Button>
            }
          />
        )}

        {searchStatus === 'ready' && vehicles.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {vehicles.map((vehicle) => (
              <VehicleResult key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </AdminPage>
  )
}

function VehicleResult({ vehicle }: { vehicle: ReturnType<typeof useDashboardData>['vehicles'][number] }) {
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  React.useEffect(() => setSnapshotFailed(false), [vehicle.snapshotUrl])
  const snapshot = vehicle.snapshotUrl && !snapshotFailed ? vehicle.snapshotUrl : null
  const inSlot = !!vehicle.currentSlotId

  return (
    <Card className="group overflow-hidden rounded-2xl border-border bg-card text-foreground transition-shadow hover:shadow-[var(--shadow-card)]">
      {/* Snapshot target camera box */}
      <div className="relative aspect-video overflow-hidden bg-muted border-b border-border">
        {snapshot ? (
          <>
            <img
              src={snapshot}
              alt={`Ảnh chụp xe ${vehicle.licensePlateNumber}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setSnapshotFailed(true)}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
            <Camera className="h-6 w-6 text-foreground" />
            <span>Chưa có ảnh camera</span>
          </div>
        )}

        <div className="absolute top-3 left-3 bg-muted border border-border px-2.5 py-0.5 rounded text-xs text-primary tracking-widest">
          Ảnh từ camera
        </div>
      </div>

      <CardHeader className="border-b border-border py-4 px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base font-bold text-foreground tracking-widest select-all">
            {vehicle.licensePlateNumber}
          </CardTitle>
          <Badge
            className={cn(
              "text-xs tracking-wide font-bold px-2 py-0.5 rounded border transition-colors",
              inSlot
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : vehicle.lastEventType === 'exit'
                ? "bg-muted/60 border-border text-muted-foreground"
                : "bg-amber-50 border-amber-200 text-amber-700"
            )}
          >
            {inSlot ? 'Trong bãi' : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Ngoại vi / Chưa xác định'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5 p-5 text-xs text-foreground">
        <div className="flex items-center gap-3.5 bg-muted/20 border border-border px-3.5 py-2 rounded-xl">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground tracking-wider">Vị trí đỗ</p>
            <p className="text-foreground mt-0.5 font-bold">
              {vehicle.currentSlotCode ? `Ô SỐ ${vehicle.currentSlotCode}` : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Chưa xác định vị trí'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-muted/20 border border-border px-3.5 py-2 rounded-xl">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground tracking-wider">Lần ghi nhận gần nhất</p>
            <p className="text-foreground mt-0.5">
              {vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString('vi-VN') : 'N/A'}
            </p>
          </div>
        </div>

        {!inSlot && !snapshot && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/10 p-3 text-sm text-muted-foreground leading-relaxed">
            <WifiOff className="h-4 w-4 shrink-0 text-slate-600" />
            <span>Chưa có vị trí hiện tại hoặc ảnh ghi nhận gần nhất.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatePanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Search
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto my-4 flex min-h-[260px] max-w-xl flex-col items-center justify-center rounded-2xl border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="p-4 rounded-full bg-muted/80 border border-border text-primary mb-4">
        <Icon className="size-6" />
      </div>

      <h3 className="text-xs font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">{description}</p>
      
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
