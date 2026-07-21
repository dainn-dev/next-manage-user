import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

interface CameraHealth {
  camera_id: string
  state: string
  last_frame_at: string | null
  fps: number
  error: string | null
}

export default function CameraGrid() {
  const [cameras, setCameras] = useState<CameraHealth[]>([])

  useEffect(() => {
    loadCameras()
    const interval = setInterval(loadCameras, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [])

  const loadCameras = async () => {
    // TODO: Get camera list from config
    // For now, show placeholder
    setCameras([])
  }

  if (cameras.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <h3 className="text-lg font-semibold mb-2">No cameras configured</h3>
          <p className="text-sm">
            Add cameras on the website, and they will appear here automatically
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cameras.map((camera) => (
        <div key={camera.camera_id} className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{camera.camera_id}</h3>
            <span className={`text-xs px-2 py-1 rounded ${
              camera.state === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {camera.state}
            </span>
          </div>

          <div className="aspect-video bg-muted rounded flex items-center justify-center text-muted-foreground">
            {camera.state === 'online' ? 'Preview Stream' : 'No Stream'}
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FPS:</span>
              <span>{camera.fps.toFixed(1)}</span>
            </div>
            {camera.last_frame_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last frame:</span>
                <span>{new Date(camera.last_frame_at).toLocaleTimeString()}</span>
              </div>
            )}
            {camera.error && (
              <div className="text-destructive text-xs mt-2">{camera.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
