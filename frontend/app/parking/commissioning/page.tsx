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
    <AdminPage className="space-y-6 bg-[#020617] text-slate-100 p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Grid tech background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-1/3 left-10 w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      {/* Cybernetic Header */}
      <header className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500/40" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[9px] font-mono font-medium text-cyan-400">
                <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {"SYSTEM_PROVISION // COMMISSIONING_CONSOLE"}
              </span>
              <span className="text-slate-700 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase">
                {selectedSiteId ? `SITE: ${sites.find(s => s.id === selectedSiteId)?.name || selectedSiteId.slice(0, 8)}` : "SELECT_SITE"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono uppercase">
              THIẾT LẬP BÃI ĐỖ <span className="text-cyan-400">{"// COMMISSIONING"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Thực hiện cấu hình phân cấp từ Site, Zone, Camera, cân chỉnh ảnh trường nhìn đến thiết kế sơ đồ bãi đỗ xe trong thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center font-mono">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-cyan-400 font-bold">
              <ShieldCheck className="size-3.5 text-cyan-400" />
              {user?.role === UserRole.ADMIN ? "TENANT_ADMIN" : "SITE_MANAGER"}
            </span>
          </div>
        </div>
      </header>

      {/* Tech Steps Navigation */}
      <nav
        aria-label="Các bước thiết lập bãi đỗ"
        className="-mx-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-2 md:grid md:min-w-0 md:grid-cols-6 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800/80">
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
                  "flex h-10 shrink-0 items-center rounded-lg border text-left text-xs font-mono transition-all duration-200 focus-visible:outline-none md:h-12 md:px-3 md:py-2",
                  active
                    ? "min-w-[7.75rem] gap-2 border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                    : "w-10 justify-center border-slate-900 bg-slate-950/30 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 hover:border-slate-800 md:w-auto md:justify-start md:gap-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold border transition-colors",
                    active
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse"
                      : "bg-slate-900 text-slate-500 border-slate-800",
                  )}
                >
                  {`0${index + 1}`}
                </span>
                <Icon className={cn("hidden h-4 w-4 shrink-0 md:block", active && "block")} />
                <span className={cn("truncate uppercase tracking-wider text-[11px]", active ? "block font-bold" : "sr-only md:not-sr-only md:block")}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {step === "site" && (
        <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />
          
          <CardHeader className="border-b border-slate-900/60 pb-4">
            <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              01 // CHỌN SITE
            </CardTitle>
            <CardDescription className="text-slate-400">
              Mọi zone, camera, calibration và bản đồ bên dưới đều bị giới hạn trong site này.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {sitesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
              </div>
            ) : sites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500 font-mono">
                {"[NO_ACTIVE_SITES]"} Chưa có site nào trong phạm vi được phân quyền.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {sites.map((site) => {
                  const active = site.id === selectedSiteId
                  return (
                    <button
                      key={site.id}
                      onClick={() => selectSite(site.id)}
                      className={cn(
                        "rounded-xl border p-5 text-left transition-all duration-200 relative group overflow-hidden",
                        active
                          ? "border-cyan-500/40 bg-cyan-950/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                          : "border-slate-800 bg-slate-950/20 text-slate-300 hover:border-slate-700 hover:bg-slate-900/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "p-2 rounded-lg border",
                          active ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-slate-800 bg-slate-900/40 text-slate-400"
                        )}>
                          <MapPinned className="h-5 w-5" />
                        </div>
                        {active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[9px] font-mono text-cyan-400 font-bold">
                            <Check className="h-3 w-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="mt-4 font-mono font-bold tracking-tight text-sm uppercase text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {site.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 font-mono truncate">
                        {site.location || "Chưa khai báo địa chỉ"}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "zones" && (
        <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900/60 pb-4 gap-4">
            <div>
              <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                02 // QUẢN LÝ ZONES
              </CardTitle>
              <CardDescription className="text-slate-400">
                Quản lý các vùng thuộc site đã chọn; hệ thống chặn xóa khi còn camera phụ thuộc.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => openZone()}
              disabled={!selectedSiteId}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-[11px] h-8 rounded-lg"
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
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20">
                <Table>
                  <TableHeader className="bg-slate-950/60 border-b border-slate-800">
                    <TableRow className="border-b border-slate-800 hover:bg-transparent">
                      <TableHead className="font-mono text-slate-400 uppercase text-[10px] tracking-wider h-10">Tên zone</TableHead>
                      <TableHead className="font-mono text-slate-400 uppercase text-[10px] tracking-wider h-10">Camera phụ thuộc</TableHead>
                      <TableHead className="text-right font-mono text-slate-400 uppercase text-[10px] tracking-wider h-10">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((zone) => (
                      <TableRow key={zone.id} className="border-b border-slate-900 hover:bg-slate-900/10">
                        <TableCell className="font-mono font-bold text-slate-200 py-3">{zone.name}</TableCell>
                        <TableCell className="py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-xs text-slate-300 font-mono">
                            {cameras.filter((camera) => camera.zoneId === zone.id).length} cameras
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openZone(zone)}
                              className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 hover:text-white h-7 w-7 p-0 rounded-md"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-800 bg-slate-950/40 text-rose-400 hover:bg-rose-950/20 hover:border-rose-500/30 hover:text-rose-300 h-7 w-7 p-0 rounded-md"
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
          <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-900/60 pb-4 gap-4">
              <div>
                <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  03 // ĐĂNG KÝ CAMERAS
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Đăng ký camera, vai trò xử lý, RTSP, tình trạng kết nối và thông tin edge.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => openCamera()}
                disabled={!selectedSiteId}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-[11px] h-8 rounded-lg"
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
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : isOffline
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-slate-900 text-slate-500 border-slate-800"

                    return (
                      <div
                        key={camera.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/20 p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9px] font-mono uppercase font-bold",
                              statusClass
                            )}>
                              <span className={cn("size-1 rounded-full", isOnline ? "bg-emerald-400 animate-pulse" : isOffline ? "bg-rose-400" : "bg-slate-600")} />
                              {camera.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 uppercase">
                              {camera.role}
                            </span>
                          </div>

                          <div className="flex gap-3 mb-4">
                            <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400 self-start">
                              <CameraIcon className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-mono font-bold text-slate-200 text-sm truncate uppercase tracking-tight group-hover:text-cyan-300">
                                {camera.name}
                              </h3>
                              <p className="text-xs text-slate-400 mt-1 font-mono">
                                {zoneName}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 border-t border-slate-900/60 pt-3 mb-5 text-[11px] font-mono text-slate-400">
                            <div className="flex justify-between">
                              <span className="text-slate-500">HEARTBEAT:</span>
                              <span className="text-slate-300">{heartbeat}</span>
                            </div>
                            {camera.panelType && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">PANEL_TYPE:</span>
                                <span className="text-slate-300 uppercase">{camera.panelType}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto border-t border-slate-900/40 pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCamera(camera)}
                            className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 hover:text-white h-8 flex-1 font-mono text-xs uppercase"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5 text-slate-400" /> Sửa
                          </Button>

                          {canIssueCredentials && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void revealCredential(camera, false)}
                                disabled={busy}
                                className="border-slate-800 bg-slate-950/40 hover:bg-cyan-950/30 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-400 h-8 font-mono text-xs uppercase"
                                title="Cấp khóa"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void revealCredential(camera, true)}
                                disabled={busy}
                                className="border-slate-800 bg-slate-950/40 hover:bg-cyan-950/30 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-400 h-8 font-mono text-xs uppercase"
                                title="Xoay khóa"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-800 bg-slate-950/40 text-rose-400 hover:bg-rose-950/20 hover:border-rose-500/30 hover:text-rose-300 h-8 px-2.5"
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

          <Card className="border border-cyan-500/10 bg-cyan-950/5 text-slate-300 shadow-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-cyan-500/40" />
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> EDGE_COMMUNICATION_GUIDELINES
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-[11px] font-mono leading-relaxed text-slate-400 space-y-1">
              <p>1. Khóa ingest chỉ hiển thị một lần duy nhất khi cấp mới hoặc xoay khóa.</p>
              <p>2. Lưu khóa vào secret store an toàn trên edge agent, thiết lập SITE_ID & CAMERA_ID tương ứng.</p>
              <p>3. Tuyệt đối không ghi khóa ingest trực tiếp vào logs hệ thống hoặc file cấu hình nguồn công khai.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "calibration" && (
        <div className="space-y-4">
          <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

            <CardHeader className="border-b border-slate-900/60 pb-4">
              <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                04 // HIỆU CHỈNH CALIBRATION
              </CardTitle>
              <CardDescription className="text-slate-400 font-mono text-[11px]">
                Chọn camera OVERVIEW, tải một ảnh tĩnh và đánh dấu ít nhất 4 điểm kiểm soát với tọa độ site-local tính bằng mét.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Camera OVERVIEW">
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                      <SelectValue placeholder="Chọn camera" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      {overviewCameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id} className="focus:bg-slate-900 focus:text-white font-mono text-xs">
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
                      className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-white h-10 font-mono text-xs uppercase"
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
                      className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-white h-10 font-mono text-xs uppercase"
                    >
                      <CameraIcon className="mr-1.5 h-4 w-4 text-cyan-400" /> Chụp trực tiếp
                    </Button>
                  </div>
                </Field>
              </div>

              {overviewCameras.length === 0 && (
                <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Hãy tạo ít nhất một camera có vai trò OVERVIEW trước khi thực hiện hiệu chỉnh calibration.
                </div>
              )}

              {sourceImage && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
                  {/* Left Side: Interactive Canvas Image */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">IMAGE_COORDINATES_CANVAS (NHẤP ĐỂ THÊM ĐIỂM)</span>
                    <div
                      className="relative overflow-hidden rounded-xl border border-slate-800 bg-black cursor-crosshair group shadow-inner"
                      onClick={addCalibrationPoint}
                    >
                      <img src={sourceImage.readUrl} alt="Ảnh calibration" className="block h-auto w-full select-none" />
                      {controlPoints.map((point, index) => (
                        <span
                          key={`${point.pixelX}-${point.pixelY}-${index}`}
                          className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400 bg-cyan-950 text-[11px] font-mono font-bold text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all animate-bounce"
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
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <p className="font-mono text-xs font-bold text-slate-300">
                          ĐIỂM KIỂM SOÁT ({controlPoints.length}/4+)
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setControlPoints([]); setCalibrationPreview(null) }}
                          className="text-slate-500 hover:text-rose-400 hover:bg-rose-950/10 font-mono text-xs h-7"
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Xóa hết
                        </Button>
                      </div>

                      <div className="max-h-[380px] space-y-3.5 overflow-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                        {controlPoints.map((point, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-3.5 rounded-lg border border-slate-900 bg-slate-950/40 p-3"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono font-bold text-cyan-400">
                              {index + 1}
                            </span>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-500 block uppercase">X MET · PX {point.pixelX}</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={point.siteX}
                                onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteX: Number(event.target.value) } : item))}
                                className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-8 rounded-md"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-slate-500 block uppercase">Y MET · PX {point.pixelY}</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={point.siteY}
                                onChange={(event) => setControlPoints((points) => points.map((item, itemIndex) => itemIndex === index ? { ...item, siteY: Number(event.target.value) } : item))}
                                className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-8 rounded-md"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setControlPoints((points) => points.filter((_, itemIndex) => itemIndex !== index))}
                              className="text-slate-500 hover:text-rose-400 h-8 w-8 p-0 hover:bg-rose-950/20 rounded-md mt-4"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-900/60 mt-auto">
                      <Button
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-10 rounded-lg shadow-lg shadow-cyan-500/10"
                        disabled={!calibrationInputReady(controlPoints) || busy}
                        onClick={() => void runCalibrationValidation()}
                      >
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Tính & kiểm tra phép chiếu
                      </Button>

                      {calibrationPreview && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-3">
                          <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Preview hợp lệ
                          </div>
                          <p className="text-xs text-slate-300 font-mono">
                            Sai số tái chiếu (reprojection error):{" "}
                            <span className="text-emerald-400 font-bold">{calibrationPreview.reprojectionError.toFixed(3)} px</span>
                          </p>
                          <Button
                            size="sm"
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-mono font-bold uppercase text-xs h-9 rounded-lg"
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
          <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

            <CardHeader className="border-b border-slate-900/60 pb-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    05 // THIẾT KẾ SƠ ĐỒ BÃI ĐỖ
                  </CardTitle>
                  <CardDescription className="text-slate-400 font-mono text-[11px] mt-1">
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
                    className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-white font-mono text-xs h-8"
                    onClick={() => importInputRef.current?.click()}
                    disabled={busy || Boolean(draft) || !sourceImage || !calibration}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    <span>Nhập GeoJSON</span>
                  </Button>

                  <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-850">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={undo}
                      disabled={!undoStack.length}
                      title="Hoàn tác"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
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
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-8 px-3 rounded-lg"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {saveState === "saving" ? "Đang lưu…" : saveState === "saved" ? "Đã lưu" : "Lưu sơ đồ"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-slate-950/65 border border-slate-900 px-3.5 py-2 rounded-lg text-xs font-mono">
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
                <span className="text-slate-400">
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
              <div className="grid gap-4 rounded-xl border border-slate-900 bg-slate-950/60 p-4 md:grid-cols-2">
                <Field label="Camera OVERVIEW">
                  <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                      <SelectValue placeholder="Chọn camera" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                      {overviewCameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id} className="focus:bg-slate-900 focus:text-white font-mono text-xs">
                          {camera.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center">
                  <p className="text-xs text-slate-400 font-mono leading-relaxed pl-1">
                    [INFO] Ảnh nền và calibration đi theo camera. Sử dụng bước Calibration để tải ảnh hoặc chụp ảnh trực tiếp mới trước khi vẽ sơ đồ.
                  </p>
                </div>
              </div>

              {!sourceImage || !calibration ? (
                <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Hoàn tất calibration trong phiên làm việc này trước khi tạo một bản đồ mới.
                </div>
              ) : !draft ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center bg-slate-950/15">
                  <p className="mb-4 text-xs font-mono text-slate-400">
                    Chưa có bản nháp sơ đồ nào cho ảnh và calibration đang chọn.
                  </p>
                  <Button
                    onClick={() => void startDraft()}
                    disabled={busy}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-9 rounded-lg"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Tạo bản nháp sơ đồ mới
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_340px]">
                    {/* SVG Interactive Editor Container */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-900 p-2.5 rounded-xl">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Tỷ lệ:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 h-8 w-8 p-0"
                            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-xs font-mono text-cyan-400 font-bold min-w-[50px] text-center">
                            {Math.round(zoom * 100)}%
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 h-8 w-8 p-0"
                            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Navigation / Pan Controls */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Di chuyển:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 font-mono text-slate-400 hover:text-white"
                            onClick={() => setPan((value) => ({ ...value, y: Math.max(0, value.y - 30) }))}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 font-mono text-slate-400 hover:text-white"
                            onClick={() => setPan((value) => ({ ...value, x: Math.max(0, value.x - 30) }))}
                          >
                            ←
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 font-mono text-slate-400 hover:text-white"
                            onClick={() => setPan((value) => ({ ...value, x: value.x + 30 }))}
                          >
                            →
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 font-mono text-slate-400 hover:text-white"
                            onClick={() => setPan((value) => ({ ...value, y: value.y + 30 }))}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>

                      {/* SVG Canvas Board */}
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-black relative group shadow-inner">
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
                                fill="white"
                                fontSize={20 / zoom}
                                stroke="black"
                                strokeWidth={0.8}
                                className="font-mono font-bold select-none text-shadow-md"
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
                      <Card className="border border-slate-800/80 bg-slate-950/30 rounded-xl p-4 space-y-4">
                        <div className="border-b border-slate-900/60 pb-2">
                          <p className="font-mono text-xs font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                            <span className="size-1 rounded-full bg-cyan-500 animate-ping" />
                            Ô ĐANG VẼ
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <Field label="Mã ô đỗ">
                            <Input
                              value={slotCode}
                              onChange={(event) => setSlotCode(event.target.value)}
                              placeholder="Ví dụ: A-01"
                              className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-9 rounded-md"
                            />
                          </Field>
                          
                          <Field label="Vùng Zone">
                            <Select value={slotZoneId} onValueChange={setSlotZoneId}>
                              <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-9 rounded-md">
                                <SelectValue placeholder="Chọn zone" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                {zones.map((zone) => (
                                  <SelectItem key={zone.id} value={zone.id} className="focus:bg-slate-900 focus:text-white font-mono text-xs">
                                    {zone.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field label="Trạng thái quản trị">
                            <Select value={slotStatus} onValueChange={(value) => setSlotStatus(value as ParkingMapSlot["adminStatus"])}>
                              <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-9 rounded-md">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                <SelectItem value="ACTIVE" className="focus:bg-slate-900 font-mono text-xs text-emerald-400">ACTIVE</SelectItem>
                                <SelectItem value="RESERVED" className="focus:bg-slate-900 font-mono text-xs text-amber-400">RESERVED</SelectItem>
                                <SelectItem value="DISABLED" className="focus:bg-slate-900 font-mono text-xs text-rose-400">DISABLED</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>

                          <div className="flex gap-2 pt-2">
                            <Button
                              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase text-[11px] tracking-wide h-9 rounded-md"
                              disabled={currentPolygon.length < 3 || !slotCode.trim() || !slotZoneId}
                              onClick={finishPolygon}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Hoàn tất ô đỗ
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setCurrentPolygon([])}
                              className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-400 hover:text-white h-9 w-9 p-0"
                              title="Hủy nét vẽ hiện tại"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>

                      {/* Selected Slot Inspector */}
                      {selectedSlot !== null && slots[selectedSlot] && (
                        <Card className="border border-cyan-500/20 bg-cyan-950/10 rounded-xl p-4 space-y-4">
                          <div className="border-b border-cyan-500/20 pb-2">
                            <p className="font-mono text-xs font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-cyan-400" />
                              CHỈNH SỬA Ô ĐÃ CHỌN
                            </p>
                          </div>

                          <div className="space-y-3.5">
                            <Field label="Mã ô đỗ">
                              <Input
                                value={slots[selectedSlot].code}
                                onChange={(event) => updateSlot(selectedSlot, { code: event.target.value })}
                                className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-9 rounded-md"
                              />
                            </Field>

                            <Field label="Vùng Zone">
                              <Select
                                value={slots[selectedSlot].zoneId}
                                onValueChange={(value) => updateSlot(selectedSlot, { zoneId: value })}
                              >
                                <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-9 rounded-md">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                  {zones.map((zone) => (
                                    <SelectItem key={zone.id} value={zone.id} className="focus:bg-slate-900 focus:text-white font-mono text-xs">
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
                                <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-9 rounded-md">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                  <SelectItem value="ACTIVE" className="focus:bg-slate-900 font-mono text-xs text-emerald-400">ACTIVE</SelectItem>
                                  <SelectItem value="RESERVED" className="focus:bg-slate-900 font-mono text-xs text-amber-400">RESERVED</SelectItem>
                                  <SelectItem value="DISABLED" className="focus:bg-slate-900 font-mono text-xs text-rose-400">DISABLED</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>

                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copySlot(selectedSlot)}
                                className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 h-8 font-mono text-xs"
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" /> Sao chép
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-800 bg-slate-950/40 text-rose-400 hover:bg-rose-950/20 hover:border-rose-500/30 hover:text-rose-300 h-8 font-mono text-xs ml-auto"
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

                      <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-950 text-[10px] font-mono text-slate-500 uppercase space-y-1">
                        <div className="flex justify-between">
                          <span>SỐ_Ô_BẢN_ĐỒ:</span>
                          <span className="text-cyan-400 font-bold">{slots.length} slots</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ĐỈNH_ĐANG_VẼ:</span>
                          <span className="text-slate-300">{currentPolygon.length} vertexes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>TỰ_ĐỘNG_SẮP_XẾP:</span>
                          <span className={cn(dirty ? "text-amber-400" : "text-emerald-400")}>{dirty ? "dirty_state" : "synchronized"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sync & Publish Control block */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-slate-900 bg-slate-950/30 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSlots(draft ? cloneSlots(draft.slots) : [])
                        setDirty(false)
                        setValidation(null)
                      }}
                      disabled={!dirty}
                      className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-400 hover:text-white h-9 font-mono text-xs uppercase"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Bỏ thay đổi nháp
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void runMapValidation()}
                        disabled={busy || slots.length === 0}
                        className="border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-white h-9 font-mono text-xs uppercase"
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4 text-cyan-400" /> Validate
                      </Button>
                      <Button
                        onClick={() => setPublishDialog(true)}
                        disabled={!mapPublishReady(draft, validation) || busy}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-9 px-4 rounded-lg"
                      >
                        <CloudUpload className="mr-1.5 h-4 w-4" /> Publish sơ đồ
                      </Button>
                    </div>
                  </div>

                  {validation && !validation.valid && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-2">
                      <p className="font-mono text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Chưa thể publish sơ đồ bãi đỗ
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300 font-mono">
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
          <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

            <CardHeader className="border-b border-slate-900/60 pb-4">
              <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                06 // KIỂM TRA CHỈ SỐ SẴN SÀNG (VERIFY)
              </CardTitle>
              <CardDescription className="text-slate-400 font-mono text-[11px] mt-1">
                Kiểm tra nhanh chất lượng dữ liệu trước khi bàn giao site cho vận hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-6">
              {readiness.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 font-mono text-xs transition-all",
                    item.ok
                      ? "border-emerald-500/20 bg-emerald-950/10 text-emerald-300"
                      : "border-amber-500/20 bg-amber-950/10 text-amber-300"
                  )}
                >
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <span className="leading-relaxed">{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Right panel: Unified Site-local Preview */}
          <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

            <CardHeader className="border-b border-slate-900/60 pb-4">
              <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                UNIFIED SITE-LOCAL PREVIEW
              </CardTitle>
              <CardDescription className="text-slate-400 font-mono text-[11px] mt-1">
                Tất cả camera được ghép chung hệ tọa độ site-local-meters-v1; pixel của từng ảnh không bị trộn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="overflow-hidden rounded-xl border border-slate-900 bg-black/60 relative p-1.5 shadow-inner">
                {unifiedPreview ? <UnifiedSiteMap preview={unifiedPreview} /> : <Loading />}
              </div>

              <div className="space-y-2.5">
                {overviewCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-950/40 p-3.5 transition-all hover:border-slate-800"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-slate-200">{camera.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {zones.find((zone) => zone.id === camera.zoneId)?.name || "Toàn bộ Site"} · {camera.status}
                      </p>
                    </div>
                    <Badge className="border-cyan-500/20 bg-cyan-950/20 text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-wider rounded px-2 py-0.5">
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
      <div className="flex justify-between items-center pt-4 border-t border-slate-900/60 mt-6">
        <Button
          variant="outline"
          disabled={currentStepIndex === 0}
          onClick={() => setStep(STEPS[currentStepIndex - 1].key)}
          className="border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs uppercase h-10 px-5 rounded-xl transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
        </Button>
        <Button
          disabled={currentStepIndex === STEPS.length - 1 || (currentStepIndex === 0 && !selectedSiteId)}
          onClick={() => setStep(STEPS[currentStepIndex + 1].key)}
          className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-10 px-6 rounded-xl transition-all shadow-lg shadow-cyan-500/10"
        >
          Tiếp tục <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Modern High-Tech Modals / Dialogs */}
      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-slate-100 font-mono max-w-md p-6 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <DialogHeader className="pb-4 border-b border-slate-900">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase">
              {editingZone ? "CHỈNH SỬA VÙNG ZONE" : "KÍCH HOẠT VÙNG ZONE MỚI"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Field label="Tên Vùng Zone">
              <Input
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                placeholder="Ví dụ: Tầng hầm B1, Khu vực A"
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-10 rounded-lg focus-visible:ring-cyan-500"
              />
            </Field>
          </div>
          <DialogFooter className="pt-4 border-t border-slate-900 gap-2">
            <Button
              variant="outline"
              onClick={() => setZoneDialog(false)}
              className="border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs rounded-lg h-9"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void saveZone()}
              disabled={busy || !zoneName.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs rounded-lg h-9 px-4"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu cấu hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cameraDialog} onOpenChange={setCameraDialog}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-slate-100 font-mono sm:max-w-2xl p-6 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <DialogHeader className="pb-4 border-b border-slate-900">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase">
              {editingCamera ? "CHỈNH SỬA CAMERA" : "THIẾT LẬP THIẾT BỊ CAMERA"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[11px] font-mono">
              RTSP URL là thông tin hệ thống nhạy cảm và sẽ được mã hóa đầu cuối.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 py-4">
            <Field label="Tên Camera">
              <Input
                value={cameraForm.name}
                onChange={(event) => setCameraForm((form) => ({ ...form, name: event.target.value }))}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-10 rounded-lg focus-visible:ring-cyan-500"
              />
            </Field>
            <Field label="Phân vùng Zone">
              <Select
                value={cameraForm.zoneId || "site-wide"}
                onValueChange={(value) => setCameraForm((form) => ({ ...form, zoneId: value === "site-wide" ? null : value }))}
              >
                <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="site-wide" className="focus:bg-slate-900 font-mono text-xs">Toàn bộ site</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id} className="focus:bg-slate-900 font-mono text-xs">
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
                <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="OVERVIEW" className="focus:bg-slate-900 font-mono text-xs text-cyan-400">OVERVIEW (Bản đồ)</SelectItem>
                  <SelectItem value="ANPR_GATE" className="focus:bg-slate-900 font-mono text-xs text-purple-400">ANPR_GATE (Nhận diện cổng)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {cameraForm.role === "ANPR_GATE" && (
              <Field label="Loại cổng kiểm soát (Panel Type)">
                <Select
                  value={cameraForm.panelType || "entry"}
                  onValueChange={(value) => setCameraForm((form) => ({ ...form, panelType: value as CameraPanelType }))}
                >
                  <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectItem value="entry" className="focus:bg-slate-900 font-mono text-xs text-emerald-400">ENTRY (Lối vào)</SelectItem>
                    <SelectItem value="exit" className="focus:bg-slate-900 font-mono text-xs text-amber-400">EXIT (Lối ra)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Trạng thái vật lý">
              <Select
                value={cameraForm.status || "provisioned"}
                onValueChange={(value) => setCameraForm((form) => ({ ...form, status: value as CameraStatus }))}
              >
                <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="provisioned" className="focus:bg-slate-900 font-mono text-xs text-slate-400">PROVISIONED</SelectItem>
                  <SelectItem value="online" className="focus:bg-slate-900 font-mono text-xs text-emerald-400">ONLINE</SelectItem>
                  <SelectItem value="offline" className="focus:bg-slate-900 font-mono text-xs text-rose-400">OFFLINE</SelectItem>
                  <SelectItem value="disabled" className="focus:bg-slate-900 font-mono text-xs text-slate-600">DISABLED</SelectItem>
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
                  className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono h-10 rounded-lg focus-visible:ring-cyan-500"
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-slate-900 gap-2">
            <Button
              variant="outline"
              onClick={() => setCameraDialog(false)}
              className="border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs rounded-lg h-9"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void saveCamera()}
              disabled={busy || !cameraForm.name.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs rounded-lg h-9 px-4"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu thiết bị
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-slate-100 font-mono max-w-lg p-6 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <DialogHeader className="pb-4 border-b border-slate-900">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-cyan-500 animate-ping" />
              KHÓA KẾT NỐI INGEST // {credential?.cameraName}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[11px] font-mono mt-1">
              Khóa token này chỉ xuất hiện duy nhất một lần. Sao chép và lưu trữ an toàn trong secret manager của Edge Agent ngay lập tức.
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-4 font-mono text-xs text-cyan-300 break-all select-all tracking-wider relative group shadow-inner">
              {credential?.key}
            </div>
            {credential?.expiresAt && (
              <p className="text-[10px] font-mono text-slate-500 mt-2.5">
                Khóa cũ của thiết bị vẫn sẽ tiếp tục duy trì hiệu lực đến hết ngày: {new Date(credential.expiresAt).toLocaleString("vi-VN")}.
              </p>
            )}
          </div>
          <DialogFooter className="pt-4 border-t border-slate-900">
            <Button
              onClick={() => credential && void navigator.clipboard.writeText(credential.key).then(() => toast({ title: "Đã sao chép khóa kết nối" }))}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs rounded-lg h-10 w-full"
            >
              <ClipboardCopy className="mr-2 h-4 w-4" /> Sao chép Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-slate-100 font-mono max-w-md p-6 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <DialogHeader className="pb-4 border-b border-slate-900">
            <DialogTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase">
              XÁC NHẬN PUBLISH SƠ ĐỒ?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[11px] font-mono mt-1">
              Phiên bản thiết kế sơ đồ này sẽ ngay lập tức được biên dịch và áp dụng làm cấu hình vận hành chính thức mới cho bãi đỗ.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-xs font-mono text-slate-300 bg-slate-950/60 rounded-lg border border-slate-900 p-3.5">
            <p className="flex justify-between">
              <span className="text-slate-500">THIẾT BỊ CAMERA:</span>
              <span className="text-slate-200 font-bold">{selectedCamera?.name}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500 font-mono">TỔNG SỐ Ô ĐỖ:</span>
              <span className="text-cyan-400 font-bold">{slots.length} slots</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">HIỆU CHỈNH:</span>
              <span className="text-slate-200 font-bold">Calibration v{calibration?.versionNumber || "hiện tại"}</span>
            </p>
          </div>
          <DialogFooter className="pt-4 border-t border-slate-900 gap-2">
            <Button
              variant="outline"
              onClick={() => setPublishDialog(false)}
              className="border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs rounded-lg h-9"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => void confirmPublish()}
              disabled={busy || !validation?.valid}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs rounded-lg h-9 px-4"
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
      <Label className="font-mono text-[10px] tracking-wider text-slate-400 uppercase pl-0.5">{label}</Label>
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex min-h-36 items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900">
      <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-400">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
        <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">LOADING_STREAM...</span>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-850 p-8 text-center bg-slate-950/10">
      <p className="text-xs font-mono text-slate-500">{text}</p>
    </div>
  )
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs font-mono text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

function UnifiedSiteMap({ preview }: { preview: UnifiedMapPreview }) {
  const points = preview.features.flatMap((feature) => feature.polygon)
  if (!points.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-950 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
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
      className="aspect-video w-full rounded-lg bg-slate-950 border border-slate-900"
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
            fill="white"
            fontSize={Math.max(width, height) / 38}
            className="font-mono font-bold fill-emerald-300 select-none text-shadow"
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
    <Card className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/30" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500/30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500/30" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/30" />

      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-900/60 pb-4">
        <div className="min-w-0">
          <CardTitle className="text-sm font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-2">
            LỊCH SỬ PHIÊN BẢN (VERSION LOG)
          </CardTitle>
          <CardDescription className="text-slate-400 font-mono text-[11px] mt-1">
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
            className="h-8 w-8 border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white rounded-lg p-0 shadow-none"
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
              <TableHeader className="border-b border-slate-900">
                <TableRow className="border-b border-slate-900/60 hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] uppercase text-slate-500 h-10">Mã Phiên Bản</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-slate-500 h-10">Trạng Thái</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-slate-500 h-10">Số Ô Đỗ</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-slate-500 h-10">Khóa Đồng Bộ</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-slate-500 h-10 text-right">Hành Động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-900/40 hover:bg-slate-900/20">
                    <TableCell className="h-12 py-2">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-300">
                        <FileClock className="h-3.5 w-3.5 text-slate-500" />
                        v{item.versionNumber}
                      </span>
                    </TableCell>
                    <TableCell className="h-12 py-2">
                      <Badge className={cn(
                        "font-mono text-[10px] tracking-wide uppercase font-bold px-2 py-0.5 rounded",
                        item.status === "PUBLISHED"
                          ? "bg-emerald-950/25 border border-emerald-500/20 text-emerald-400"
                          : item.status === "DRAFT"
                          ? "bg-cyan-950/25 border border-cyan-500/20 text-cyan-400"
                          : "bg-slate-900/80 border border-slate-800 text-slate-400"
                      )}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="h-12 py-2 font-mono text-xs text-slate-300">
                      {item.slots.length} slots
                    </TableCell>
                    <TableCell className="h-12 py-2 font-mono text-[10px] text-slate-400 max-w-[120px] truncate">
                      {item.lockVersion || "N/A"}
                    </TableCell>
                    <TableCell className="h-12 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onExport(item)}
                          className="h-8 px-2.5 hover:bg-slate-900 hover:text-white font-mono text-[10px] uppercase tracking-wide text-cyan-400"
                        >
                          <Download className="mr-1 h-3 w-3" /> GeoJSON
                        </Button>
                        {item.status === "PUBLISHED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onArchive(item)}
                            className="h-8 px-2.5 border-slate-800 bg-slate-950/30 hover:bg-slate-900 text-slate-400 hover:text-white font-mono text-[10px] uppercase tracking-wide"
                          >
                            <Archive className="mr-1 h-3 w-3" /> Archive
                          </Button>
                        )}
                        {item.status === "ARCHIVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onRollback(item)}
                            className="h-8 px-2.5 border-slate-800 bg-slate-950/30 hover:bg-slate-900 text-slate-400 hover:text-white font-mono text-[10px] uppercase tracking-wide"
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
