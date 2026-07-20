"use client"
/* eslint-disable @next/next/no-img-element -- source images are signed, immutable commissioning stills */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Camera as CameraIcon,
  Check,
  CheckCircle2,
  ClipboardCopy,
  CloudUpload,
  Copy,
  Download,
  Eye,
  FileClock,
  KeyRound,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCw,
  Save,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useToast } from "@/hooks/use-toast"
import { cameraApi, type Camera, type CameraPanelType, type CameraRole, type CameraStatus, type CameraWriteRequest } from "@/lib/api/camera-api"
import {
  archiveMap,
  captureStill,
  createCalibration,
  createMap,
  getUnifiedPreview,
  getStill,
  exportMap,
  importMap,
  listMaps,
  publishMap,
  rollbackMap,
  updateMap,
  uploadStill,
  validateCalibration,
  validateMap,
  type CalibrationPoint,
  type CalibrationPreview,
  type CalibrationVersion,
  type ParkingMapDraft,
  type ParkingMapSlot,
  type PixelPoint,
  type SourceImage,
  type UnifiedMapPreview,
} from "@/lib/api/parking-commissioning-api"
import { zoneApi, type Zone } from "@/lib/api/zone-api"
import { useAuth } from "@/lib/auth-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { calibrationInputReady, mapPublishReady, offsetSlotCopy, zoneDeletionBlockers } from "@/lib/parking-commissioning-policy.mjs"
import { UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEPS = [
  { key: "site", label: "Bãi xe", icon: MapPinned },
  { key: "zones", label: "Zones", icon: ShieldCheck },
  { key: "cameras", label: "Cameras", icon: Video },
  { key: "calibration", label: "Calibration", icon: Eye },
  { key: "map", label: "Parking Map", icon: Pencil },
  { key: "verify", label: "Verify", icon: CheckCircle2 },
] as const

type StepKey = typeof STEPS[number]["key"]
type SlotSnapshot = ParkingMapSlot[]

const EMPTY_CAMERA: CameraWriteRequest = {
  siteId: "",
  zoneId: null,
  name: "",
  rtspUrl: "",
  role: "OVERVIEW",
  panelType: null,
  status: "provisioned",
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi không xác định"
}

function cloneSlots(slots: ParkingMapSlot[]): ParkingMapSlot[] {
  return slots.map((slot) => ({
    ...slot,
    adminStatus: ({ enabled: "ACTIVE", disabled: "DISABLED", retired: "DISABLED" } as Record<string, ParkingMapSlot["adminStatus"]>)[slot.adminStatus] || slot.adminStatus,
    pixelVertices: slot.pixelVertices.map((point) => ({ ...point })),
  }))
}

function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "online" || status === "PUBLISHED" || status === "ACTIVE") return "default"
  if (status === "offline" || status === "DISABLED") return "destructive"
  return "secondary"
}

export default function ParkingCommissioningPage() {
  const { user } = useAuth()
  const { sites, selectedSiteId, isLoading: sitesLoading } = useDashboardScope()
  const { toast } = useToast()
  const [step, setStep] = useState<StepKey>("site")
  const [zones, setZones] = useState<Zone[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState("")
  const [loadingScope, setLoadingScope] = useState(false)

  const [zoneDialog, setZoneDialog] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [zoneName, setZoneName] = useState("")
  const [cameraDialog, setCameraDialog] = useState(false)
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null)
  const [cameraForm, setCameraForm] = useState<CameraWriteRequest>(EMPTY_CAMERA)
  const [busy, setBusy] = useState(false)
  const [credential, setCredential] = useState<{ cameraName: string; key: string; expiresAt?: string | null } | null>(null)

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [controlPoints, setControlPoints] = useState<CalibrationPoint[]>([])
  const [calibrationPreview, setCalibrationPreview] = useState<CalibrationPreview | null>(null)
  const [calibration, setCalibration] = useState<CalibrationVersion | null>(null)

  const [history, setHistory] = useState<ParkingMapDraft[]>([])
  const [unifiedPreview, setUnifiedPreview] = useState<UnifiedMapPreview | null>(null)
  const [draft, setDraft] = useState<ParkingMapDraft | null>(null)
  const [slots, setSlots] = useState<ParkingMapSlot[]>([])
  const [currentPolygon, setCurrentPolygon] = useState<PixelPoint[]>([])
  const [slotCode, setSlotCode] = useState("")
  const [slotZoneId, setSlotZoneId] = useState("")
  const [slotStatus, setSlotStatus] = useState<ParkingMapSlot["adminStatus"]>("ACTIVE")
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [undoStack, setUndoStack] = useState<SlotSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<SlotSnapshot[]>([])
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null)
  const [publishDialog, setPublishDialog] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ slot: number; vertex: number } | null>(null)
  const autosaveRef = useRef(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const selectedCamera = cameras.find((camera) => camera.id === selectedCameraId) || null
  const overviewCameras = useMemo(() => cameras.filter((camera) => camera.role === "OVERVIEW"), [cameras])
  const currentStepIndex = STEPS.findIndex((item) => item.key === step)
  const canIssueCredentials = user?.role === UserRole.ADMIN || user?.role === UserRole.SITE_MANAGER

  const loadScope = useCallback(async (siteId: string) => {
    setLoadingScope(true)
    try {
      const [nextZones, nextCameras] = await Promise.all([zoneApi.list(siteId), cameraApi.list(siteId)])
      setZones(nextZones)
      setCameras(nextCameras)
      setSlotZoneId((current) => nextZones.some((zone) => zone.id === current) ? current : nextZones[0]?.id || "")
      setSelectedCameraId((current) => nextCameras.some((camera) => camera.id === current)
        ? current
        : nextCameras.find((camera) => camera.role === "OVERVIEW")?.id || nextCameras[0]?.id || "")
    } catch (error) {
      toast({ title: "Không tải được cấu hình site", description: errorMessage(error), variant: "destructive" })
    } finally {
      setLoadingScope(false)
    }
  }, [toast])

  useEffect(() => {
    if (!selectedSiteId) {
      setZones([])
      setCameras([])
      setSelectedCameraId("")
      return
    }
    void loadScope(selectedSiteId)
  }, [selectedSiteId, loadScope])

  const loadHistory = useCallback(async () => {
    if (!selectedSiteId || !selectedCameraId) {
      setHistory([])
      setDraft(null)
      setSourceImage(null)
      setCalibration(null)
      return
    }
    try {
      const maps = await listMaps(selectedSiteId, selectedCameraId)
      setHistory(maps)
      const editable = maps.find((item) => item.status === "DRAFT") || null
      const resumable = editable || maps.find((item) => item.status === "PUBLISHED") || null
      setDraft(editable)
      setSlots(editable ? cloneSlots(editable.slots) : [])
      if (resumable) {
        const still = await getStill(selectedSiteId, selectedCameraId, resumable.sourceImageId)
        setSourceImage(still)
        setCalibration((current) => current?.id === resumable.calibrationVersionId ? current : {
          id: resumable.calibrationVersionId,
          siteId: selectedSiteId,
          cameraId: selectedCameraId,
          versionNumber: 0,
          homography: [],
          reprojectionError: 0,
          coordinateSpace: "site-local-meters-v1",
        })
      } else {
        setSourceImage(null)
        setCalibration(null)
      }
      setDirty(false)
      setValidation(null)
    } catch (error) {
      toast({ title: "Không tải được lịch sử bản đồ", description: errorMessage(error), variant: "destructive" })
    }
  }, [selectedSiteId, selectedCameraId, toast])

  useEffect(() => { void loadHistory() }, [loadHistory])

  useEffect(() => {
    if (step !== "verify" || !selectedSiteId) return
    let cancelled = false
    getUnifiedPreview(selectedSiteId)
      .then((preview) => { if (!cancelled) setUnifiedPreview(preview) })
      .catch((error) => { if (!cancelled) toast({ title: "Không tải được unified preview", description: errorMessage(error), variant: "destructive" }) })
    return () => { cancelled = true }
  }, [step, selectedSiteId, toast])

  const mapPayload = useCallback(() => {
    const width = sourceImage?.nativeWidth || 1
    const height = sourceImage?.nativeHeight || 1
    return {
      sourceImageId: sourceImage?.id || draft?.sourceImageId || "",
      calibrationVersionId: calibration?.id || draft?.calibrationVersionId || "",
      coveragePixelVertices: draft?.coveragePixelVertices?.length
        ? draft.coveragePixelVertices
        : [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }],
      slots,
    }
  }, [sourceImage, calibration, draft, slots])

  const saveDraft = useCallback(async (silent = false) => {
    if (!selectedSiteId || !selectedCameraId || !draft || draft.status !== "DRAFT") return false
    setSaveState("saving")
    try {
      const saved = await updateMap(selectedSiteId, selectedCameraId, draft, mapPayload())
      setDraft(saved)
      setHistory((items) => items.map((item) => item.id === saved.id ? saved : item))
      setDirty(false)
      setSaveState("saved")
      if (!silent) toast({ title: "Đã lưu bản nháp" })
      return true
    } catch (error) {
      setSaveState("error")
      if (!silent) toast({ title: "Lưu bản nháp thất bại", description: errorMessage(error), variant: "destructive" })
      return false
    }
  }, [selectedSiteId, selectedCameraId, draft, mapPayload, toast])

  useEffect(() => {
    if (!dirty || !draft || draft.status !== "DRAFT" || autosaveRef.current) return
    const timer = window.setTimeout(() => {
      autosaveRef.current = true
      void saveDraft(true).finally(() => { autosaveRef.current = false })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [dirty, draft, slots, saveDraft])

  const changeSlots = (next: ParkingMapSlot[]) => {
    setUndoStack((stack) => [...stack.slice(-29), cloneSlots(slots)])
    setRedoStack([])
    setSlots(next)
    setDirty(true)
    setValidation(null)
    setSaveState("idle")
  }

  const undo = () => {
    const previous = undoStack.at(-1)
    if (!previous) return
    setRedoStack((stack) => [...stack, cloneSlots(slots)])
    setUndoStack((stack) => stack.slice(0, -1))
    setSlots(cloneSlots(previous))
    setDirty(true)
  }

  const redo = () => {
    const next = redoStack.at(-1)
    if (!next) return
    setUndoStack((stack) => [...stack, cloneSlots(slots)])
    setRedoStack((stack) => stack.slice(0, -1))
    setSlots(cloneSlots(next))
    setDirty(true)
  }

  const openZone = (zone?: Zone) => {
    setEditingZone(zone || null)
    setZoneName(zone?.name || "")
    setZoneDialog(true)
  }

  const saveZone = async () => {
    if (!selectedSiteId || !zoneName.trim()) return
    setBusy(true)
    try {
      if (editingZone) await zoneApi.update({ ...editingZone, name: zoneName.trim() })
      else await zoneApi.create(selectedSiteId, zoneName.trim())
      setZoneDialog(false)
      await loadScope(selectedSiteId)
      toast({ title: editingZone ? "Đã cập nhật zone" : "Đã tạo zone" })
    } catch (error) {
      toast({ title: "Không lưu được zone", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const removeZone = async (zone: Zone) => {
    const dependent = zoneDeletionBlockers(zone.id, cameras)
    if (dependent.length) {
      toast({
        title: "Chưa thể xóa zone",
        description: `Hãy chuyển ${dependent.length} camera (${dependent.join(", ")}) sang zone khác trước.`,
        variant: "destructive",
      })
      return
    }
    if (!window.confirm(`Xóa zone “${zone.name}”?`)) return
    try {
      await zoneApi.delete(zone.id)
      if (selectedSiteId) await loadScope(selectedSiteId)
      toast({ title: "Đã xóa zone" })
    } catch (error) {
      toast({ title: "Không thể xóa zone an toàn", description: errorMessage(error), variant: "destructive" })
    }
  }

  const openCamera = (camera?: Camera) => {
    setEditingCamera(camera || null)
    setCameraForm(camera ? {
      siteId: camera.siteId,
      zoneId: camera.zoneId,
      name: camera.name,
      rtspUrl: "",
      role: camera.role,
      panelType: camera.panelType,
      status: camera.status,
    } : { ...EMPTY_CAMERA, siteId: selectedSiteId || "", zoneId: zones[0]?.id || null })
    setCameraDialog(true)
  }

  const saveCamera = async () => {
    if (!selectedSiteId || !cameraForm.name.trim()) return
    setBusy(true)
    const payload: CameraWriteRequest = {
      ...cameraForm,
      siteId: selectedSiteId,
      name: cameraForm.name.trim(),
      zoneId: cameraForm.zoneId || null,
      rtspUrl: cameraForm.rtspUrl?.trim() || null,
      panelType: cameraForm.role === "ANPR_GATE" ? cameraForm.panelType || "entry" : null,
    }
    try {
      const saved = editingCamera
        ? await cameraApi.update(editingCamera.id, payload)
        : await cameraApi.create(payload)
      setCameraDialog(false)
      await loadScope(selectedSiteId)
      setSelectedCameraId(saved.id)
      toast({ title: editingCamera ? "Đã cập nhật camera" : "Đã tạo camera" })
    } catch (error) {
      toast({ title: "Không lưu được camera", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const removeCamera = async (camera: Camera) => {
    if (!window.confirm(`Xóa camera “${camera.name}”? Các bản đồ phụ thuộc có thể ngăn thao tác này.`)) return
    try {
      await cameraApi.delete(camera.id)
      if (selectedSiteId) await loadScope(selectedSiteId)
      toast({ title: "Đã xóa camera" })
    } catch (error) {
      toast({ title: "Không thể xóa camera an toàn", description: errorMessage(error), variant: "destructive" })
    }
  }

  const revealCredential = async (camera: Camera, rotate: boolean) => {
    setBusy(true)
    try {
      const result = rotate
        ? await cameraApi.rotateCredential(camera.id)
        : await cameraApi.issueCredential(camera.id)
      setCredential({ cameraName: camera.name, key: result.ingestKey, expiresAt: result.previousKeyExpiresAt })
    } catch (error) {
      toast({ title: rotate ? "Không xoay được khóa" : "Không cấp được khóa", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const handleImageUpload = async (file?: File) => {
    if (!file || !selectedSiteId || !selectedCameraId) return
    setBusy(true)
    try {
      const image = await uploadStill(selectedSiteId, selectedCameraId, file)
      setSourceImage(image)
      setControlPoints([])
      setCalibrationPreview(null)
      setCalibration(null)
      setDraft(null)
      setSlots([])
      toast({ title: "Đã tải ảnh nền", description: `${image.nativeWidth} × ${image.nativeHeight}px` })
    } catch (error) {
      toast({ title: "Tải ảnh thất bại", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const addCalibrationPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!sourceImage || controlPoints.length >= 12) return
    const rect = event.currentTarget.getBoundingClientRect()
    const pixelX = Math.round((event.clientX - rect.left) / rect.width * sourceImage.nativeWidth)
    const pixelY = Math.round((event.clientY - rect.top) / rect.height * sourceImage.nativeHeight)
    setControlPoints((points) => [...points, { pixelX, pixelY, siteX: 0, siteY: 0 }])
    setCalibrationPreview(null)
  }

  const runCalibrationValidation = async () => {
    if (!selectedSiteId || !selectedCameraId || !sourceImage || controlPoints.length < 4) return
    setBusy(true)
    try {
      const result = await validateCalibration(selectedSiteId, selectedCameraId, sourceImage.id, controlPoints)
      setCalibrationPreview(result)
      toast({ title: "Calibration hợp lệ", description: `Sai số tái chiếu ${result.reprojectionError.toFixed(3)} px` })
    } catch (error) {
      setCalibrationPreview(null)
      toast({ title: "Calibration chưa hợp lệ", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const saveCalibrationVersion = async () => {
    if (!selectedSiteId || !selectedCameraId || !sourceImage || !calibrationPreview) return
    setBusy(true)
    try {
      const saved = await createCalibration(selectedSiteId, selectedCameraId, sourceImage.id, controlPoints)
      setCalibration(saved)
      toast({ title: `Đã tạo calibration v${saved.versionNumber}` })
      setStep("map")
    } catch (error) {
      toast({ title: "Không tạo được calibration", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const startDraft = async () => {
    if (!selectedSiteId || !selectedCameraId || !sourceImage || !calibration) return
    setBusy(true)
    try {
      const created = await createMap(selectedSiteId, selectedCameraId, {
        sourceImageId: sourceImage.id,
        calibrationVersionId: calibration.id,
        coveragePixelVertices: [
          { x: 0, y: 0 },
          { x: sourceImage.nativeWidth, y: 0 },
          { x: sourceImage.nativeWidth, y: sourceImage.nativeHeight },
          { x: 0, y: sourceImage.nativeHeight },
        ],
        slots: [],
      })
      setDraft(created)
      setHistory((items) => [created, ...items])
      setSlots([])
      toast({ title: "Đã tạo bản nháp bản đồ" })
    } catch (error) {
      toast({ title: "Không tạo được bản nháp", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const editorPoint = (event: React.PointerEvent<SVGSVGElement>): PixelPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = sourceImage?.nativeWidth || 1
    const height = sourceImage?.nativeHeight || 1
    return {
      x: Math.max(0, Math.min(width, pan.x + (event.clientX - rect.left) / rect.width * width / zoom)),
      y: Math.max(0, Math.min(height, pan.y + (event.clientY - rect.top) / rect.height * height / zoom)),
    }
  }

  const editorClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (dragging || !draft || draft.status !== "DRAFT") return
    const point = editorPoint(event as unknown as React.PointerEvent<SVGSVGElement>)
    setCurrentPolygon((points) => [...points, point])
  }

  const finishPolygon = () => {
    if (currentPolygon.length < 3 || !slotCode.trim() || !slotZoneId) return
    changeSlots([...slots, {
      zoneId: slotZoneId,
      code: slotCode.trim(),
      adminStatus: slotStatus,
      pixelVertices: currentPolygon,
    }])
    setCurrentPolygon([])
    setSlotCode("")
  }

  const dragVertex = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return
    const point = editorPoint(event)
    setSlots((items) => items.map((slot, slotIndex) => slotIndex !== dragging.slot ? slot : {
      ...slot,
      pixelVertices: slot.pixelVertices.map((vertex, vertexIndex) => vertexIndex === dragging.vertex ? point : vertex),
    }))
    setDirty(true)
  }

  const copySlot = (index: number) => {
    const original = slots[index]
    if (!original) return
    const copy = offsetSlotCopy(original) as ParkingMapSlot
    changeSlots([...slots, copy])
    setSelectedSlot(slots.length)
  }

  const updateSlot = (index: number, patch: Partial<Pick<ParkingMapSlot, "code" | "zoneId" | "adminStatus">>) => {
    setSlots((items) => items.map((slot, itemIndex) => itemIndex === index ? { ...slot, ...patch } : slot))
    setDirty(true)
    setValidation(null)
    setSaveState("idle")
  }

  const runMapValidation = async () => {
    if (!selectedSiteId || !selectedCameraId || !draft) return
    if (dirty && !await saveDraft(true)) {
      toast({ title: "Chưa thể validate", description: "Bản nháp chưa lưu được; không publish dữ liệu cũ.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const result = await validateMap(selectedSiteId, selectedCameraId, draft.id)
      setValidation(result)
      toast({
        title: result.valid ? "Bản đồ hợp lệ" : "Bản đồ cần chỉnh sửa",
        description: result.valid ? "Có thể publish phiên bản này." : `${result.errors.length} lỗi được phát hiện.`,
        variant: result.valid ? "default" : "destructive",
      })
    } catch (error) {
      toast({ title: "Không kiểm tra được bản đồ", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const confirmPublish = async () => {
    if (!selectedSiteId || !selectedCameraId || !draft || !validation?.valid) return
    setBusy(true)
    try {
      const published = await publishMap(selectedSiteId, selectedCameraId, draft)
      setDraft(null)
      setHistory((items) => items.map((item) => item.id === published.id ? published : item))
      setPublishDialog(false)
      toast({ title: `Đã publish bản đồ v${published.versionNumber}` })
      setStep("verify")
    } catch (error) {
      toast({ title: "Publish thất bại", description: errorMessage(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const readiness = useMemo(() => [
    { label: "Đã chọn site", ok: Boolean(selectedSiteId) },
    { label: "Site có ít nhất một zone", ok: zones.length > 0 },
    { label: "Có camera OVERVIEW", ok: overviewCameras.length > 0 },
    { label: "Camera đã online hoặc gửi heartbeat", ok: overviewCameras.some((camera) => camera.status === "online" || camera.lastHeartbeatAt) },
    { label: "Có calibration hợp lệ trong phiên làm việc", ok: Boolean(calibration || history.some((item) => item.calibrationVersionId)) },
    { label: "Có parking map đã publish", ok: history.some((item) => item.status === "PUBLISHED") },
  ], [selectedSiteId, zones.length, overviewCameras, calibration, history])

  const handleImport = async (file: File) => {
    if (!selectedSiteId || !selectedCameraId || !sourceImage || !calibration) return
    setBusy(true)
    try {
      const geoJson = JSON.parse(await file.text()) as unknown
      const imported = await importMap(selectedSiteId, selectedCameraId, sourceImage.id, calibration.id, geoJson)
      setDraft(imported)
      setSlots(cloneSlots(imported.slots))
      setHistory((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
      setDirty(false)
      setValidation(null)
      toast({ title: `Đã nhập GeoJSON vào bản nháp v${imported.versionNumber}` })
    } catch (error) {
      toast({ title: "Nhập GeoJSON thất bại", description: errorMessage(error), variant: "destructive" })
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  const handleExport = async (item: ParkingMapDraft) => {
    if (!selectedSiteId || !selectedCameraId) return
    try {
      const blob = await exportMap(selectedSiteId, selectedCameraId, item.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `parking-map-v${item.versionNumber}.geojson`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({ title: "Xuất GeoJSON thất bại", description: errorMessage(error), variant: "destructive" })
    }
  }

  return (
    <AdminPage className="space-y-5">
      <AdminPageHeader
        eyebrow="Thiết lập vận hành"
        title="Thiết lập bãi đỗ"
        description={
          <>
            <span>Cấu hình bãi xe, khu vực, camera, hiệu chỉnh và sơ đồ bãi đỗ theo từng bước rõ ràng.</span>
            <span className="mt-2 block">
              {selectedSiteId ? `Bãi xe của tổ chức: ${sites[0]?.name || "Đã sẵn sàng"}` : "Chưa có bãi xe vận hành"}
            </span>
          </>
        }
        actionList={[
          {
            key: "role",
            content: <Badge variant="secondary" className="w-fit rounded-full px-3 py-1.5 text-sm">
              <ShieldCheck className="mr-1.5 size-4" />
              {user?.role === UserRole.ADMIN ? "Quản trị viên" : "Quản lý vận hành"}
            </Badge>,
          },
        ]}
      />

      <nav
        aria-label="Các bước thiết lập bãi đỗ"
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-2 rounded-3xl border border-border bg-card p-2 lg:grid lg:min-w-0 lg:grid-cols-6">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            const active = item.key === step
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStep(item.key)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:min-w-0",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs", active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground")}>
                  {index + 1}
                </span>
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {step === "site" && (
        <Card className="border-border bg-card shadow-sm">
          
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              01 // BÃI XE VẬN HÀNH
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Tenant chỉ có một bãi xe; mọi khu vực, camera và sơ đồ bên dưới thuộc bãi xe này.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {sitesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground font-medium">
                {"[NO_OPERATING_FACILITY]"} Chưa có bãi xe vận hành cho tenant này.
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
                    <MapPinned className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{sites[0]?.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{sites[0]?.location || "Chưa khai báo địa chỉ"}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "zones" && (
        <Card className="border-border bg-card shadow-sm">

          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-4">
            <div>
              <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                02 // QUẢN LÝ ZONES
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Quản lý các vùng thuộc site đã chọn; hệ thống chặn xóa khi còn camera phụ thuộc.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => openZone()}
              disabled={!selectedSiteId}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-sm h-11 rounded-xl"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Thêm zone
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingScope ? (
              <Loading />
            ) : zones.length === 0 ? (
              <Empty text="Site chưa có zone." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                <Table>
                  <TableHeader className="bg-card border-b border-border">
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="font-medium text-muted-foreground text-xs tracking-wider h-11">Tên zone</TableHead>
                      <TableHead className="font-medium text-muted-foreground text-xs tracking-wider h-11">Camera phụ thuộc</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground text-xs tracking-wider h-11">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((zone) => (
                      <TableRow key={zone.id} className="border-b border-border hover:bg-muted/10">
                        <TableCell className="font-medium font-bold text-foreground py-3">{zone.name}</TableCell>
                        <TableCell className="py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs text-foreground font-medium">
                            {cameras.filter((camera) => camera.zoneId === zone.id).length} cameras
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openZone(zone)}
                              className="border-border bg-card hover:bg-muted hover:text-foreground size-11 p-0 rounded-xl"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-border bg-card text-rose-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 size-11 p-0 rounded-xl"
                              onClick={() => void removeZone(zone)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "cameras" && (
        <div className="space-y-4">
          <Card className="border-border bg-card shadow-sm">

            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-4">
              <div>
                <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  03 // ĐĂNG KÝ CAMERAS
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Đăng ký camera, vai trò xử lý, RTSP, tình trạng kết nối và thông tin edge.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => openCamera()}
                disabled={!selectedSiteId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-sm h-11 rounded-xl"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Thêm camera
              </Button>
            </CardHeader>

            <CardContent className="pt-6">
              {loadingScope ? (
                <Loading />
              ) : cameras.length === 0 ? (
                <Empty text="Site chưa có camera." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cameras.map((camera) => {
                    const zoneName = zones.find((zone) => zone.id === camera.zoneId)?.name || "Toàn site"
                    const heartbeat = camera.lastHeartbeatAt ? new Date(camera.lastHeartbeatAt).toLocaleString("vi-VN") : "chưa có"
                    const isOnline = camera.status === "online"
                    const isOffline = camera.status === "offline"
                    const statusClass = isOnline
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isOffline
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-muted text-muted-foreground border-border"

                    return (
                      <div
                        key={camera.id}
                        className="rounded-2xl border border-border bg-muted/20 p-5 hover:border-primary/30 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium font-bold",
                              statusClass
                            )}>
                              <span className={cn("size-1 rounded-full", isOnline ? "bg-emerald-400 animate-pulse" : isOffline ? "bg-rose-400" : "bg-slate-600")} />
                              {camera.status}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {camera.role}
                            </span>
                          </div>

                          <div className="flex gap-3 mb-4">
                            <div className="rounded-xl bg-muted border border-border p-2.5 text-muted-foreground self-start">
                              <CameraIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium font-bold text-foreground text-sm truncate tracking-tight group-hover:text-primary">
                                {camera.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 font-medium">
                                {zoneName}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 border-t border-border pt-3 mb-5 text-sm font-medium text-muted-foreground">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">HEARTBEAT:</span>
                              <span className="text-foreground">{heartbeat}</span>
                            </div>
                            {camera.panelType && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">PANEL_TYPE:</span>
                                <span className="text-foreground">{camera.panelType}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto border-t border-border pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCamera(camera)}
                            className="border-border bg-card hover:bg-muted hover:text-foreground h-11 flex-1 font-medium text-xs"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Sửa
                          </Button>

                          {canIssueCredentials && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void revealCredential(camera, false)}
                                disabled={busy}
                                className="border-border bg-card hover:bg-primary/10 hover:border-primary/20 text-foreground hover:text-primary h-11 font-medium text-xs"
                                title="Cấp khóa"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void revealCredential(camera, true)}
                                disabled={busy}
                                className="border-border bg-card hover:bg-primary/10 hover:border-primary/20 text-foreground hover:text-primary h-11 font-medium text-xs"
                                title="Xoay khóa"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border bg-card text-rose-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 h-11 px-2.5"
                            onClick={() => void removeCamera(camera)}
                            title="Xóa camera"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-primary/20/10 bg-primary/5 text-foreground shadow-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-primary/20" />
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium tracking-wider text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> EDGE_COMMUNICATION_GUIDELINES
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-sm font-medium leading-relaxed text-muted-foreground space-y-1">
              <p>1. Khóa ingest chỉ hiển thị một lần duy nhất khi cấp mới hoặc xoay khóa.</p>
              <p>2. Lưu khóa vào secret store an toàn trên edge agent, thiết lập SITE_ID & CAMERA_ID tương ứng.</p>
              <p>3. Tuyệt đối không ghi khóa ingest trực tiếp vào logs hệ thống hoặc file cấu hình nguồn công khai.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "calibration" && (
        <div className="space-y-4">
          <Card className="border-border bg-card shadow-sm">

            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                04 // HIỆU CHỈNH CALIBRATION
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium text-sm">
                Chọn camera OVERVIEW, tải một ảnh tĩnh và đánh dấu ít nhất 4 điểm kiểm soát với tọa độ site-local tính bằng mét.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Camera OVERVIEW">
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                      <SelectValue placeholder="Chọn camera" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      {overviewCameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id} className="focus:bg-muted focus:text-foreground font-medium text-xs">
                          {camera.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                
                <Field label="Ảnh nền">
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant="outline"
                      asChild
                      disabled={!selectedCameraId || busy}
                      className="border-border bg-card hover:bg-muted text-foreground hover:text-foreground h-11 font-medium text-xs"
                    >
                      <label className="cursor-pointer flex items-center gap-1.5">
                        <Upload className="h-4 w-4" /> Tải ảnh
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="sr-only"
                          onChange={(event) => void handleImageUpload(event.target.files?.[0])}
                        />
                      </label>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedCameraId || busy}
                      onClick={() => selectedSiteId && selectedCameraId && void captureStill(selectedSiteId, selectedCameraId).catch((error) => toast({ title: "Camera chưa hỗ trợ chụp trực tiếp", description: errorMessage(error), variant: "destructive" }))}
                      className="border-border bg-card hover:bg-muted text-foreground hover:text-foreground h-11 font-medium text-xs"
                    >
                      <CameraIcon className="mr-1.5 h-4 w-4 text-primary" /> Chụp trực tiếp
                    </Button>
                  </div>
                </Field>
              </div>

              {overviewCameras.length === 0 && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Hãy tạo ít nhất một camera có vai trò OVERVIEW trước khi thực hiện hiệu chỉnh calibration.
                </div>
              )}

              {sourceImage && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
                  {/* Left Side: Interactive Canvas Image */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium tracking-wider text-muted-foreground block">IMAGE_COORDINATES_CANVAS (NHẤP ĐỂ THÊM ĐIỂM)</span>
                    <div
                      className="relative overflow-hidden rounded-2xl border border-border bg-slate-100 cursor-crosshair group shadow-sm"
                      onClick={addCalibrationPoint}
                    >
                      <img src={sourceImage.readUrl} alt="Ảnh calibration" className="block h-auto w-full select-none" />
                      {controlPoints.map((point, index) => (
                        <span
                          key={`${point.pixelX}-${point.pixelY}-${index}`}
                          className="pointer-events-none absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400 bg-primary/5 text-sm font-medium font-bold text-primary shadow-sm transition-all animate-bounce"
                          style={{
                            left: `${point.pixelX / sourceImage.nativeWidth * 100}%`,
                            top: `${point.pixelY / sourceImage.nativeHeight * 100}%`
                          }}
                        >
                          {index + 1}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Side: Inputs & Results */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <p className="font-medium text-xs font-bold text-foreground">
                          ĐIỂM KIỂM SOÁT ({controlPoints.length}/4+)
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setControlPoints([]); setCalibrationPreview(null) }}
                          className="text-muted-foreground hover:text-rose-600 hover:bg-rose-950/10 font-medium text-xs h-11"
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Xóa hết
                        </Button>
                      </div>

                      <div className="max-h-[380px] space-y-3.5 overflow-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                        {controlPoints.map((point, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-3.5 rounded-xl border border-border bg-card p-3"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium font-bold text-primary">
                              {index + 1}
                            </span>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground block">X MET · PX {point.pixelX}</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={point.siteX}
                                onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteX: Number(event.target.value) } : item))}
                                className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground block">Y MET · PX {point.pixelY}</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={point.siteY}
                                onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteY: Number(event.target.value) } : item))}
                                className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setControlPoints((points) => points.filter((_, itemIndex) => itemIndex !== index))}
                              className="text-muted-foreground hover:text-rose-600 size-11 p-0 hover:bg-rose-50 rounded-xl mt-4"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border mt-auto">
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs h-11 rounded-xl shadow-sm"
                        disabled={!calibrationInputReady(controlPoints) || busy}
                        onClick={() => void runCalibrationValidation()}
                      >
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Tính & kiểm tra phép chiếu
                      </Button>

                      {calibrationPreview && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/15 p-4 space-y-3">
                          <div className="flex items-center gap-2 text-emerald-600 font-medium font-bold text-xs">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Preview hợp lệ
                          </div>
                          <p className="text-xs text-foreground font-medium">
                            Sai số tái chiếu (reprojection error):{" "}
                            <span className="text-emerald-600 font-bold">{calibrationPreview.reprojectionError.toFixed(3)} px</span>
                          </p>
                          <Button
                            size="sm"
                            className="w-full bg-emerald-700 hover:bg-emerald-800 text-foreground font-medium font-bold text-xs h-11 rounded-xl"
                            onClick={() => void saveCalibrationVersion()}
                            disabled={busy}
                          >
                            <Save className="mr-1.5 h-4 w-4" /> Tạo phiên bản calibration
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">

            <CardHeader className="border-b border-border pb-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    05 // THIẾT KẾ SƠ ĐỒ BÃI ĐỖ
                  </CardTitle>
                  <CardDescription className="text-muted-foreground font-medium text-sm mt-1">
                    Nhấp trên ảnh để vẽ vùng; kéo các điểm để điều chỉnh.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".geojson,.json,application/geo+json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void handleImport(file)
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-card hover:bg-muted text-foreground hover:text-foreground font-medium text-xs h-11"
                    onClick={() => importInputRef.current?.click()}
                    disabled={busy || Boolean(draft) || !sourceImage || !calibration}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    <span>Nhập GeoJSON</span>
                  </Button>

                  <div className="flex items-center gap-1 bg-muted p-0.5 rounded-xl border border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-11 p-0 text-muted-foreground hover:text-foreground"
                      onClick={undo}
                      disabled={!undoStack.length}
                      title="Hoàn tác"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-11 p-0 text-muted-foreground hover:text-foreground"
                      onClick={redo}
                      disabled={!redoStack.length}
                      title="Làm lại"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => void saveDraft()}
                    disabled={!draft || !dirty}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs h-11 px-3 rounded-xl"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {saveState === "saving" ? "Đang lưu…" : saveState === "saved" ? "Đã lưu" : "Lưu sơ đồ"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-background/65 border border-border px-3.5 py-2 rounded-xl text-xs font-medium">
                <span className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  saveState === "error"
                    ? "bg-rose-500"
                    : saveState === "saving"
                    ? "animate-pulse bg-amber-500"
                    : dirty
                    ? "bg-amber-500"
                    : draft
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-slate-700"
                )} />
                <span className="text-muted-foreground">
                  {!sourceImage || !calibration
                    ? "Hãy hoàn tất bước hiệu chỉnh để bắt đầu vẽ sơ đồ."
                    : saveState === "error"
                    ? "Tự động lưu thất bại — nhấn Lưu sơ đồ để thử lại."
                    : saveState === "saving"
                    ? "Đang tự động lưu…"
                    : dirty
                    ? "Có thay đổi chưa lưu trên bản nháp"
                    : draft
                    ? "Bản nháp đã được đồng bộ với Cloud"
                    : "Sẵn sàng khởi tạo bản nháp"}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-2">
                <Field label="Camera OVERVIEW">
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                      <SelectValue placeholder="Chọn camera" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border text-foreground">
                      {overviewCameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id} className="focus:bg-muted focus:text-foreground font-medium text-xs">
                          {camera.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center">
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed pl-1">
                    [INFO] Ảnh nền và calibration đi theo camera. Sử dụng bước Calibration để tải ảnh hoặc chụp ảnh trực tiếp mới trước khi vẽ sơ đồ.
                  </p>
                </div>
              </div>

              {!sourceImage || !calibration ? (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Hoàn tất calibration trong phiên làm việc này trước khi tạo một bản đồ mới.
                </div>
              ) : !draft ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-background/15">
                  <p className="mb-4 text-xs font-medium text-muted-foreground">
                    Chưa có bản nháp sơ đồ nào cho ảnh và calibration đang chọn.
                  </p>
                  <Button
                    onClick={() => void startDraft()}
                    disabled={busy}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs h-11 rounded-xl"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Tạo bản nháp sơ đồ mới
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_340px]">
                    {/* SVG Interactive Editor Container */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-2xl">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Tỷ lệ:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border bg-card hover:bg-muted text-foreground size-11 p-0"
                            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-1 text-xs font-medium text-primary font-bold min-w-[50px] text-center">
                            {Math.round(zoom * 100)}%
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border bg-card hover:bg-muted text-foreground size-11 p-0"
                            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Navigation / Pan Controls */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Di chuyển:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-11 p-0 font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setPan((value) => ({ ...value, y: Math.max(0, value.y - 30) }))}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-11 p-0 font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setPan((value) => ({ ...value, x: Math.max(0, value.x - 30) }))}
                          >
                            ←
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-11 p-0 font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setPan((value) => ({ ...value, x: value.x + 30 }))}
                          >
                            →
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-11 p-0 font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setPan((value) => ({ ...value, y: value.y + 30 }))}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>

                      {/* SVG Canvas Board */}
                      <div className="overflow-hidden rounded-2xl border border-border bg-slate-100 relative group shadow-sm">
                        <svg
                          role="img"
                          aria-label="Trình vẽ ô đỗ"
                          className="block aspect-video w-full touch-none select-none"
                          viewBox={`${pan.x} ${pan.y} ${(sourceImage.nativeWidth || 1) / zoom} ${(sourceImage.nativeHeight || 1) / zoom}`}
                          onClick={editorClick}
                          onPointerMove={dragVertex}
                          onPointerUp={() => setDragging(null)}
                          onPointerLeave={() => setDragging(null)}
                        >
                          <image href={sourceImage.readUrl} x="0" y="0" width={sourceImage.nativeWidth} height={sourceImage.nativeHeight} preserveAspectRatio="none" />
                          {slots.map((slot, slotIndex) => (
                            <g
                              key={`${slot.code}-${slotIndex}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedSlot(slotIndex)
                              }}
                              className="cursor-pointer group/slot"
                            >
                              <polygon
                                points={slot.pixelVertices.map((point) => `${point.x},${point.y}`).join(" ")}
                                fill={selectedSlot === slotIndex ? "rgba(6,182,212,0.45)" : "rgba(16,185,129,0.25)"}
                                stroke={selectedSlot === slotIndex ? "#06b6d4" : "#10b981"}
                                strokeWidth={selectedSlot === slotIndex ? 4 / zoom : 2.5 / zoom}
                                className="transition-colors group-hover/slot:fill-cyan-500/30"
                              />
                              {slot.pixelVertices.map((point, vertexIndex) => (
                                <circle
                                  key={vertexIndex}
                                  cx={point.x}
                                  cy={point.y}
                                  r={selectedSlot === slotIndex ? 8 / zoom : 6 / zoom}
                                  fill={selectedSlot === slotIndex ? "#22d3ee" : "#fff"}
                                  stroke={selectedSlot === slotIndex ? "#0891b2" : "#10b981"}
                                  strokeWidth={2 / zoom}
                                  onPointerDown={(event) => {
                                    event.stopPropagation()
                                    setUndoStack((stack) => [...stack.slice(-29), cloneSlots(slots)])
                                    setDragging({ slot: slotIndex, vertex: vertexIndex })
                                  }}
                                  className="cursor-move hover:scale-125 transition-transform"
                                />
                              ))}
                              <text
                                x={slot.pixelVertices[0]?.x}
                                y={(slot.pixelVertices[0]?.y || 0) - 8 / zoom}
                                fill="black"
                                fontSize={20 / zoom}
                                stroke="white"
                                strokeWidth={0.8}
                                className="font-medium font-bold select-none text-shadow-md"
                              >
                                {slot.code}
                              </text>
                            </g>
                          ))}
                          {currentPolygon.length > 0 && (
                            <polyline
                              points={currentPolygon.map((point) => `${point.x},${point.y}`).join(" ")}
                              fill="rgba(245,158,11,0.2)"
                              stroke="#f59e0b"
                              strokeWidth={3 / zoom}
                            />
                          )}
                        </svg>
                      </div>
                    </div>

                    {/* Editor Action sidebar panels */}
                    <div className="space-y-4">
                      {/* Active Slot Form */}
                      <Card className="border border-border bg-muted/10 rounded-2xl p-4 space-y-4">
                        <div className="border-b border-border pb-2">
                          <p className="font-medium text-xs font-bold text-primary flex items-center gap-1.5">
                            <span className="size-1 rounded-full bg-primary animate-ping" />
                            Ô ĐANG VẼ
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <Field label="Mã ô đỗ">
                            <Input
                              value={slotCode}
                              onChange={(event) => setSlotCode(event.target.value)}
                              placeholder="Ví dụ: A-01"
                              className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl"
                            />
                          </Field>
                          
                          <Field label="Vùng Zone">
                            <Select value={slotZoneId} onValueChange={setSlotZoneId}>
                              <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                                <SelectValue placeholder="Chọn zone" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border text-foreground">
                                {zones.map((zone) => (
                                  <SelectItem key={zone.id} value={zone.id} className="focus:bg-muted focus:text-foreground font-medium text-xs">
                                    {zone.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field label="Trạng thái quản trị">
                            <Select value={slotStatus} onValueChange={(value) => setSlotStatus(value as ParkingMapSlot["adminStatus"])}>
                              <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border text-foreground">
                                <SelectItem value="ACTIVE" className="focus:bg-muted font-medium text-xs text-emerald-600">ACTIVE</SelectItem>
                                <SelectItem value="RESERVED" className="focus:bg-muted font-medium text-xs text-amber-600">RESERVED</SelectItem>
                                <SelectItem value="DISABLED" className="focus:bg-muted font-medium text-xs text-rose-600">DISABLED</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>

                          <div className="flex gap-2 pt-2">
                            <Button
                              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold text-sm tracking-wide h-11 rounded-xl"
                              disabled={currentPolygon.length < 3 || !slotCode.trim() || !slotZoneId}
                              onClick={finishPolygon}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Hoàn tất ô đỗ
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setCurrentPolygon([])}
                              className="border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground size-11 p-0"
                              title="Hủy nét vẽ hiện tại"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>

                      {/* Selected Slot Inspector */}
                      {selectedSlot !== null && slots[selectedSlot] && (
                        <Card className="border border-primary/20 bg-primary/10 rounded-2xl p-4 space-y-4">
                          <div className="border-b border-primary/20 pb-2">
                            <p className="font-medium text-xs font-bold text-primary flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-cyan-400" />
                              CHỈNH SỬA Ô ĐÃ CHỌN
                            </p>
                          </div>

                          <div className="space-y-3.5">
                            <Field label="Mã ô đỗ">
                              <Input
                                value={slots[selectedSlot].code}
                                onChange={(event) => updateSlot(selectedSlot, { code: event.target.value })}
                                className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl"
                              />
                            </Field>

                            <Field label="Vùng Zone">
                              <Select
                                value={slots[selectedSlot].zoneId}
                                onValueChange={(value) => updateSlot(selectedSlot, { zoneId: value })}
                              >
                                <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border text-foreground">
                                  {zones.map((zone) => (
                                    <SelectItem key={zone.id} value={zone.id} className="focus:bg-muted focus:text-foreground font-medium text-xs">
                                      {zone.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>

                            <Field label="Trạng thái">
                              <Select
                                value={slots[selectedSlot].adminStatus}
                                onValueChange={(value) => updateSlot(selectedSlot, { adminStatus: value as ParkingMapSlot["adminStatus"] })}
                              >
                                <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border text-foreground">
                                  <SelectItem value="ACTIVE" className="focus:bg-muted font-medium text-xs text-emerald-600">ACTIVE</SelectItem>
                                  <SelectItem value="RESERVED" className="focus:bg-muted font-medium text-xs text-amber-600">RESERVED</SelectItem>
                                  <SelectItem value="DISABLED" className="focus:bg-muted font-medium text-xs text-rose-600">DISABLED</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>

                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copySlot(selectedSlot)}
                                className="border-border bg-card hover:bg-muted text-foreground h-11 font-medium text-xs"
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" /> Sao chép
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border bg-card text-rose-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 h-11 font-medium text-xs ml-auto"
                                onClick={() => {
                                  changeSlots(slots.filter((_, index) => index !== selectedSlot))
                                  setSelectedSlot(null)
                                }}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Xóa
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )}

                      <div className="p-3 bg-muted rounded-xl border border-slate-950 text-xs font-medium text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>SỐ_Ô_BẢN_ĐỒ:</span>
                          <span className="text-primary font-bold">{slots.length} slots</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ĐỈNH_ĐANG_VẼ:</span>
                          <span className="text-foreground">{currentPolygon.length} vertexes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>TỰ_ĐỘNG_SẮP_XẾP:</span>
                          <span className={cn(dirty ? "text-amber-600" : "text-emerald-600")}>{dirty ? "dirty_state" : "synchronized"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sync & Publish Control block */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/10 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSlots(draft ? cloneSlots(draft.slots) : [])
                        setDirty(false)
                        setValidation(null)
                      }}
                      disabled={!dirty}
                      className="border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground h-11 font-medium text-xs"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Bỏ thay đổi nháp
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void runMapValidation()}
                        disabled={busy || slots.length === 0}
                        className="border-border bg-card hover:bg-muted text-foreground hover:text-foreground h-11 font-medium text-xs"
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4 text-primary" /> Validate
                      </Button>
                      <Button
                        onClick={() => setPublishDialog(true)}
                        disabled={!mapPublishReady(draft, validation) || busy}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs h-11 px-4 rounded-xl"
                      >
                        <CloudUpload className="mr-1.5 h-4 w-4" /> Publish sơ đồ
                      </Button>
                    </div>
                  </div>

                  {validation && !validation.valid && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/25 p-4 space-y-2">
                      <p className="font-medium text-xs font-bold text-rose-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Chưa thể publish sơ đồ bãi đỗ
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-xs text-foreground font-medium">
                        {validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <History
            history={history}
            onRefresh={() => void loadHistory()}
            onExport={handleExport}
            onArchive={async (item) => {
              if (!selectedSiteId || !selectedCameraId) return
              await archiveMap(selectedSiteId, selectedCameraId, item)
              await loadHistory()
            }}
            onRollback={async (item) => {
              if (!selectedSiteId || !selectedCameraId) return
              const reason = window.prompt("Lý do rollback phiên bản này?")?.trim()
              if (!reason) return
              await rollbackMap(selectedSiteId, selectedCameraId, item, reason)
              await loadHistory()
              setStep("verify")
            }}
          />
        </div>
      )}

      {step === "verify" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Left panel: Readiness Checklist */}
          <Card className="border-border bg-card shadow-sm">

            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                06 // KIỂM TRA CHỈ SỐ SẴN SÀNG (VERIFY)
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium text-sm mt-1">
                Kiểm tra nhanh chất lượng dữ liệu trước khi bàn giao site cho vận hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-6">
              {readiness.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 font-medium text-xs transition-all",
                    item.ok
                      ? "border-emerald-200 bg-emerald-50/25 text-emerald-700"
                      : "border-amber-200 bg-amber-50/25 text-amber-700"
                  )}
                >
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="leading-relaxed">{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Right panel: Unified Site-local Preview */}
          <Card className="border-border bg-card shadow-sm">

            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                UNIFIED SITE-LOCAL PREVIEW
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium text-sm mt-1">
                Tất cả camera được ghép chung hệ tọa độ site-local-meters-v1; pixel của từng ảnh không bị trộn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 relative p-1.5 shadow-sm">
                {unifiedPreview ? <UnifiedSiteMap preview={unifiedPreview} /> : <Loading />}
              </div>

              <div className="space-y-2.5">
                {overviewCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-border"
                  >
                    <div>
                      <p className="font-medium text-xs font-bold text-foreground">{camera.name}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">
                        {zones.find((zone) => zone.id === camera.zoneId)?.name || "Toàn bộ Site"} · {camera.status}
                      </p>
                    </div>
                    <Badge className="border-primary/20 bg-primary/20 text-primary font-medium text-xs font-bold tracking-wider rounded px-2 py-0.5">
                      {unifiedPreview?.features.filter((feature) => feature.cameraId === camera.id).length || 0} slots
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Buttons Row */}
      <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
        <Button
          variant="outline"
          disabled={currentStepIndex === 0}
          onClick={() => setStep(STEPS[currentStepIndex - 1].key)}
          className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted font-medium text-xs h-11 px-5 rounded-2xl transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
        </Button>
        <Button
          disabled={currentStepIndex === STEPS.length - 1 || (currentStepIndex === 0 && !selectedSiteId)}
          onClick={() => setStep(STEPS[currentStepIndex + 1].key)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs h-11 px-6 rounded-2xl transition-all shadow-sm"
        >
          Tiếp tục <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Modern High-Tech Modals / Dialogs */}
      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
        <DialogContent className="bg-background border border-border text-foreground font-medium max-w-md p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-sm font-medium tracking-wider text-primary">
              {editingZone ? "CHỈNH SỬA VÙNG ZONE" : "KÍCH HOẠT VÙNG ZONE MỚI"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Field label="Tên Vùng Zone">
              <Input
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                placeholder="Ví dụ: Tầng hầm B1, Khu vực A"
                className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl focus-visible:ring-primary"
              />
            </Field>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              variant="outline"
              onClick={() => setZoneDialog(false)}
              className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted font-medium text-xs rounded-xl h-11"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void saveZone()}
              disabled={busy || !zoneName.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs rounded-xl h-11 px-4"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu cấu hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cameraDialog} onOpenChange={setCameraDialog}>
        <DialogContent className="bg-background border border-border text-foreground font-medium sm:max-w-2xl p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-sm font-medium tracking-wider text-primary">
              {editingCamera ? "CHỈNH SỬA CAMERA" : "THIẾT LẬP THIẾT BỊ CAMERA"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm font-medium">
              RTSP URL là thông tin hệ thống nhạy cảm và sẽ được mã hóa đầu cuối.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 py-4">
            <Field label="Tên Camera">
              <Input
                value={cameraForm.name}
                onChange={(event) => setCameraForm((form) => ({ ...form, name: event.target.value }))}
                className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl focus-visible:ring-primary"
              />
            </Field>
            <Field label="Phân vùng Zone">
              <Select
                value={cameraForm.zoneId || "site-wide"}
                onValueChange={(value) => setCameraForm((form) => ({ ...form, zoneId: value === "site-wide" ? null : value }))}
              >
                <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="site-wide" className="focus:bg-muted font-medium text-xs">Toàn bộ site</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id} className="focus:bg-muted font-medium text-xs">
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vai trò nghiệp vụ">
              <Select
                value={cameraForm.role}
                onValueChange={(value) => setCameraForm((form) => ({ ...form, role: value as CameraRole, panelType: value === "OVERVIEW" ? null : form.panelType || "entry" }))}
              >
                <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="OVERVIEW" className="focus:bg-muted font-medium text-xs text-primary">OVERVIEW (Bản đồ)</SelectItem>
                  <SelectItem value="ANPR_GATE" className="focus:bg-muted font-medium text-xs text-purple-400">ANPR_GATE (Nhận diện cổng)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {cameraForm.role === "ANPR_GATE" && (
              <Field label="Loại cổng kiểm soát (Panel Type)">
                <Select
                  value={cameraForm.panelType || "entry"}
                  onValueChange={(value) => setCameraForm((form) => ({ ...form, panelType: value as CameraPanelType }))}
                >
                  <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    <SelectItem value="entry" className="focus:bg-muted font-medium text-xs text-emerald-600">ENTRY (Lối vào)</SelectItem>
                    <SelectItem value="exit" className="focus:bg-muted font-medium text-xs text-amber-600">EXIT (Lối ra)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Trạng thái vật lý">
              <Select
                value={cameraForm.status || "provisioned"}
                onValueChange={(value) => setCameraForm((form) => ({ ...form, status: value as CameraStatus }))}
              >
                <SelectTrigger className="w-full bg-card border-border text-foreground font-medium h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="provisioned" className="focus:bg-muted font-medium text-xs text-muted-foreground">PROVISIONED</SelectItem>
                  <SelectItem value="online" className="focus:bg-muted font-medium text-xs text-emerald-600">ONLINE</SelectItem>
                  <SelectItem value="offline" className="focus:bg-muted font-medium text-xs text-rose-600">OFFLINE</SelectItem>
                  <SelectItem value="disabled" className="focus:bg-muted font-medium text-xs text-slate-600">DISABLED</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label={editingCamera ? "Thay đổi RTSP URL mới (để trống nếu giữ nguyên)" : "Địa chỉ liên kết RTSP"}>
                <Input
                  type="password"
                  autoComplete="off"
                  value={cameraForm.rtspUrl || ""}
                  onChange={(event) => setCameraForm((form) => ({ ...form, rtspUrl: event.target.value }))}
                  placeholder="rtsp://admin:password@192.168.1.100:554/stream1"
                  className="bg-background border-border text-foreground text-xs font-medium h-11 rounded-xl focus-visible:ring-primary"
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              variant="outline"
              onClick={() => setCameraDialog(false)}
              className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted font-medium text-xs rounded-xl h-11"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void saveCamera()}
              disabled={busy || !cameraForm.name.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs rounded-xl h-11 px-4"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu thiết bị
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}>
        <DialogContent className="bg-background border border-border text-foreground font-medium max-w-lg p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary animate-ping" />
              KHÓA KẾT NỐI INGEST // {credential?.cameraName}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm font-medium mt-1">
              Khóa token này chỉ xuất hiện duy nhất một lần. Sao chép và lưu trữ an toàn trong secret manager của Edge Agent ngay lập tức.
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <div className="rounded-xl border border-primary/20 bg-primary/15 p-4 font-medium text-xs text-primary break-all select-all tracking-wider relative group shadow-sm">
              {credential?.key}
            </div>
            {credential?.expiresAt && (
              <p className="text-xs font-medium text-muted-foreground mt-2.5">
                Khóa cũ của thiết bị vẫn sẽ tiếp tục duy trì hiệu lực đến hết ngày: {new Date(credential.expiresAt).toLocaleString("vi-VN")}.
              </p>
            )}
          </div>
          <DialogFooter className="pt-4 border-t border-border">
            <Button
              onClick={() => credential && void navigator.clipboard.writeText(credential.key).then(() => toast({ title: "Đã sao chép khóa kết nối" }))}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs rounded-xl h-11 w-full"
            >
              <ClipboardCopy className="mr-2 h-4 w-4" /> Sao chép Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent className="bg-background border border-border text-foreground font-medium max-w-md p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-sm font-medium tracking-wider text-primary">
              XÁC NHẬN PUBLISH SƠ ĐỒ?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm font-medium mt-1">
              Phiên bản thiết kế sơ đồ này sẽ ngay lập tức được biên dịch và áp dụng làm cấu hình vận hành chính thức mới cho bãi đỗ.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-xs font-medium text-foreground bg-card rounded-xl border border-border p-3.5">
            <p className="flex justify-between">
              <span className="text-muted-foreground">THIẾT BỊ CAMERA:</span>
              <span className="text-foreground font-bold">{selectedCamera?.name}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground font-medium">TỔNG SỐ Ô ĐỖ:</span>
              <span className="text-primary font-bold">{slots.length} slots</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">HIỆU CHỈNH:</span>
              <span className="text-foreground font-bold">Calibration v{calibration?.versionNumber || "hiện tại"}</span>
            </p>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              variant="outline"
              onClick={() => setPublishDialog(false)}
              className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted font-medium text-xs rounded-xl h-11"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void confirmPublish()}
              disabled={busy || !validation?.valid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-bold tracking-wider text-xs rounded-xl h-11 px-4"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Xác nhận Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-xs tracking-wider text-muted-foreground pl-0.5">{label}</Label>
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex min-h-36 items-center justify-center bg-muted/20 rounded-2xl border border-border">
      <div className="flex flex-col items-center gap-2 font-medium text-xs text-primary">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="animate-pulse tracking-widest text-xs mt-1">LOADING_STREAM...</span>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-muted/10">
      <p className="text-xs font-medium text-muted-foreground">{text}</p>
    </div>
  )
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-500/5 p-4 text-xs font-medium text-amber-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

function UnifiedSiteMap({ preview }: { preview: UnifiedMapPreview }) {
  const points = preview.features.flatMap((feature) => feature.polygon)
  if (!points.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-background text-xs font-medium text-muted-foreground tracking-wider">
        Không có dữ liệu bản đồ
      </div>
    )
  }
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const width = Math.max(1, Math.max(...points.map((point) => point.x)) - minX)
  const height = Math.max(1, Math.max(...points.map((point) => point.y)) - minY)
  
  return (
    <svg
      aria-label="Unified site-local parking map"
      className="aspect-video w-full rounded-xl bg-background border border-border"
      viewBox={`${minX - 5} ${minY - 5} ${width + 10} ${height + 10}`}
    >
      {preview.features.map((feature, index) => (
        <g key={`${feature.mapVersionId}-${feature.slotId}-${index}`} className="group/unified-slot">
          <polygon
            points={feature.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="rgba(16,185,129,0.2)"
            stroke="#10b981"
            strokeWidth={Math.max(width, height) / 180}
            className="transition-colors group-hover/unified-slot:fill-emerald-500/30"
          />
          <text
            x={feature.polygon[0]?.x}
            y={(feature.polygon[0]?.y || 0) - 0.3}
            fill="black"
            fontSize={Math.max(width, height) / 38}
            className="font-medium font-bold fill-emerald-700 select-none text-shadow"
          >
            {feature.code}
          </text>
        </g>
      ))}
    </svg>
  )
}

function History({
  history,
  onRefresh,
  onExport,
  onArchive,
  onRollback,
}: {
  history: ParkingMapDraft[]
  onRefresh: () => void
  onExport: (item: ParkingMapDraft) => Promise<void>
  onArchive: (item: ParkingMapDraft) => Promise<void>
  onRollback: (item: ParkingMapDraft) => Promise<void>
}) {
  return (
    <Card className="border-border bg-card shadow-sm">

      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium tracking-wider text-primary flex items-center gap-2">
            LỊCH SỬ PHIÊN BẢN (VERSION LOG)
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-sm mt-1">
            Bản nháp, bản chính và lưu trữ được định danh an toàn.
          </CardDescription>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="Làm mới lịch sử phiên bản"
            title="Làm mới"
            className="size-11 border-border bg-background hover:bg-muted text-foreground hover:text-foreground rounded-xl p-0 shadow-none"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      
      <CardContent className="pt-4">
        {history.length === 0 ? (
          <Empty text="Thiết bị camera này chưa ghi nhận phiên bản bản đồ nào." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader className="border-b border-border">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="font-medium text-xs text-muted-foreground h-11">Mã Phiên Bản</TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground h-11">Trạng Thái</TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground h-11">Số Ô Đỗ</TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground h-11">Khóa Đồng Bộ</TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground h-11 text-right">Hành Động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id} className="border-b border-border hover:bg-muted/20">
                    <TableCell className="h-12 py-2">
                      <span className="inline-flex items-center gap-2 font-medium text-xs text-foreground">
                        <FileClock className="h-3.5 w-3.5 text-muted-foreground" />
                        v{item.versionNumber}
                      </span>
                    </TableCell>
                    <TableCell className="h-12 py-2">
                      <Badge className={cn(
                        "font-medium text-xs tracking-wide font-bold px-2 py-0.5 rounded",
                        item.status === "PUBLISHED"
                          ? "bg-emerald-50/25 border border-emerald-200 text-emerald-600"
                          : item.status === "DRAFT"
                          ? "bg-primary/25 border border-primary/20 text-primary"
                          : "bg-muted border border-border text-muted-foreground"
                      )}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="h-12 py-2 font-medium text-xs text-foreground">
                      {item.slots.length} slots
                    </TableCell>
                    <TableCell className="h-12 py-2 font-medium text-xs text-muted-foreground max-w-[120px] truncate">
                      {item.lockVersion || "N/A"}
                    </TableCell>
                    <TableCell className="h-12 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onExport(item)}
                          className="h-11 px-2.5 hover:bg-muted hover:text-foreground font-medium text-xs tracking-wide text-primary"
                        >
                          <Download className="mr-1 h-3 w-3" /> GeoJSON
                        </Button>
                        {item.status === "PUBLISHED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onArchive(item)}
                            className="h-11 px-2.5 border-border bg-muted/10 hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-xs tracking-wide"
                          >
                            <Archive className="mr-1 h-3 w-3" /> Archive
                          </Button>
                        )}
                        {item.status === "ARCHIVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onRollback(item)}
                            className="h-11 px-2.5 border-border bg-muted/10 hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-xs tracking-wide"
                          >
                            <RotateCw className="mr-1 h-3 w-3" /> Rollback
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
