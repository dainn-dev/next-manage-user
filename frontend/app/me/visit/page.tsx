"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { memberApi } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetDismissButton, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useQrCameraScanner, scannerStatusMessage } from "@/hooks/use-qr-camera-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, Camera, Info, KeyRound, Loader2, QrCode, RefreshCw, ScanLine } from "lucide-react"

export default function MemberVisitPage() {
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const claimInFlightRef = useRef(false)
  const { toast } = useToast()
  const router = useRouter()

  const claimCode = useCallback(async (rawCode: string) => {
    const nextCode = rawCode.trim()
    setCode(nextCode)
    if (!nextCode || claimInFlightRef.current) return

    claimInFlightRef.current = true
    setSubmitting(true)
    try {
      const session = await memberApi.claimSession(nextCode)
      toast({
        title: "Đã gắn phiên gửi xe thành công",
        description: `${session.licensePlate} · ${session.tenantName || "ParkVision"}`,
      })
      router.push(`/me/visit/${session.sessionId}`)
    } catch (err) {
      toast({
        title: "Không claim được mã QR",
        description: err instanceof Error ? err.message : "Mã không hợp lệ hoặc đã hết hạn",
        variant: "destructive",
      })
    } finally {
      claimInFlightRef.current = false
      setSubmitting(false)
    }
  }, [router, toast])

  const scanner = useQrCameraScanner({ onDetected: claimCode })

  const onClaim = (event: React.FormEvent) => {
    event.preventDefault()
    void claimCode(code)
  }

  const scannerUnavailable = scanner.status === "denied" || scanner.status === "unavailable" || scanner.status === "error"

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader>
          <p className="text-xs font-semibold tracking-wide text-primary">Khu vực thành viên</p>
          <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Liên kết vé gửi xe</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">
            Quét mã QR trên vé bằng camera hoặc nhập mã phiên để theo dõi vị trí xe trong phiên gửi hiện tại.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="gap-5 lg:col-span-3">
          <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <div className="row-span-2 grid size-11 place-items-center rounded-full bg-primary-container text-primary">
              <QrCode className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg">Quét hoặc nhập mã phiên gửi xe</CardTitle>
            <CardDescription>Hãy quét mã QR in trên vé hoặc dán mã hiển thị dưới QR code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onClaim} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qr-code" className="text-sm font-medium">Mã QR hoặc mã phiên</Label>
                <Input
                  id="qr-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Dán mã từ vé hoặc quét bằng camera"
                  autoComplete="off"
                  disabled={submitting}
                  required
                  className="h-12 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="tonal"
                  className="min-h-12 w-full"
                  onClick={() => void scanner.requestCameraAccess()}
                  disabled={submitting || scanner.status === "requesting"}
                  aria-expanded={scanner.isOpen}
                  aria-controls="member-visit-qr-scanner"
                >
                  {scanner.status === "requesting" ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                  {scanner.status === "requesting" ? "Đang mở camera…" : "Quét QR bằng camera"}
                </Button>
                <Button type="submit" disabled={submitting || !code.trim()} className="min-h-12 w-full" data-state={submitting ? "loading" : undefined}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  {submitting ? "Đang liên kết phiên…" : "Liên kết và theo dõi xe"}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-4 bg-muted/35 lg:col-span-2">
          <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <div className="row-span-2 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground"><Info className="size-5" aria-hidden="true" /></div>
            <CardTitle className="text-base">Cách sử dụng</CardTitle>
            <CardDescription>Chỉ mất vài giây để liên kết vé với tài khoản của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2"><span className="grid size-7 place-items-center rounded-full bg-primary-container text-xs font-semibold text-primary">1</span><span><strong className="font-medium text-foreground">Quét QR hoặc sao chép mã</strong><br />Tìm mã in trên vé gửi xe do bãi đỗ cung cấp.</span></li>
              <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2"><span className="grid size-7 place-items-center rounded-full bg-primary-container text-xs font-semibold text-primary">2</span><span><strong className="font-medium text-foreground">Liên kết với tài khoản</strong><br />Sau khi xác nhận, bạn có thể xem vị trí xe được bãi đỗ cập nhật.</span></li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <Sheet open={scanner.isOpen} onOpenChange={(open) => !open && scanner.closeScanner()}>
        <SheetContent side="bottom" className="mx-auto max-h-[min(44rem,calc(100dvh-1rem))] w-full max-w-xl">
          <SheetHeader>
            <div className="min-w-0">
              <SheetTitle>Quét mã QR trên vé</SheetTitle>
              <SheetDescription>Đưa mã QR vào giữa khung hình. Camera sẽ tự nhận diện và liên kết phiên gửi xe.</SheetDescription>
            </div>
            <SheetDismissButton label="Đóng máy quét QR" />
          </SheetHeader>
          <div id="member-visit-qr-scanner" className="grid gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted">
              {scanner.stream ? (
                <video ref={scanner.videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Khung xem trước camera quét QR" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-card)]">
                    {scanner.status === "requesting" ? <Loader2 className="size-6 animate-spin text-primary" /> : <Camera className="size-6" />}
                  </span>
                  <p className="text-sm leading-6 text-muted-foreground">{scannerStatusMessage(scanner.status)}</p>
                </div>
              )}
              {scanner.stream && <div className="pointer-events-none absolute inset-5 rounded-[var(--radius-input)] border-2 border-primary/70" aria-hidden="true" />}
            </div>

            <div className="rounded-[var(--radius-input)] bg-muted p-3 text-sm leading-6 text-muted-foreground" aria-live="polite">
              {scanner.error || scannerStatusMessage(scanner.status)}
            </div>

            {scannerUnavailable && (
              <Button type="button" variant="outline" onClick={() => void scanner.retryScanner()} disabled={submitting}>
                <RefreshCw className="size-4" />
                Cấp quyền hoặc thử lại
              </Button>
            )}
            <p className="text-center text-xs leading-5 text-muted-foreground">Không dùng được camera? Đóng máy quét và nhập mã in trên vé theo cách thủ công.</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
