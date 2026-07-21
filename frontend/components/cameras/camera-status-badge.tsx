import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Camera as CameraIcon, Activity, AlertCircle, WifiOff, Loader2 } from 'lucide-react'
import { type Camera, type CameraConnectionState } from '@/lib/api/camera-api'

interface CameraStatusBadgeProps {
  camera: Camera
  showDetails?: boolean
}

export function CameraStatusBadge({ camera, showDetails = false }: CameraStatusBadgeProps) {
  const health = camera.runtimeHealth
  const connectionState = health?.connectionState || 'stopped'
  const errorCode = health?.errorCode
  const lastFrameAt = health?.lastFrameAt

  // Determine overall status
  let status: 'online' | 'offline' | 'error' | 'connecting' | 'stopped'
  let icon: React.ReactNode
  let badgeClass: string
  let label: string
  let description: string

  if (camera.status === 'disabled') {
    status = 'stopped'
    icon = <WifiOff className="h-3 w-3" />
    badgeClass = 'bg-gray-500'
    label = 'Đã tắt'
    description = 'Camera đã bị vô hiệu hóa'
  } else if (!health || connectionState === 'agent_offline') {
    status = 'offline'
    icon = <WifiOff className="h-3 w-3" />
    badgeClass = 'bg-gray-400'
    label = 'Chờ Agent'
    description = camera.agentName ? `Máy "${camera.agentName}" đang ngoại tuyến` : 'Chưa có máy vận hành được gán'
  } else if (errorCode) {
    status = 'error'
    icon = <AlertCircle className="h-3 w-3" />
    badgeClass = 'bg-red-500'
    label = getErrorLabel(errorCode)
    description = getErrorDescription(errorCode)
  } else if (connectionState === 'online' || connectionState === 'streaming') {
    status = 'online'
    icon = <Activity className="h-3 w-3" />
    badgeClass = 'bg-green-500'
    label = 'Đang hoạt động'
    description = health.fps ? `${health.fps.toFixed(1)} FPS` : 'Camera đang phát'
  } else if (connectionState === 'connecting' || connectionState === 'assigned') {
    status = 'connecting'
    icon = <Loader2 className="h-3 w-3 animate-spin" />
    badgeClass = 'bg-blue-500'
    label = 'Đang kết nối'
    description = 'Đang mở kết nối RTSP'
  } else {
    status = 'stopped'
    icon = <WifiOff className="h-3 w-3" />
    badgeClass = 'bg-gray-400'
    label = 'Đã dừng'
    description = 'Camera không hoạt động'
  }

  const badge = (
    <Badge className={`${badgeClass} text-white gap-1.5`}>
      {icon}
      {label}
    </Badge>
  )

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
              {health?.lastFrameAt && (
                <p className="text-xs text-muted-foreground">
                  Frame cuối: {formatRelativeTime(health.lastFrameAt)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-2">
      {badge}
      <div className="text-sm">
        <p className="text-muted-foreground">{description}</p>
        {health && (
          <div className="mt-2 space-y-1 text-xs">
            {camera.agentName && (
              <p className="text-muted-foreground">Máy: {camera.agentName}</p>
            )}
            {health.fps && (
              <p className="text-muted-foreground">FPS: {health.fps.toFixed(1)}</p>
            )}
            {health.width && health.height && (
              <p className="text-muted-foreground">
                Độ phân giải: {health.width}×{health.height}
              </p>
            )}
            {health.lastFrameAt && (
              <p className="text-muted-foreground">
                Frame cuối: {formatRelativeTime(health.lastFrameAt)}
              </p>
            )}
            {health.queueDepth !== undefined && health.queueDepth > 0 && (
              <p className="text-amber-600">
                Hàng đợi: {health.queueDepth} sự kiện
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getErrorLabel(errorCode: string): string {
  const labels: Record<string, string> = {
    RTSP_DNS_FAILED: 'Lỗi DNS',
    RTSP_CONNECT_TIMEOUT: 'Timeout',
    RTSP_CONNECTION_REFUSED: 'Từ chối kết nối',
    RTSP_AUTH_FAILED: 'Sai mật khẩu',
    RTSP_UNSUPPORTED_CODEC: 'Codec không hỗ trợ',
    RTSP_NO_FRAMES: 'Không có frame',
    RTSP_STREAM_ERROR: 'Lỗi stream',
    MODEL_LOAD_FAILED: 'Lỗi tải model',
    MODEL_INFERENCE_ERROR: 'Lỗi AI',
    INGEST_UNAUTHORIZED: 'Không có quyền',
    BACKEND_UNREACHABLE: 'Mất kết nối backend',
    WORKER_CRASHED: 'Worker bị lỗi',
    CONFIG_INVALID: 'Cấu hình không hợp lệ',
  }
  return labels[errorCode] || errorCode
}

function getErrorDescription(errorCode: string): string {
  const descriptions: Record<string, string> = {
    RTSP_DNS_FAILED: 'Không thể phân giải tên miền camera',
    RTSP_CONNECT_TIMEOUT: 'Camera không phản hồi sau timeout',
    RTSP_CONNECTION_REFUSED: 'Camera từ chối kết nối',
    RTSP_AUTH_FAILED: 'Tên đăng nhập hoặc mật khẩu không đúng',
    RTSP_UNSUPPORTED_CODEC: 'Camera dùng codec không được hỗ trợ',
    RTSP_NO_FRAMES: 'Kết nối thành công nhưng không nhận được hình ảnh',
    RTSP_STREAM_ERROR: 'Lỗi khi đọc stream video',
    MODEL_LOAD_FAILED: 'Không thể tải model AI',
    MODEL_INFERENCE_ERROR: 'Lỗi khi chạy AI inference',
    INGEST_UNAUTHORIZED: 'Không có quyền gửi dữ liệu lên backend',
    BACKEND_UNREACHABLE: 'Không thể kết nối đến backend API',
    WORKER_CRASHED: 'Worker xử lý camera bị crash',
    CONFIG_INVALID: 'Cấu hình camera không hợp lệ',
  }
  return descriptions[errorCode] || 'Lỗi không xác định'
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 5) return 'Vừa xong'
  if (diffSecs < 60) return `${diffSecs}s trước`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m trước`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h trước`
  return `${Math.floor(diffSecs / 86400)}d trước`
}
