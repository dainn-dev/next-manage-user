"use client"

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { createCalibration, type CalibrationPoint, type CalibrationVersion } from '@/lib/api/parking-commissioning-api'

const blank = (): CalibrationPoint => ({ pixelX: 0, pixelY: 0, siteX: 0, siteY: 0 })

export default function ParkingCommissioningPage() {
  const { selectedSiteId } = useDashboardScope()
  const { cameras } = useDashboardData()
  const overview = useMemo(() => cameras.filter((camera) => camera.role === 'OVERVIEW'), [cameras])
  const [cameraId, setCameraId] = useState('')
  const [points, setPoints] = useState<CalibrationPoint[]>([blank(), blank(), blank(), blank()])
  const [result, setResult] = useState<CalibrationVersion | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (row: number, key: keyof CalibrationPoint, value: string) => setPoints((current) => current.map((point, index) => index === row ? { ...point, [key]: Number(value) } : point))
  const save = async () => {
    if (!selectedSiteId || !cameraId) return
    setSaving(true); setMessage(''); setResult(null)
    try { setResult(await createCalibration(selectedSiteId, cameraId, points)) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Calibration failed') }
    finally { setSaving(false) }
  }
  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Site commissioning</h1><p className="text-sm text-muted-foreground">Site → Zones → Cameras → Calibration → Parking Map → Verify</p></div>
    <Card><CardContent className="space-y-4 p-5">
      <label className="block text-sm font-medium">Overview camera<select className="mt-2 block w-full rounded-md border bg-background p-2" value={cameraId} onChange={(event) => setCameraId(event.target.value)}><option value="">Select camera</option>{overview.map((camera) => <option value={camera.id} key={camera.id}>{camera.name} · {camera.status}</option>)}</select></label>
      <div><h2 className="font-medium">Control points</h2><p className="text-xs text-muted-foreground">Native image pixels mapped to surveyed site-local metres.</p></div>
      {points.map((point, row) => <div className="grid grid-cols-4 gap-2" key={row}>{(['pixelX','pixelY','siteX','siteY'] as const).map((key) => <Input type="number" step="any" aria-label={`${key} ${row + 1}`} value={point[key]} onChange={(event) => update(row, key, event.target.value)} key={key}/>)}</div>)}
      <div className="flex gap-2"><Button variant="outline" onClick={() => setPoints((value) => [...value, blank()])}>Add point</Button><Button disabled={!selectedSiteId || !cameraId || saving} onClick={() => void save()}>{saving ? 'Validating…' : 'Save calibration'}</Button></div>
      {message && <p className="text-sm text-destructive">{message}</p>}
      {result && <div className="rounded-md border p-3 text-sm"><b>Calibration v{result.versionNumber} saved</b><p>Reprojection error: {result.reprojectionError.toFixed(4)} m · {result.coordinateSpace}</p></div>}
    </CardContent></Card>
  </div>
}
