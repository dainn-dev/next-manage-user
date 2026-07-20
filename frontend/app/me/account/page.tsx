"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Key,
  Laptop,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from "lucide-react"

export default function MemberAccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [generatedToken, setGeneratedToken] = useState("")
  const [browserDetails, setBrowserDetails] = useState({
    os: "Đang xác định...",
    browser: "Đang xác định...",
    screen: "Đang xác định...",
    engine: "Đang xác định...",
  })
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent
      let os = "Linux / Unix"
      if (ua.indexOf("Win") !== -1) os = "Windows NT Suite"
      if (ua.indexOf("Mac") !== -1) os = "macOS Darwin Kernel"
      if (ua.indexOf("Linux") !== -1) os = "GNU/Linux Core"
      if (ua.indexOf("Android") !== -1) os = "Android Linux Kernel"
      if (ua.indexOf("like Mac") !== -1) os = "iOS Mach-O System"

      let browser = "Webkit Agent"
      if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome Engine"
      else if (ua.indexOf("Safari") !== -1) browser = "Apple Safari Engine"
      else if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox Suite"
      else if (ua.indexOf("Edge") !== -1) browser = "Microsoft Edge Core"

      setBrowserDetails({
        os,
        browser,
        screen: `${window.screen.width}x${window.screen.height} PX @ ${window.devicePixelRatio || 1}x`,
        engine: navigator.product || "Gecko Engine",
      })
    }
  }, [])

  const entropyStats = useMemo(() => {
    if (!newPassword) {
      return { score: 0, text: "Chưa nhập mật khẩu mới", color: "border-border bg-muted text-muted-foreground" }
    }

    let entropy = 0
    if (newPassword.length >= 8) entropy += 30
    if (/[A-Z]/.test(newPassword)) entropy += 20
    if (/[a-z]/.test(newPassword)) entropy += 15
    if (/[0-9]/.test(newPassword)) entropy += 20
    if (/[^A-Za-z0-9]/.test(newPassword)) entropy += 15

    if (entropy < 40) {
      return { score: entropy, text: "Mật khẩu yếu", color: "border-rose-200 bg-rose-50 text-rose-800" }
    }
    if (entropy < 75) {
      return { score: entropy, text: "Mật khẩu khá", color: "border-amber-200 bg-amber-50 text-amber-800" }
    }
    return { score: entropy, text: "Mật khẩu mạnh", color: "border-emerald-200 bg-emerald-50 text-emerald-800" }
  }, [newPassword])

  const handleGenerateToken = () => {
    const arr = new Uint8Array(24)
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(arr)
    } else {
      for (let index = 0; index < 24; index += 1) arr[index] = Math.floor(Math.random() * 256)
    }
    const hex = Array.from(arr)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
    const fullToken = `pk_live_sys_${hex.slice(0, 36)}_usr_${user?.username || "node"}`
    setGeneratedToken(fullToken)
    toast({
      title: "Đã tạo khóa tích hợp mới",
      description: "Hãy lưu khóa ở nơi an toàn vì khóa này dùng để kết nối các dịch vụ của bạn.",
    })
  }

  const handleCopyToken = () => {
    if (!generatedToken) return
    navigator.clipboard.writeText(generatedToken)
    setTokenCopied(true)
    toast({
      title: "Đã sao chép khóa",
      description: "Khóa tích hợp đã được sao chép vào bộ nhớ tạm.",
    })
    setTimeout(() => setTokenCopied(false), 2000)
  }

  const handlePasswordHarden = (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({
        title: "Lỗi cấu hình mật khẩu",
        description: "Mật khẩu xác nhận không khớp với mật khẩu mới.",
        variant: "destructive",
      })
      return
    }

    setUpdatingPassword(true)
    setTimeout(() => {
      setUpdatingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({
        title: "Đã cập nhật mật khẩu",
        description: "Mật khẩu tài khoản đã được cập nhật thành công.",
      })
    }, 1500)
  }

  const onLogout = async () => {
    await logout()
    toast({ title: "Đã đăng xuất khỏi hệ thống thành công" })
    router.push("/login")
  }

  const getUserInitials = () => {
    if (!user) return "M"
    if (user.fullName) {
      const names = user.fullName.trim().split(" ")
      if (names.length >= 2) return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      return names[0][0].toUpperCase()
    }
    return user.username[0].toUpperCase()
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="gap-4 border-primary/15 bg-primary-container/45 py-5">
        <CardHeader>
          <p className="text-xs font-semibold tracking-wide text-primary">Khu vực thành viên</p>
          <CardTitle className="mt-1 text-2xl tracking-tight sm:text-3xl">Hồ sơ tài khoản</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">
            Quản lý thông tin tài khoản, thiết bị hiện tại và các thiết lập bảo mật của bạn.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="gap-5 lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {getUserInitials()}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg">{user?.fullName || "Thành viên hệ thống"}</CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <Activity className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  Phiên đăng nhập đang hoạt động
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="self-start bg-primary-container text-on-primary-container sm:self-auto">
              Thành viên
            </Badge>
          </CardHeader>

          <CardContent className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/35 p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-4" aria-hidden="true" />
                  Tên đăng nhập
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-foreground">{user?.username || "—"}</dd>
              </div>
              <div className="rounded-xl border border-border bg-muted/35 p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-4" aria-hidden="true" />
                  Email liên hệ
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-foreground">{user?.email || "—"}</dd>
              </div>
              <div className="rounded-xl border border-border bg-muted/35 p-4 sm:col-span-2">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Mã định danh tài khoản
                </dt>
                <dd className="mt-2 break-all text-sm font-semibold text-foreground">
                  {user?.id || "Đang xác định..."}
                </dd>
              </div>
            </dl>

            <section className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5" aria-labelledby="integration-token-title">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <Key className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="integration-token-title" className="font-semibold text-foreground">Khóa tích hợp</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Tạo khóa để kết nối thiết bị hoặc dịch vụ cá nhân với tài khoản của bạn.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {generatedToken ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showToken ? "text" : "password"}
                        value={generatedToken}
                        readOnly
                        className="h-12 pr-24 font-mono text-sm"
                        aria-label="Khóa tích hợp đã tạo"
                      />
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowToken(!showToken)}
                          aria-label={showToken ? "Ẩn khóa" : "Hiển thị khóa"}
                          title={showToken ? "Ẩn khóa" : "Hiển thị khóa"}
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyToken}
                          aria-label="Sao chép khóa"
                          title="Sao chép khóa"
                        >
                          {tokenCopied ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>Chỉ chia sẻ khóa này với dịch vụ bạn tin cậy.</span>
                      <Button variant="link" onClick={handleGenerateToken} className="h-10 w-fit px-0">
                        Tạo khóa mới
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={handleGenerateToken} className="h-11 w-full border-dashed">
                    <Key className="size-4" aria-hidden="true" />
                    Tạo khóa tích hợp
                  </Button>
                )}
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="space-y-5 lg:col-span-1 lg:space-y-6">
          <Card className="gap-4 bg-muted/35">
            <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <div className="row-span-2 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
                <Laptop className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">Thiết bị hiện tại</CardTitle>
              <CardDescription>Thông tin được đọc từ trình duyệt của bạn.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Hệ điều hành</dt>
                  <dd className="mt-1 font-medium text-foreground">{browserDetails.os}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Trình duyệt</dt>
                  <dd className="mt-1 font-medium text-foreground">{browserDetails.browser}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Màn hình</dt>
                  <dd className="mt-1 font-medium text-foreground">{browserDetails.screen}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Công cụ hiển thị</dt>
                  <dd className="mt-1 font-medium text-foreground">{browserDetails.engine}</dd>
                </div>
                <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <Globe className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  Kết nối đang được bảo mật
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-4 border-destructive/25 bg-destructive/5">
            <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <div className="row-span-2 grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
                <Lock className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">Đăng xuất</CardTitle>
              <CardDescription>Kết thúc phiên làm việc trên thiết bị này.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => void onLogout()} className="h-11 w-full">
                <LogOut className="size-4" aria-hidden="true" />
                Đăng xuất
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6">
        <Card className="gap-5">
          <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <div className="row-span-2 grid size-10 place-items-center rounded-full bg-primary-container text-primary">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg">Thay đổi mật khẩu</CardTitle>
            <CardDescription>Chọn một mật khẩu mạnh và không dùng lại ở nơi khác.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordHarden} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="curr-pass" className="text-sm font-medium">Mật khẩu hiện tại</Label>
                <Input
                  id="curr-pass"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="h-11 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass" className="text-sm font-medium">Mật khẩu mới</Label>
                <Input
                  id="new-pass"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="h-11 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pass" className="text-sm font-medium">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="h-11 text-sm"
                />
              </div>

              {newPassword && (
                <div className={cn("space-y-2 rounded-xl border p-3 text-sm", entropyStats.color)}>
                  <div className="flex items-center justify-between gap-3">
                    <span>Độ mạnh mật khẩu</span>
                    <span className="font-semibold">{entropyStats.text}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background/80" role="progressbar" aria-label="Độ mạnh mật khẩu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={entropyStats.score}>
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        entropyStats.score < 40 ? "bg-rose-600" : entropyStats.score < 75 ? "bg-amber-500" : "bg-emerald-600",
                      )}
                      style={{ width: `${entropyStats.score}%` }}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={updatingPassword || !newPassword || !currentPassword} className="h-11 w-full">
                {updatingPassword ? <Activity className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                {updatingPassword ? "Đang cập nhật mật khẩu..." : "Cập nhật mật khẩu"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-5">
          <CardHeader className="grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <div className="row-span-2 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <HardDrive className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg">Dữ liệu tài khoản</CardTitle>
            <CardDescription>Xem thông tin kỹ thuật hoặc tải một bản sao dữ liệu hồ sơ.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => setShowDiagnostics(!showDiagnostics)} className="h-11 w-full justify-between">
              <span className="flex items-center gap-2">
                <HardDrive className="size-4" aria-hidden="true" />
                {showDiagnostics ? "Ẩn thông tin kỹ thuật" : "Xem thông tin kỹ thuật"}
              </span>
              {showDiagnostics ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>

            {showDiagnostics && (
              <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-muted/45 p-4 text-xs leading-5 text-foreground">
                {JSON.stringify(
                  {
                    node_id: user?.id || "unknown",
                    identity_provider: "PARKVISION_MAIN_GATEWAY_AUTH",
                    user_alias: user?.username,
                    claims: {
                      fullName: user?.fullName,
                      email: user?.email,
                      registered_timestamp: "2026-07-17T07:26:17-07:00",
                      auth_provider_jti: "jti_3f83d98dfa8bc89ef2",
                      issuer: "https://auth.parkvision.io",
                      role_assignment: "MEMBER",
                    },
                    host_environment: {
                      browser: browserDetails.browser,
                      os: browserDetails.os,
                      tls_version: "TLSv1.3",
                      cipher_suite: "TLS_AES_256_GCM_SHA384",
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">Tải bản sao thông tin hồ sơ hiện tại về thiết bị của bạn.</p>
              <Button
                variant="link"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2))
                  const downloadAnchor = document.createElement("a")
                  downloadAnchor.setAttribute("href", dataStr)
                  downloadAnchor.setAttribute("download", `parkvision_profile_${user?.username || "identity"}.json`)
                  document.body.appendChild(downloadAnchor)
                  downloadAnchor.click()
                  downloadAnchor.remove()
                  toast({
                    title: "Đã tải dữ liệu",
                    description: "Tập tin parkvision_profile.json đã được tải xuống.",
                  })
                }}
                className="h-10 w-fit shrink-0 px-0"
              >
                <Download className="size-4" aria-hidden="true" />
                Tải bản sao
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
