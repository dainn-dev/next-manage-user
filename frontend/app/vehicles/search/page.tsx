"use client"

import * as React from 'react'
import { AlertCircle, Camera, Car, Clock, Loader2, MapPin, QrCode, ScanLine, Search, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { validPlateQuery } from '@/lib/plate-search.mjs'

type DetectedBarcode = { rawValue?: string }
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance

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
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const { vehicles, searchVehicles, searchStatus, searchError, searchQuery, realtime } = useDashboardData()
  const { selectedSiteId } = useDashboardScope()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void searchVehicles(query)
  }

  React.useEffect(() => {
    if (!scannerOpen) return

    let stream: MediaStream | null = null
    let scanTimer: number | null = null
    let scannerControls: { stop: () => void } | null = null
    let detecting = false
    let cancelled = false
    let scanned = false

    const stopCamera = () => {
      if (scanTimer !== null) window.clearInterval(scanTimer)
      scannerControls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }

    const submitScannedValue = (rawValue: string) => {
      if (scanned) return
      scanned = true
      const nextQuery = plateFromQr(rawValue)
      setQuery(nextQuery)
      setScannerOpen(false)
      if (validPlateQuery(nextQuery)) void searchVehicles(nextQuery)
      else setScannerError('Mã QR không có biển số hoặc mã tìm kiếm hợp lệ.')
    }

    const startScanner = async () => {
      setScannerError(null)
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
      if (!Detector) {
        try {
          const { BrowserQRCodeReader } = await import('@zxing/browser')
          if (cancelled || !videoRef.current) return
          const reader = new BrowserQRCodeReader()
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            videoRef.current,
            (result) => {
              if (result?.getText()) submitScannedValue(result.getText())
            },
          )
          if (cancelled) controls.stop()
          else scannerControls = controls
        } catch {
          setScannerError('Không thể mở camera. Hãy cấp quyền camera rồi thử lại, hoặc nhập biển số thủ công.')
        }
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('Thiết bị không cho phép truy cập camera. Hãy nhập biển số thủ công.')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled || !videoRef.current) {
          stopCamera()
          return
        }
        const detector = new Detector({ formats: ['qr_code'] })
        videoRef.current.srcObject = stream
        await videoRef.current.play()
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
      } catch {
        setScannerError('Không thể mở camera. Hãy cấp quyền camera rồi thử lại, hoặc nhập biển số thủ công.')
      }
    }

    void startScanner()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [scannerOpen, searchVehicles])

  return <div className="admin-mobile-page mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Tìm phương tiện theo biển số</h1><p className="text-sm text-muted-foreground">Quét QR hoặc nhập biển số. Kết quả được giới hạn trong site đang chọn và cập nhật theo {realtime === 'live' ? 'realtime' : 'polling'}.</p></div>

    <form onSubmit={submit} className="grid gap-2 sm:flex">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Ví dụ: 51A-123.45" className="pl-9 font-mono uppercase" aria-label="Biển số xe" /></div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" onClick={() => setScannerOpen((open) => !open)} disabled={!selectedSiteId} aria-expanded={scannerOpen} aria-controls="vehicle-qr-scanner">{scannerOpen ? <X className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}{scannerOpen ? 'Đóng quét' : 'Quét QR'}</Button>
        <Button type="submit" disabled={!selectedSiteId || !validPlateQuery(query) || searchStatus === 'loading'}>{searchStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Tìm kiếm</Button>
      </div>
    </form>

    {scannerOpen && <section id="vehicle-qr-scanner" className="platform-data-surface overflow-hidden p-3 sm:p-4" aria-labelledby="vehicle-qr-scanner-title">
      <div className="mb-3 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-input)] bg-primary/10 text-primary"><QrCode className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h2 id="vehicle-qr-scanner-title" className="font-semibold">Đưa mã QR vào khung hình</h2><p className="mt-1 text-sm text-muted-foreground">Camera sau sẽ được ưu tiên. Sau khi nhận mã, hệ thống tự điền và tìm kiếm.</p></div></div>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-input)] bg-black"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Khung xem trước camera quét QR" /><div className="pointer-events-none absolute inset-[18%] rounded-[var(--radius-input)] border-2 border-primary shadow-[0_0_0_999px_rgb(0_0_0_/_0.35)]" aria-hidden="true" /></div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{scannerError || 'Đang tìm mã QR trong khung hình…'}</p>
    </section>}

    {!selectedSiteId && <StatePanel icon={MapPin} title="Chưa có site để tìm kiếm" description="Chọn một site hoặc liên hệ quản trị viên để được cấp phạm vi." />}
    {selectedSiteId && searchStatus === 'idle' && <StatePanel icon={Car} title="Nhập biển số để bắt đầu" description="Có thể nhập có hoặc không có dấu chấm và dấu gạch ngang." />}
    {searchStatus === 'loading' && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-muted" />)}</div>}
    {searchStatus === 'empty' && <StatePanel icon={Search} title="Không tìm thấy phương tiện" description={`Không có kết quả cho “${searchQuery}” trong site hiện tại.`} />}
    {searchStatus === 'error' && <StatePanel icon={AlertCircle} title="Không thể tìm kiếm" description={searchError || 'API tìm kiếm đang không khả dụng.'} action={<Button variant="outline" onClick={() => void searchVehicles(query || searchQuery)}>Thử lại</Button>} />}
    {searchStatus === 'ready' && vehicles.length > 0 && <div className="grid gap-4 md:grid-cols-2">{vehicles.map((vehicle) => <VehicleResult key={vehicle.id} vehicle={vehicle} />)}</div>}
  </div>
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
    <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle className="font-mono text-xl">{vehicle.licensePlateNumber}</CardTitle><Badge variant={inSlot ? 'default' : 'secondary'}>{inSlot ? 'Trong bãi' : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Không xác định vị trí'}</Badge></div></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{vehicle.currentSlotCode ? `Ô ${vehicle.currentSlotCode}` : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Chưa có dữ liệu ô đỗ'}</span></div>
      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString('vi-VN') : 'Chưa có lần nhìn thấy gần nhất'}</span></div>
      {!inSlot && !snapshot && <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"><WifiOff className="h-4 w-4" />Không có occupancy hiện tại hoặc snapshot gần nhất.</div>}
    </CardContent>
  </Card>
}

function StatePanel({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"><div className="rounded-full bg-muted p-4"><Icon className="h-8 w-8 text-muted-foreground" /></div><div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>
}
