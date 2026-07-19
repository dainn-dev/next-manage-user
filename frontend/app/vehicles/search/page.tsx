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
      return 'TRÌNH DUYỆT ĐANG CHẶN QUYỀN CAMERA. VUI LÒNG ĐỔI SANG CHO PHÉP ĐỂ KHỞI CHẠY QUÉT QR.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'KHÔNG TÌM THẤY THIẾT BỊ CAMERA PHÙ HỢP. VUI LÒNG NHẬP BIỂN SỐ THỦ CÔNG.'
    case 'NotReadableError':
    case 'AbortError':
      return 'THIẾT BỊ CAMERA ĐANG BẬN HOẶC BỊ CHIẾM QUYỀN BỞI ỨNG DỤNG KHÁC.'
    default:
      return 'LỖI KHÔNG XÁC ĐỊNH KHI TRUY CẬP CAMERA. HÃY KIỂM TRA QUYỀN THIẾT BỊ.'
  }
}

function scannerStatusMessage(status: ScannerStatus): string {
  switch (status) {
    case 'requesting':
      return 'REQS_CAMERA_ACCESS // ĐANG YÊU CẦU QUYỀN TRUY CẬP...'
    case 'granted':
      return 'CONN_ESTABLISHED // ĐÃ KẾT NỐI, KHỞI ĐỘNG CỔNG QUÉT...'
    case 'scanning':
      return 'MATRIX_DECODER_RUNNING // ĐANG GIẢI MÃ KHUNG HÌNH...'
    case 'denied':
      return 'ACCESS_DENIED // CAMERA BỊ CHẶN BỞI TRÌNH DUYỆT'
    case 'unavailable':
      return 'SYSTEM_UNSUPPORTED // THIẾT BỊ KHÔNG HỖ TRỢ CAMERA'
    case 'error':
      return 'HARDWARE_FAILURE // KHÔNG THỂ KHỞI CHẠY KHUNG QUÉT'
    default:
      return 'READY_TO_CONNECT // SẴN SÀNG KẾT NỐI CAMERA'
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
      setScannerError('CAMERA_REQUIRE_SECURE_CONTEXT // YÊU CẦU KẾT NỐI BẢO MẬT HTTPS HOẶC LOCALHOST.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus('unavailable')
      setScannerError('API_NOT_SUPPORTED // TRÌNH DUYỆT KHÔNG HỖ TRỢ TRUY CẬP THIẾT BỊ ẢNH.')
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
        setScannerError('INVALID_PLATE_FORMAT // MÃ QR KHÔNG CHỨA BIỂN SỐ HỢP LỆ.')
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
      {/* Dynamic CSS styles injection for high-tech custom lasers and frame loops */}
      <style>{`
        @keyframes techScan {
          0% { transform: translateY(0); opacity: 0.8; }
          50% { transform: translateY(220px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.8; }
        }
        .tech-laser-line {
          animation: techScan 2.5s ease-in-out infinite;
        }
      `}</style>

      <AdminPageHeader
        eyebrow="MODULE // PHƯƠNG TIỆN"
        title="TÌM PHƯƠNG TIỆN THEO BIỂN SỐ"
        description={`Quét QR thiết bị hoặc truy vấn mã biển số. Cấu hình định vị site-local và phân giải luồng cập nhật dạng: ${realtime === 'live' ? 'AUTO_REALTIME' : 'POLLING_STATE'}.`}
      />

      <div className="space-y-6">
        {/* Main Terminal Shell Card */}
        <Card className="border border-border bg-card text-foreground shadow-sm relative overflow-hidden backdrop-blur-xl">
          {/* Cyan High-Tech Brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-200" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-200" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-200" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-200" />

          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xs font-mono tracking-wider text-cyan-600 uppercase flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              01 // SYS_VEHICLE_REG_SEARCH // CỦA NGÕ DỮ LIỆU
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid gap-3 sm:flex">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-cyan-600 text-xs font-bold select-none">▶</span>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value.toUpperCase())}
                  placeholder="MÃ BIỂN SỐ (VÍ DỤ: 51A-123.45)..."
                  className="pl-8 bg-background border-border text-foreground placeholder-slate-400 font-mono uppercase h-11 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wider text-sm shadow-inner"
                  aria-label="Biển số xe"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScannerToggle}
                  disabled={!selectedSiteId || scannerStatus === 'requesting'}
                  className="border-border bg-card hover:bg-muted text-slate-700 hover:text-foreground font-mono text-xs uppercase h-11 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                  aria-expanded={scannerOpen}
                  aria-controls="vehicle-qr-scanner"
                >
                  {scannerStatus === 'requesting' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                  ) : scannerOpen ? (
                    <X className="h-3.5 w-3.5 text-rose-700" />
                  ) : (
                    <ScanLine className="h-3.5 w-3.5 text-cyan-600" />
                  )}
                  <span>{scannerStatus === 'requesting' ? 'BUSY...' : scannerOpen ? 'CLOSE_SCAN' : 'SCAN_QR'}</span>
                </Button>

                <Button
                  type="submit"
                  disabled={!selectedSiteId || !validPlateQuery(query) || searchStatus === 'loading'}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-11 px-5 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {searchStatus === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>QUERY_EXEC</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* High-Tech QR Scanner Surface */}
        {scannerOpen && (
          <section
            id="vehicle-qr-scanner"
            className="border border-cyan-200 bg-muted/20 text-foreground rounded-xl p-4 sm:p-5 relative overflow-hidden shadow-sm backdrop-blur-md transition-all duration-300"
            aria-labelledby="vehicle-qr-scanner-title"
          >
            {/* Tech Corners */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-cyan-500" />

            <div className="mb-4 flex items-start gap-3.5 border-b border-border pb-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-cyan-100/50 border border-cyan-200 text-cyan-600 shadow-sm animate-pulse">
                <QrCode className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="vehicle-qr-scanner-title" className="font-mono text-xs font-bold text-cyan-600 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="size-1 bg-cyan-500 rounded-full animate-ping" />
                  QR_MATRIX_DECODER // QUÉT QR TỰ ĐỘNG
                </h2>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground leading-relaxed uppercase">
                  Đưa mã QR định danh xe vào vùng quét. Luồng dữ liệu sẽ giải mã và điền kết quả vào hệ thống ngay lập tức.
                </p>
              </div>
            </div>

            <div className="relative aspect-video max-w-2xl mx-auto overflow-hidden rounded-xl border border-border bg-muted/80 p-1.5 shadow-inner">
              {scannerStream ? (
                <div className="relative w-full h-full overflow-hidden rounded-lg bg-slate-100">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    aria-label="Khung xem trước camera quét QR"
                  />
                  
                  {/* High Tech Reticle Viewfinder */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <div className="w-[50%] h-[55%] border border-cyan-200 rounded relative">
                      {/* Viewfinder corners */}
                      <div className="absolute -top-[1.5px] -left-[1.5px] w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400" />
                      <div className="absolute -top-[1.5px] -right-[1.5px] w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400" />
                      <div className="absolute -bottom-[1.5px] -left-[1.5px] w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400" />
                      <div className="absolute -bottom-[1.5px] -right-[1.5px] w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400" />
                      
                      {/* Reticle center dot */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      </div>

                      {/* Moving tech scanning laser */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee] tech-laser-line" />
                    </div>
                  </div>

                  {/* Camera overlay metadata */}
                  <div className="absolute bottom-3 left-3 bg-muted/80 border border-border px-2 py-0.5 rounded font-mono text-[9px] text-cyan-600 tracking-wider">
                    FEED_STATUS // ARMED
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-700">
                  <span className="grid size-14 place-items-center rounded-full bg-background border border-border text-muted-foreground shadow-inner">
                    {scannerStatus === 'requesting' ? (
                      <Loader2 className="size-6 animate-spin text-cyan-600" />
                    ) : (
                      <Camera className="size-6 text-slate-500" />
                    )}
                  </span>
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-700 uppercase tracking-widest">
                      {scannerStatus === 'requesting' ? 'CAMERA_CONNECTING...' : 'CAMERA_SIGNAL_OFFLINE'}
                    </p>
                    <p className="mt-1.5 max-w-xs font-mono text-[10px] text-slate-500 leading-relaxed uppercase">
                      Vui lòng ấn &quot;Cho phép&quot; trong trình duyệt khi được yêu cầu để kích hoạt ống kính camera.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3.5">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  scannerError ? "bg-rose-500 animate-pulse" : "bg-cyan-500 animate-ping"
                )} />
                <p className={cn(
                  "font-mono text-xs tracking-wide uppercase",
                  scannerError ? 'text-rose-700' : 'text-cyan-600'
                )} aria-live="polite">
                  {scannerError ? `[SYS_ERROR] ${scannerError}` : `[TELEMETRY] ${scannerStatusMessage(scannerStatus)}`}
                </p>
              </div>
              
              {(scannerStatus === 'denied' || scannerStatus === 'unavailable' || scannerStatus === 'error') && (
                <Button
                  className="w-full sm:w-auto border-border bg-background hover:bg-muted text-slate-700 hover:text-foreground font-mono text-[10px] uppercase tracking-wider h-8"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void requestCameraAccess()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5 text-cyan-600" />
                  RECONNECT_CAMERA
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Dynamic Search result rendering or appropriate Empty Panels */}
        {!selectedSiteId && (
          <StatePanel
            icon={MapPin}
            title="NO_ACTIVE_SITE // CHƯA CHỌN SITE"
            description="Vui lòng lựa chọn một phân khu bãi đỗ (site) từ menu điều hướng trên cùng để bắt đầu thực hiện truy vấn."
          />
        )}

        {selectedSiteId && searchStatus === 'idle' && (
          <StatePanel
            icon={Car}
            title="SYSTEM_AWAITING_QUERY // ĐANG CHỜ PHƯƠNG TIỆN"
            description="Nhập mã biển số xe thủ công hoặc khởi động quét mã QR định vị để bắt đầu khai thác thông tin từ cơ sở dữ liệu."
          />
        )}

        {searchStatus === 'loading' && (
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-xl border border-border bg-muted/20 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/10" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/10" />
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
            title="TARGET_NOT_FOUND // KHÔNG TÌM THẤY PHƯƠNG TIỆN"
            description={`Hệ thống không ghi nhận bất kỳ dấu vết nào của phương tiện mang mã biển số “${searchQuery}” trong site hiện hành.`}
          />
        )}

        {searchStatus === 'error' && (
          <StatePanel
            icon={AlertCircle}
            title="API_CONNECTION_ERROR // TRUY VẤN THẤT BẠI"
            description={searchError || 'Hệ thống Gateway API đang quá tải hoặc gặp lỗi đồng bộ hóa. Vui lòng thử lại.'}
            action={
              <Button
                variant="outline"
                className="border-border bg-background/60 hover:bg-muted text-slate-700 font-mono text-xs uppercase"
                onClick={() => void searchVehicles(query || searchQuery)}
              >
                RETRY_TRANSMISSION
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
    <Card className="border border-border bg-card text-foreground shadow-xl relative overflow-hidden backdrop-blur-xl group hover:border-cyan-200 transition-all duration-300">
      {/* Sci-fi tech corner ticks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-200 group-hover:border-cyan-500/50 transition-colors" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-200 group-hover:border-cyan-500/50 transition-colors" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-200 group-hover:border-cyan-500/50 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-200 group-hover:border-cyan-500/50 transition-colors" />

      {/* Snapshot target camera box */}
      <div className="relative aspect-video overflow-hidden bg-slate-100 border-b border-border">
        {snapshot ? (
          <>
            <img
              src={snapshot}
              alt={`Ảnh chụp xe ${vehicle.licensePlateNumber}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setSnapshotFailed(true)}
            />
            {/* Visual tech target overlay on hover */}
            <div className="pointer-events-none absolute inset-0 bg-background/15 mix-blend-overlay" />
            <div className="pointer-events-none absolute inset-4 border border-cyan-500/10 rounded transition-opacity duration-300 group-hover:border-cyan-500/25">
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 font-mono text-[10px] uppercase">
            <Camera className="h-6 w-6 text-slate-700" />
            <span>SNAPSHOT_NOT_FOUND</span>
          </div>
        )}

        {/* Diagnostic tag overlay */}
        <div className="absolute top-3 left-3 bg-muted border border-border px-2.5 py-0.5 rounded font-mono text-[9px] text-cyan-600 uppercase tracking-widest">
          CAM_FEED_SNAPSHOT
        </div>
      </div>

      <CardHeader className="border-b border-border py-4 px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="font-mono text-base font-bold text-foreground tracking-widest uppercase select-all">
            {vehicle.licensePlateNumber}
          </CardTitle>
          <Badge
            className={cn(
              "font-mono text-[10px] tracking-wide uppercase font-bold px-2 py-0.5 rounded border transition-colors",
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

      <CardContent className="space-y-3.5 p-5 font-mono text-xs text-slate-700">
        <div className="flex items-center gap-3.5 bg-muted/20 border border-border px-3.5 py-2 rounded-lg">
          <MapPin className="h-4 w-4 shrink-0 text-cyan-600" />
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">MÃ_PHÂN_VÙNG_Ô_ĐỖ:</p>
            <p className="text-slate-800 mt-0.5 font-bold">
              {vehicle.currentSlotCode ? `Ô SỐ ${vehicle.currentSlotCode}` : vehicle.lastEventType === 'exit' ? 'ĐÃ RỜI BÃI' : 'CHƯA ĐỊNH VỊ VÙNG'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-muted/20 border border-border px-3.5 py-2 rounded-lg">
          <Clock className="h-4 w-4 shrink-0 text-cyan-600" />
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">LẦN_CUỐI_GHI_NHẬN:</p>
            <p className="text-slate-800 mt-0.5">
              {vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString('vi-VN') : 'N/A'}
            </p>
          </div>
        </div>

        {!inSlot && !snapshot && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed uppercase">
            <WifiOff className="h-4 w-4 shrink-0 text-slate-600" />
            <span>Mất liên kết Occupancy hiện tại hoặc Snapshot gần nhất.</span>
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
    <div className="border border-border bg-background/15 rounded-xl p-8 text-center max-w-xl mx-auto flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm min-h-[260px] my-4 shadow-inner">
      {/* Visual corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border" />

      <div className="p-4 rounded-full bg-muted/80 border border-border text-cyan-600/70 shadow-[0_0_15px_rgba(6,182,212,0.05)] mb-4">
        <Icon className="size-6" />
      </div>

      <h3 className="font-mono text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5">{title}</h3>
      <p className="text-[10px] font-mono text-slate-500 max-w-sm leading-relaxed uppercase mb-4">{description}</p>
      
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
