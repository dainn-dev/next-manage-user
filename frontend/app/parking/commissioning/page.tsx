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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  { key: "site", label: "Site", icon: MapPinned },
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
  const { sites, selectedSiteId, selectSite, isLoading: sitesLoading } = useDashboardScope()
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
    <div className="admin-mobile-page space-y-6">
      <div className="admin-mobile-header">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Thiết lập bãi đỗ</h1>
          <p className="text-sm text-muted-foreground">Commissioning theo từng bước; bản đồ vận hành tại “Sơ đồ bãi” không bị thay đổi.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 py-1.5"><ShieldCheck className="h-3.5 w-3.5" />{user?.role === UserRole.ADMIN ? "Tenant Admin" : "Site Manager"}</Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-6">
        {STEPS.map((item, index) => {
          const Icon = item.icon
          const active = item.key === step
          return <button key={item.key} onClick={() => setStep(item.key)} className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
          )}>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", active ? "bg-primary-foreground/20" : "bg-muted")}>{index + 1}</span>
            <Icon className="h-4 w-4" /><span className="truncate">{item.label}</span>
          </button>
        })}
      </div>

      {step === "site" && <Card>
        <CardHeader><CardTitle>1. Chọn site</CardTitle><CardDescription>Mọi zone, camera, calibration và bản đồ bên dưới đều bị giới hạn trong site này.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {sitesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : sites.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có site nào trong phạm vi được phân quyền.</div>
          ) : <div className="grid gap-3 md:grid-cols-3">{sites.map((site) => <button key={site.id} onClick={() => selectSite(site.id)} className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:bg-muted",
            site.id === selectedSiteId && "border-primary bg-primary/5",
          )}><div className="flex items-center justify-between"><MapPinned className="h-5 w-5 text-primary" />{site.id === selectedSiteId && <Check className="h-4 w-4 text-primary" />}</div><p className="mt-3 font-medium">{site.name}</p><p className="text-xs text-muted-foreground">{site.location || "Chưa khai báo địa chỉ"}</p></button>)}</div>}
        </CardContent>
      </Card>}

      {step === "zones" && <Card>
        <CardHeader className="flex-row items-start justify-between"><div><CardTitle>2. Zones</CardTitle><CardDescription>Quản lý các vùng thuộc site đã chọn; hệ thống chặn xóa khi còn camera phụ thuộc.</CardDescription></div><Button size="sm" onClick={() => openZone()} disabled={!selectedSiteId}><Plus className="mr-2 h-4 w-4" />Thêm zone</Button></CardHeader>
        <CardContent>{loadingScope ? <Loading /> : zones.length === 0 ? <Empty text="Site chưa có zone." /> : <Table><TableHeader><TableRow><TableHead>Tên zone</TableHead><TableHead>Camera</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{zones.map((zone) => <TableRow key={zone.id}><TableCell className="font-medium">{zone.name}</TableCell><TableCell>{cameras.filter((camera) => camera.zoneId === zone.id).length}</TableCell><TableCell><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openZone(zone)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" className="text-destructive" onClick={() => void removeZone(zone)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}</TableBody></Table>}</CardContent>
      </Card>}

      {step === "cameras" && <div className="space-y-4">
        <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>3. Cameras</CardTitle><CardDescription>Đăng ký camera, vai trò xử lý, RTSP, tình trạng kết nối và thông tin edge.</CardDescription></div><Button size="sm" onClick={() => openCamera()} disabled={!selectedSiteId}><Plus className="mr-2 h-4 w-4" />Thêm camera</Button></CardHeader>
          <CardContent>{loadingScope ? <Loading /> : cameras.length === 0 ? <Empty text="Site chưa có camera." /> : <div className="space-y-3">{cameras.map((camera) => <div key={camera.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-lg bg-muted p-2"><CameraIcon className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{camera.name}</p><Badge variant={statusTone(camera.status)}>{camera.status}</Badge><Badge variant="outline">{camera.role}</Badge>{camera.panelType && <Badge variant="secondary">{camera.panelType}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{zones.find((zone) => zone.id === camera.zoneId)?.name || "Toàn site"} · Heartbeat: {camera.lastHeartbeatAt ? new Date(camera.lastHeartbeatAt).toLocaleString("vi-VN") : "chưa có"}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => openCamera(camera)}><Pencil className="mr-1 h-3.5 w-3.5" />Sửa</Button>{canIssueCredentials && <><Button variant="outline" size="sm" onClick={() => void revealCredential(camera, false)} disabled={busy}><KeyRound className="mr-1 h-3.5 w-3.5" />Cấp khóa</Button><Button variant="outline" size="sm" onClick={() => void revealCredential(camera, true)} disabled={busy}><RotateCw className="mr-1 h-3.5 w-3.5" />Xoay khóa</Button></>}<Button variant="outline" size="sm" className="text-destructive" onClick={() => void removeCamera(camera)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div></div>)}</div>}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Hướng dẫn edge</CardTitle><CardDescription>Khóa ingest chỉ hiển thị một lần. Lưu khóa vào secret store trên edge agent, đặt site/camera ID tương ứng, rồi kiểm tra heartbeat chuyển sang online. Không ghi khóa vào log hoặc cấu hình nguồn.</CardDescription></CardHeader></Card>
      </div>}

      {step === "calibration" && <div className="space-y-4">
        <Card><CardHeader><CardTitle>4. Calibration</CardTitle><CardDescription>Chọn camera OVERVIEW, tải một ảnh tĩnh và đánh dấu ít nhất 4 điểm kiểm soát với tọa độ site-local tính bằng mét.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><Field label="Camera OVERVIEW"><Select value={selectedCameraId} onValueChange={setSelectedCameraId}><SelectTrigger className="w-full"><SelectValue placeholder="Chọn camera" /></SelectTrigger><SelectContent>{overviewCameras.map((camera) => <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Ảnh nền"><div className="flex flex-wrap gap-2"><Button variant="outline" asChild disabled={!selectedCameraId || busy}><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Tải ảnh<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => void handleImageUpload(event.target.files?.[0])} /></label></Button><Button variant="outline" disabled={!selectedCameraId || busy} onClick={() => selectedSiteId && selectedCameraId && void captureStill(selectedSiteId, selectedCameraId).catch((error) => toast({ title: "Camera chưa hỗ trợ chụp trực tiếp", description: errorMessage(error), variant: "destructive" }))}><CameraIcon className="mr-2 h-4 w-4" />Chụp trực tiếp</Button></div></Field></div>
          {overviewCameras.length === 0 && <Warning text="Hãy tạo ít nhất một camera có vai trò OVERVIEW trước khi calibration." />}
          {sourceImage && <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"><div className="relative overflow-hidden rounded-lg border bg-black" onClick={addCalibrationPoint}><img src={sourceImage.readUrl} alt="Ảnh calibration" className="block h-auto w-full" />{controlPoints.map((point, index) => <span key={`${point.pixelX}-${point.pixelY}-${index}`} className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-primary-foreground shadow" style={{ left: `${point.pixelX / sourceImage.nativeWidth * 100}%`, top: `${point.pixelY / sourceImage.nativeHeight * 100}%` }}>{index + 1}</span>)}</div><div className="space-y-3"><div className="flex items-center justify-between"><p className="font-medium">Điểm kiểm soát ({controlPoints.length}/4+)</p><Button variant="ghost" size="sm" onClick={() => { setControlPoints([]); setCalibrationPreview(null) }}><X className="mr-1 h-4 w-4" />Xóa hết</Button></div><div className="max-h-[430px] space-y-2 overflow-auto pr-1">{controlPoints.map((point, index) => <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2 rounded-md border p-2"><span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{index + 1}</span><Field label={`X mét · px ${point.pixelX}`}><Input type="number" step="0.01" value={point.siteX} onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteX: Number(event.target.value) } : item))} /></Field><Field label={`Y mét · px ${point.pixelY}`}><Input type="number" step="0.01" value={point.siteY} onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteY: Number(event.target.value) } : item))} /></Field><Button variant="ghost" size="sm" onClick={() => setControlPoints((points) => points.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div><Button className="w-full" disabled={!calibrationInputReady(controlPoints) || busy} onClick={() => void runCalibrationValidation()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tính và kiểm tra phép chiếu</Button>{calibrationPreview && <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm"><p className="font-medium text-green-700">Preview hợp lệ</p><p>Sai số tái chiếu: {calibrationPreview.reprojectionError.toFixed(3)} px</p><Button size="sm" className="mt-3" onClick={() => void saveCalibrationVersion()} disabled={busy}><Save className="mr-2 h-4 w-4" />Tạo phiên bản calibration</Button></div>}</div></div>}
        </CardContent></Card>
      </div>}

      {step === "map" && <div className="space-y-4">
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>5. Parking Map Designer</CardTitle><CardDescription>Click trên ảnh để vẽ polygon; kéo các nút để chỉnh đỉnh. Bản nháp tự lưu sau 1,2 giây.</CardDescription></div><div className="flex flex-wrap gap-2"><input ref={importInputRef} type="file" accept=".geojson,.json,application/geo+json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file) }} /><Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={busy || Boolean(draft) || !sourceImage || !calibration}><Upload className="mr-2 h-4 w-4" />Nhập GeoJSON</Button><Button variant="outline" size="sm" onClick={undo} disabled={!undoStack.length}><Undo2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={redo} disabled={!redoStack.length}><Redo2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => void saveDraft()} disabled={!draft || !dirty}><Save className="mr-2 h-4 w-4" />{saveState === "saving" ? "Đang lưu…" : saveState === "saved" ? "Đã lưu" : "Lưu"}</Button></div></div></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-2"><Field label="Camera OVERVIEW"><Select value={selectedCameraId} onValueChange={setSelectedCameraId}><SelectTrigger className="w-full"><SelectValue placeholder="Chọn camera" /></SelectTrigger><SelectContent>{overviewCameras.map((camera) => <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>)}</SelectContent></Select></Field><div className="flex items-end"><p className="text-xs text-muted-foreground">Ảnh nền và calibration đi theo camera. Dùng bước Calibration để chụp/tải ảnh mới trước khi vẽ.</p></div></div>
          {!sourceImage || !calibration ? <Warning text="Hoàn tất calibration trong phiên làm việc này trước khi tạo một bản đồ mới." /> : !draft ? <div className="rounded-lg border border-dashed p-8 text-center"><p className="mb-3 text-sm text-muted-foreground">Chưa có bản nháp cho ảnh và calibration đang chọn.</p><Button onClick={() => void startDraft()} disabled={busy}><Plus className="mr-2 h-4 w-4" />Tạo bản nháp</Button></div> : <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_340px]"><div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => setZoom((value) => Math.max(1, value - .25))}><ZoomOut className="h-4 w-4" /></Button><Badge variant="outline">{Math.round(zoom * 100)}%</Badge><Button variant="outline" size="sm" onClick={() => setZoom((value) => Math.min(3, value + .25))}><ZoomIn className="h-4 w-4" /></Button></div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setPan((value) => ({ ...value, y: Math.max(0, value.y - 30) }))}>↑</Button><Button variant="ghost" size="sm" onClick={() => setPan((value) => ({ ...value, x: Math.max(0, value.x - 30) }))}>←</Button><Button variant="ghost" size="sm" onClick={() => setPan((value) => ({ ...value, x: value.x + 30 }))}>→</Button><Button variant="ghost" size="sm" onClick={() => setPan((value) => ({ ...value, y: value.y + 30 }))}>↓</Button></div></div><div className="overflow-hidden rounded-lg border bg-black"><svg role="img" aria-label="Trình vẽ ô đỗ" className="block aspect-video w-full touch-none" viewBox={`${pan.x} ${pan.y} ${(sourceImage.nativeWidth || 1) / zoom} ${(sourceImage.nativeHeight || 1) / zoom}`} onClick={editorClick} onPointerMove={dragVertex} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}><image href={sourceImage.readUrl} x="0" y="0" width={sourceImage.nativeWidth} height={sourceImage.nativeHeight} preserveAspectRatio="none" />{slots.map((slot, slotIndex) => <g key={`${slot.code}-${slotIndex}`} onClick={(event) => { event.stopPropagation(); setSelectedSlot(slotIndex) }}><polygon points={slot.pixelVertices.map((point) => `${point.x},${point.y}`).join(" ")} fill={selectedSlot === slotIndex ? "rgba(37,99,235,.5)" : "rgba(16,185,129,.35)"} stroke={selectedSlot === slotIndex ? "#2563eb" : "#10b981"} strokeWidth={3 / zoom} />{slot.pixelVertices.map((point, vertexIndex) => <circle key={vertexIndex} cx={point.x} cy={point.y} r={7 / zoom} fill="#fff" stroke="#2563eb" strokeWidth={3 / zoom} onPointerDown={(event) => { event.stopPropagation(); setUndoStack((stack) => [...stack.slice(-29), cloneSlots(slots)]); setDragging({ slot: slotIndex, vertex: vertexIndex }) }} />)}<text x={slot.pixelVertices[0]?.x} y={(slot.pixelVertices[0]?.y || 0) - 8} fill="white" fontSize={18 / zoom} stroke="black" strokeWidth={.5}>{slot.code}</text></g>)}{currentPolygon.length > 0 && <polyline points={currentPolygon.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(245,158,11,.25)" stroke="#f59e0b" strokeWidth={3 / zoom} />}</svg></div></div><div className="space-y-4"><div className="rounded-lg border p-3"><p className="mb-3 font-medium">Ô đang vẽ</p><div className="space-y-3"><Field label="Mã ô"><Input value={slotCode} onChange={(event) => setSlotCode(event.target.value)} placeholder="A-01" /></Field><Field label="Zone"><Select value={slotZoneId} onValueChange={setSlotZoneId}><SelectTrigger className="w-full"><SelectValue placeholder="Chọn zone" /></SelectTrigger><SelectContent>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Trạng thái quản trị"><Select value={slotStatus} onValueChange={(value) => setSlotStatus(value as ParkingMapSlot["adminStatus"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="RESERVED">RESERVED</SelectItem><SelectItem value="DISABLED">DISABLED</SelectItem></SelectContent></Select></Field><div className="flex gap-2"><Button className="flex-1" disabled={currentPolygon.length < 3 || !slotCode.trim() || !slotZoneId} onClick={finishPolygon}><Check className="mr-2 h-4 w-4" />Hoàn tất polygon</Button><Button variant="outline" onClick={() => setCurrentPolygon([])}><X className="h-4 w-4" /></Button></div></div></div>{selectedSlot !== null && slots[selectedSlot] && <div className="space-y-3 rounded-lg border p-3"><p className="font-medium">Chỉnh ô đã chọn</p><Field label="Mã ô"><Input value={slots[selectedSlot].code} onChange={(event) => updateSlot(selectedSlot, { code: event.target.value })} /></Field><Field label="Zone"><Select value={slots[selectedSlot].zoneId} onValueChange={(value) => updateSlot(selectedSlot, { zoneId: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Trạng thái"><Select value={slots[selectedSlot].adminStatus} onValueChange={(value) => updateSlot(selectedSlot, { adminStatus: value as ParkingMapSlot["adminStatus"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">ACTIVE</SelectItem><SelectItem value="RESERVED">RESERVED</SelectItem><SelectItem value="DISABLED">DISABLED</SelectItem></SelectContent></Select></Field><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => copySlot(selectedSlot)}><Copy className="mr-1 h-4 w-4" />Sao chép</Button><Button variant="outline" size="sm" className="text-destructive" onClick={() => { changeSlots(slots.filter((_, index) => index !== selectedSlot)); setSelectedSlot(null) }}><Trash2 className="mr-1 h-4 w-4" />Xóa</Button></div></div>}<p className="text-xs text-muted-foreground">{slots.length} ô · {currentPolygon.length} đỉnh đang vẽ · {saveState === "saving" ? "đang tự lưu" : dirty ? "chưa lưu" : "đã đồng bộ"}</p></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><Button variant="outline" onClick={() => { setSlots(draft ? cloneSlots(draft.slots) : []); setDirty(false); setValidation(null) }} disabled={!dirty}><RefreshCw className="mr-2 h-4 w-4" />Bỏ thay đổi</Button><div className="flex gap-2"><Button variant="outline" onClick={() => void runMapValidation()} disabled={busy || slots.length === 0}><ShieldCheck className="mr-2 h-4 w-4" />Validate</Button><Button onClick={() => setPublishDialog(true)} disabled={!mapPublishReady(draft, validation) || busy}><CloudUpload className="mr-2 h-4 w-4" />Publish</Button></div></div>
            {validation && !validation.valid && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3"><p className="mb-2 font-medium text-destructive">Chưa thể publish</p><ul className="list-disc space-y-1 pl-5 text-sm">{validation.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
          </>}
        </CardContent></Card>
        <History history={history} onRefresh={() => void loadHistory()} onExport={handleExport} onArchive={async (item) => { if (!selectedSiteId || !selectedCameraId) return; await archiveMap(selectedSiteId, selectedCameraId, item); await loadHistory() }} onRollback={async (item) => { if (!selectedSiteId || !selectedCameraId) return; const reason = window.prompt("Lý do rollback phiên bản này?")?.trim(); if (!reason) return; await rollbackMap(selectedSiteId, selectedCameraId, item, reason); await loadHistory(); setStep("verify") }} />
      </div>}

      {step === "verify" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><Card><CardHeader><CardTitle>6. Verify</CardTitle><CardDescription>Kiểm tra nhanh trước khi bàn giao site cho vận hành.</CardDescription></CardHeader><CardContent className="space-y-3">{readiness.map((item) => <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3">{item.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}<span className="text-sm">{item.label}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Unified site-local preview</CardTitle><CardDescription>Tất cả camera được ghép trong cùng hệ tọa độ site-local-meters-v1; pixel của từng ảnh không bị trộn.</CardDescription></CardHeader><CardContent className="space-y-4">{unifiedPreview ? <UnifiedSiteMap preview={unifiedPreview} /> : <Loading />}{overviewCameras.map((camera) => <div key={camera.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{camera.name}</p><p className="text-xs text-muted-foreground">{zones.find((zone) => zone.id === camera.zoneId)?.name || "Toàn site"} · {camera.status}</p></div><Badge variant="outline">{unifiedPreview?.features.filter((feature) => feature.cameraId === camera.id).length || 0} slots</Badge></div>)}</CardContent></Card></div>}

      <div className="flex justify-between"><Button variant="outline" disabled={currentStepIndex === 0} onClick={() => setStep(STEPS[currentStepIndex - 1].key)}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button><Button disabled={currentStepIndex === STEPS.length - 1 || (currentStepIndex === 0 && !selectedSiteId)} onClick={() => setStep(STEPS[currentStepIndex + 1].key)}>Tiếp tục<ArrowRight className="ml-2 h-4 w-4" /></Button></div>

      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}><DialogContent><DialogHeader><DialogTitle>{editingZone ? "Sửa zone" : "Thêm zone"}</DialogTitle></DialogHeader><Field label="Tên zone"><Input value={zoneName} onChange={(event) => setZoneName(event.target.value)} placeholder="Ví dụ: Tầng B1" /></Field><DialogFooter><Button variant="outline" onClick={() => setZoneDialog(false)}>Hủy</Button><Button onClick={() => void saveZone()} disabled={busy || !zoneName.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={cameraDialog} onOpenChange={setCameraDialog}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{editingCamera ? "Sửa camera" : "Thêm camera"}</DialogTitle><DialogDescription>RTSP là thông tin nhạy cảm và sẽ không được trả lại sau khi lưu.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label="Tên camera"><Input value={cameraForm.name} onChange={(event) => setCameraForm((form) => ({ ...form, name: event.target.value }))} /></Field><Field label="Zone"><Select value={cameraForm.zoneId || "site-wide"} onValueChange={(value) => setCameraForm((form) => ({ ...form, zoneId: value === "site-wide" ? null : value }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="site-wide">Toàn site</SelectItem>{zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Vai trò"><Select value={cameraForm.role} onValueChange={(value) => setCameraForm((form) => ({ ...form, role: value as CameraRole, panelType: value === "OVERVIEW" ? null : form.panelType || "entry" }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OVERVIEW">OVERVIEW</SelectItem><SelectItem value="ANPR_GATE">ANPR_GATE</SelectItem></SelectContent></Select></Field>{cameraForm.role === "ANPR_GATE" && <Field label="Loại panel"><Select value={cameraForm.panelType || "entry"} onValueChange={(value) => setCameraForm((form) => ({ ...form, panelType: value as CameraPanelType }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entry">entry</SelectItem><SelectItem value="exit">exit</SelectItem></SelectContent></Select></Field>}<Field label="Trạng thái"><Select value={cameraForm.status || "provisioned"} onValueChange={(value) => setCameraForm((form) => ({ ...form, status: value as CameraStatus }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="provisioned">provisioned</SelectItem><SelectItem value="online">online</SelectItem><SelectItem value="offline">offline</SelectItem><SelectItem value="disabled">disabled</SelectItem></SelectContent></Select></Field><div className="md:col-span-2"><Field label={editingCamera ? "RTSP mới (để trống để giữ nguyên)" : "RTSP URL"}><Input type="password" autoComplete="off" value={cameraForm.rtspUrl || ""} onChange={(event) => setCameraForm((form) => ({ ...form, rtspUrl: event.target.value }))} placeholder="rtsp://…" /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setCameraDialog(false)}>Hủy</Button><Button onClick={() => void saveCamera()} disabled={busy || !cameraForm.name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu camera</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}><DialogContent><DialogHeader><DialogTitle>Khóa ingest của {credential?.cameraName}</DialogTitle><DialogDescription>Khóa này chỉ hiển thị một lần. Hãy sao chép vào secret store của edge agent ngay bây giờ.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted p-3 font-mono text-sm break-all">{credential?.key}</div>{credential?.expiresAt && <p className="text-xs text-muted-foreground">Khóa cũ còn hiệu lực đến {new Date(credential.expiresAt).toLocaleString("vi-VN")}.</p>}<DialogFooter><Button onClick={() => credential && void navigator.clipboard.writeText(credential.key).then(() => toast({ title: "Đã sao chép khóa" }))}><ClipboardCopy className="mr-2 h-4 w-4" />Sao chép</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={publishDialog} onOpenChange={setPublishDialog}><DialogContent><DialogHeader><DialogTitle>Publish parking map?</DialogTitle><DialogDescription>Phiên bản này sẽ trở thành cấu hình vận hành mới. Bản đã publish trước đó vẫn được giữ trong lịch sử để truy vết.</DialogDescription></DialogHeader><div className="rounded-lg border p-3 text-sm"><p><strong>Camera:</strong> {selectedCamera?.name}</p><p><strong>Số ô:</strong> {slots.length}</p><p><strong>Calibration:</strong> v{calibration?.versionNumber || "hiện có"}</p></div><DialogFooter><Button variant="outline" onClick={() => setPublishDialog(false)}>Hủy</Button><Button onClick={() => void confirmPublish()} disabled={busy || !validation?.valid}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Xác nhận publish</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}

function Loading() {
  return <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>
}

function Warning({ text }: { text: string }) {
  return <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{text}</div>
}

function UnifiedSiteMap({ preview }: { preview: UnifiedMapPreview }) {
  const points = preview.features.flatMap((feature) => feature.polygon)
  if (!points.length) return <div className="flex aspect-video items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">No map</div>
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const width = Math.max(1, Math.max(...points.map((point) => point.x)) - minX)
  const height = Math.max(1, Math.max(...points.map((point) => point.y)) - minY)
  return <svg aria-label="Unified site-local parking map" className="aspect-video w-full rounded bg-slate-950" viewBox={`${minX - 5} ${minY - 5} ${width + 10} ${height + 10}`}>{preview.features.map((feature, index) => <g key={`${feature.mapVersionId}-${feature.slotId}-${index}`}><polygon points={feature.polygon.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(16,185,129,.4)" stroke="#34d399" strokeWidth={Math.max(width, height) / 150} /><text x={feature.polygon[0]?.x} y={(feature.polygon[0]?.y || 0) - 0.3} fill="white" fontSize={Math.max(width, height) / 35}>{feature.code}</text></g>)}</svg>
}

function History({ history, onRefresh, onExport, onArchive, onRollback }: { history: ParkingMapDraft[]; onRefresh: () => void; onExport: (item: ParkingMapDraft) => Promise<void>; onArchive: (item: ParkingMapDraft) => Promise<void>; onRollback: (item: ParkingMapDraft) => Promise<void> }) {
  return <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="text-base">Lịch sử phiên bản</CardTitle><CardDescription>Draft, published và archived được giữ tách biệt.</CardDescription></div><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button></CardHeader><CardContent>{history.length === 0 ? <Empty text="Camera chưa có phiên bản bản đồ." /> : <Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ô đỗ</TableHead><TableHead>Lock</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{history.map((item) => <TableRow key={item.id}><TableCell><span className="inline-flex items-center gap-2"><FileClock className="h-4 w-4" />v{item.versionNumber}</span></TableCell><TableCell><Badge variant={statusTone(item.status)}>{item.status}</Badge></TableCell><TableCell>{item.slots.length}</TableCell><TableCell>{item.lockVersion}</TableCell><TableCell><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => void onExport(item)}><Download className="mr-1 h-3.5 w-3.5" />GeoJSON</Button>{item.status === "PUBLISHED" && <Button variant="outline" size="sm" onClick={() => void onArchive(item)}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button>}{item.status === "ARCHIVED" && <Button variant="outline" size="sm" onClick={() => void onRollback(item)}><RotateCw className="mr-1 h-3.5 w-3.5" />Rollback</Button>}</div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
}
