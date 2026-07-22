import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'error'

interface AvailableUpdate {
  version: string
  notes?: string
}

export default function UpdateButton() {
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const update = await check({ timeout: 10_000 })
        if (!update) {
          setAvailableUpdate(null)
          return
        }

        setAvailableUpdate({ version: update.version, notes: update.body })
        await update.close()
      } catch (updateError) {
        // Update availability must not prevent the agent from operating offline.
        console.warn('Unable to check for desktop update:', updateError)
      }
    }

    void checkForUpdate()
    const interval = window.setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  const installUpdate = async () => {
    if (phase === 'downloading' || phase === 'installing') return

    setPhase('downloading')
    setProgress(0)
    setError('')

    try {
      const update = await check({ timeout: 15_000 })
      if (!update) {
        setAvailableUpdate(null)
        setPhase('idle')
        return
      }

      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0
          setProgress(0)
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          if (contentLength > 0) {
            setProgress(Math.min(99, Math.round((downloaded / contentLength) * 100)))
          }
        } else if (event.event === 'Finished') {
          setProgress(100)
          setPhase('installing')
        }
      }, { timeout: 10 * 60 * 1000 })

      await relaunch()
    } catch (installError) {
      console.error('Desktop update failed:', installError)
      setError('Cập nhật thất bại. Click để thử lại.')
      setPhase('error')
    }
  }

  if (!availableUpdate) return null

  const isBusy = phase === 'downloading' || phase === 'installing'
  const label = phase === 'downloading'
    ? `Đang tải ${progress}%`
    : phase === 'installing'
      ? 'Đang cài đặt…'
      : phase === 'error'
        ? 'Thử cập nhật lại'
        : `Cập nhật v${availableUpdate.version}`

  return (
    <button
      type="button"
      onClick={() => void installUpdate()}
      disabled={isBusy}
      title={error || availableUpdate.notes || `Có phiên bản ${availableUpdate.version}`}
      aria-label={label}
      className={`relative inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-wait ${
        phase === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
      }`}
    >
      {isBusy
        ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        : phase === 'error'
          ? <RefreshCw className="size-4" aria-hidden="true" />
          : <Download className="size-4" aria-hidden="true" />}
      <span className="hidden xl:inline">{label}</span>
      {!isBusy && phase !== 'error' && (
        <span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full border-2 border-background bg-red-500" />
      )}
    </button>
  )
}
