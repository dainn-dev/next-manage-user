"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type QrScannerStatus = "idle" | "requesting" | "granted" | "scanning" | "denied" | "unavailable" | "error"

type DetectedBarcode = { rawValue?: string }
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance
type ScannerControls = { stop: () => void }

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" } },
  audio: false,
}

function cameraAccessErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Trình duyệt đang chặn quyền camera. Hãy cho phép camera để quét mã QR."
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy camera phù hợp. Bạn vẫn có thể nhập mã thủ công."
    case "NotReadableError":
    case "AbortError":
      return "Camera đang được một ứng dụng khác sử dụng. Vui lòng thử lại sau."
    default:
      return "Không thể truy cập camera. Hãy kiểm tra quyền của thiết bị rồi thử lại."
  }
}

export function scannerStatusMessage(status: QrScannerStatus): string {
  switch (status) {
    case "requesting":
      return "Đang yêu cầu quyền truy cập camera…"
    case "granted":
      return "Đã kết nối camera, đang chuẩn bị quét…"
    case "scanning":
      return "Đưa mã QR vào khung hình để quét tự động."
    case "denied":
      return "Trình duyệt đã chặn quyền truy cập camera."
    case "unavailable":
      return "Thiết bị này không hỗ trợ camera."
    case "error":
      return "Không thể khởi động máy quét."
    default:
      return "Sẵn sàng kết nối camera."
  }
}

interface UseQrCameraScannerOptions {
  onDetected: (rawValue: string) => void | Promise<void>
}

export function useQrCameraScanner({ onDetected }: UseQrCameraScannerOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<QrScannerStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<ScannerControls | null>(null)
  const intervalRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const handledRef = useRef(false)
  const onDetectedRef = useRef(onDetected)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stopScannerResources = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    controlsRef.current?.stop()
    controlsRef.current = null

    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  const closeScanner = useCallback(() => {
    sessionRef.current += 1
    handledRef.current = false
    stopScannerResources()
    setIsOpen(false)
    setError(null)
    setStatus("idle")
  }, [stopScannerResources])

  const requestCameraAccess = useCallback(async () => {
    const requestSession = sessionRef.current + 1
    sessionRef.current = requestSession
    handledRef.current = false
    stopScannerResources()
    setIsOpen(true)
    setError(null)
    setStatus("requesting")

    if (!window.isSecureContext) {
      setStatus("unavailable")
      setError("Camera chỉ hoạt động trên kết nối bảo mật HTTPS hoặc localhost.")
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable")
      setError("Trình duyệt này không hỗ trợ truy cập camera.")
      return
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      if (sessionRef.current !== requestSession) {
        nextStream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = nextStream
      setStream(nextStream)
      setStatus("granted")
    } catch (nextError) {
      if (sessionRef.current !== requestSession) return
      const name = nextError instanceof DOMException ? nextError.name : ""
      setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error")
      setError(cameraAccessErrorMessage(nextError))
    }
  }, [stopScannerResources])

  useEffect(() => () => {
    sessionRef.current += 1
    stopScannerResources()
  }, [stopScannerResources])

  useEffect(() => {
    if (!isOpen || !stream) return

    let cancelled = false
    let detecting = false
    const activeSession = sessionRef.current

    const finishScan = async (rawValue: string) => {
      const value = rawValue.trim()
      if (!value || cancelled || handledRef.current || sessionRef.current !== activeSession) return
      handledRef.current = true
      stopScannerResources()
      setIsOpen(false)
      setStatus("idle")
      try {
        await onDetectedRef.current(value)
      } catch {
        // Page-level business actions own their errors and recovery UI.
      }
    }

    const startScanner = async () => {
      const video = videoRef.current
      if (!video) return
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector

      try {
        if (!Detector) {
          const { BrowserQRCodeReader } = await import("@zxing/browser")
          if (cancelled || !video || sessionRef.current !== activeSession) return
          const reader = new BrowserQRCodeReader()
          const controls = await reader.decodeFromStream(stream, video, (result) => {
            if (result?.getText()) void finishScan(result.getText())
          })
          if (cancelled || sessionRef.current !== activeSession) controls.stop()
          else {
            controlsRef.current = controls
            setStatus("scanning")
          }
          return
        }

        if (cancelled || sessionRef.current !== activeSession) return
        video.srcObject = stream
        await video.play()
        if (cancelled || sessionRef.current !== activeSession) return
        const detector = new Detector({ formats: ["qr_code"] })
        setStatus("scanning")
        intervalRef.current = window.setInterval(async () => {
          if (detecting || !videoRef.current || handledRef.current) return
          detecting = true
          try {
            const [code] = await detector.detect(videoRef.current)
            if (code?.rawValue) await finishScan(code.rawValue)
          } catch {
            // A frame without a readable QR code is expected while scanning.
          } finally {
            detecting = false
          }
        }, 300)
      } catch (nextError) {
        if (cancelled || sessionRef.current !== activeSession) return
        setStatus("error")
        setError(cameraAccessErrorMessage(nextError))
      }
    }

    void startScanner()
    return () => {
      cancelled = true
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [isOpen, stopScannerResources, stream])

  return {
    closeScanner,
    error,
    isOpen,
    requestCameraAccess,
    retryScanner: requestCameraAccess,
    status,
    stream,
    videoRef,
  }
}
