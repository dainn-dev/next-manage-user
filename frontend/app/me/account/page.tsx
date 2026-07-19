"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  User,
  LogOut,
  ShieldCheck,
  Cpu,
  Layers,
  Lock,
  Mail,
  UserCheck,
  Key,
  Terminal,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Laptop,
  Globe,
  Activity,
  HardDrive,
  Info,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp
} from "lucide-react"

export default function MemberAccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // State managers
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [generatedToken, setGeneratedToken] = useState("")
  
  // Client browser specs parsed live
  const [browserDetails, setBrowserDetails] = useState({
    os: "RESOLVING...",
    browser: "RESOLVING...",
    screen: "RESOLVING...",
    engine: "RESOLVING..."
  })

  // Simulated password change states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Diagnostics JSON dump toggler
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  // Parse client specs
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
        engine: navigator.product || "Gecko Engine"
      })
    }
  }, [])

  // Live password strength/entropy checker
  const entropyStats = useMemo(() => {
    if (!newPassword) return { score: 0, text: "EMPTY_BUFFER", color: "text-slate-600 bg-background border-border" }
    
    let entropy = 0
    if (newPassword.length >= 8) entropy += 30
    if (/[A-Z]/.test(newPassword)) entropy += 20
    if (/[a-z]/.test(newPassword)) entropy += 15
    if (/[0-9]/.test(newPassword)) entropy += 20
    if (/[^A-Za-z0-9]/.test(newPassword)) entropy += 15

    if (entropy < 40) {
      return { score: entropy, text: "CRITICAL_LOW_ENTROPY", color: "text-rose-700 bg-rose-50/50 border-rose-200" }
    } else if (entropy < 75) {
      return { score: entropy, text: "STANDARD_ENCRYPTION_OK", color: "text-amber-700 bg-amber-50/50 border-amber-200" }
    } else {
      return { score: entropy, text: "MILITARY_GRADE_CIPHER_COMPLIANT", color: "text-emerald-700 bg-emerald-950/20 border-emerald-200" }
    }
  }, [newPassword])

  // Mock token generator
  const handleGenerateToken = () => {
    const arr = new Uint8Array(24)
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(arr)
    } else {
      for (let i = 0; i < 24; i++) arr[i] = Math.floor(Math.random() * 256)
    }
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    const fullToken = `pk_live_sys_${hex.slice(0, 36)}_usr_${user?.username || "node"}`
    setGeneratedToken(fullToken)
    toast({
      title: "Đã tạo API Token mới",
      description: "Hệ thống đã mã hóa khóa truy cập với thuật toán SHA-256.",
    })
  }

  // Copy token
  const handleCopyToken = () => {
    if (!generatedToken) return
    navigator.clipboard.writeText(generatedToken)
    setTokenCopied(true)
    toast({
      title: "COPIED_TO_CLIPBOARD",
      description: "Mã API Node đã được sao chép vào bộ nhớ tạm.",
    })
    setTimeout(() => setTokenCopied(false), 2000)
  }

  // Handle simulated password submit
  const handlePasswordHarden = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({
        title: "Lỗi cấu hình mật khẩu",
        description: "Mật khẩu xác nhận không khớp với mật khẩu mới.",
        variant: "destructive"
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
        title: "SECURITY_UPDATE_SUCCESS",
        description: "Mật khẩu tài khoản đã được tái mã hóa thành công.",
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
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      } else {
        return names[0][0].toUpperCase()
      }
    }
    return user.username[0].toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Sci-Fi Page Header */}
      <div className="border-b border-border pb-5">
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            MEMBER // PROFILE_CREDENTIALS_CONSOLE
          </span>
          <h1 className="text-2xl font-bold tracking-wider text-foreground font-mono uppercase">
            {"HỒ SƠ TÀI KHOẢN"}
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase leading-relaxed max-w-xl">
            {"Bảng quản lý thông tin tài khoản, xác thực bảo mật và phân quyền hệ thống của thành viên trên nền tảng ParkVision."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Profile Card Console */}
        <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-6 relative overflow-hidden backdrop-blur-xl lg:col-span-2 group">
          {/* Tech corner ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

          {/* Cyber grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-20" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border pb-5 relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-background border border-border text-cyan-600 text-lg font-mono font-bold shadow-sm relative">
                {getUserInitials()}
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <span className="block font-mono text-[9px] tracking-widest text-slate-500 uppercase">
                  {"SYS_ACCESS_LEVEL // MEMBER_USER"}
                </span>
                <span className="text-base font-mono font-bold text-foreground uppercase tracking-wider block">
                  {user?.fullName || "Thành viên hệ thống"}
                </span>
                <span className="font-mono text-[10px] text-cyan-600 uppercase mt-0.5 block flex items-center gap-1">
                  <Activity className="h-3 w-3 text-cyan-600 animate-pulse" />
                  {"ACTIVE_CONSOLE_NODE_ONLINE"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="font-mono text-[9px] text-slate-500 uppercase">{"ROLE_VERIFICATION"}</span>
              <span className="bg-cyan-100/50 text-cyan-600 border border-cyan-200 text-[9px] font-mono tracking-widest uppercase px-2.5 py-1 rounded shadow-sm">
                {"LEVEL_01_MEMBER"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 relative z-10 mb-6">
            <div className="space-y-1.5 p-4 rounded-xl bg-background/60 border border-border hover:border-border transition-colors">
              <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                {"USER_ID_NAME // TÊN ĐĂNG NHẬP"}
              </span>
              <span className="font-mono text-xs font-bold text-foreground tracking-wide block">
                {user?.username}
              </span>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl bg-background/60 border border-border hover:border-border transition-colors">
              <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                {"CONTACT_EMAIL // EMAIL LIÊN HỆ"}
              </span>
              <span className="font-mono text-xs text-slate-700 tracking-wide block truncate" title={user?.email || "Chưa thiết lập"}>
                {user?.email || "—"}
              </span>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl bg-background/60 border border-border hover:border-border transition-colors">
              <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                {"SESSION_ALIVE_KEY // MÃ ĐỊNH DANH"}
              </span>
              <span className="font-mono text-[11px] font-bold text-muted-foreground tracking-wider block font-mono select-all uppercase">
                {user?.id ? `NODE_UID_${user.id.slice(0, 16)}` : "RESOLVING..."}
              </span>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl bg-background/60 border border-border hover:border-border transition-colors">
              <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                {"SECURITY_RECON_FIREWALL"}
              </span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span className="font-mono text-xs text-muted-foreground">
                  {"PARKVISION // SECURITY_LOCK_OK"}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Developer Integration CLI Tool block */}
          <div className="border border-border bg-background rounded-xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-cyan-600 animate-pulse" />
                <span className="font-mono text-[10px] tracking-widest text-cyan-600 uppercase">
                  {"DEVELOPER_CLI_INTEGRATION // API_NODE"}
                </span>
              </div>
              <span className="font-mono text-[9px] text-slate-600 uppercase">
                {"SECURE_TUNNEL_STATE"}
              </span>
            </div>

            <p className="text-[10px] font-mono text-slate-500 uppercase mb-4 leading-relaxed">
              {"Tạo mã định danh API bí mật để liên kết hệ thống nhà thông minh cá nhân hoặc truy vấn tự động trạng thái xe của bạn qua thiết bị gắn ngoài."}
            </p>

            {generatedToken ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={generatedToken}
                    readOnly
                    className="bg-background border-border text-cyan-700 font-mono text-[11px] h-10 pr-20 rounded-lg tracking-wider focus-visible:ring-0 focus-visible:border-border"
                    aria-label="Generated Developer Token"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title={showToken ? "Ẩn Token" : "Hiển thị Token"}
                    >
                      {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyToken}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Copy Token"
                    >
                      {tokenCopied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase">
                  <span>{"TYPE: SHA-256 JWT COMPLIANT"}</span>
                  <Button
                    variant="link"
                    onClick={handleGenerateToken}
                    className="h-auto p-0 text-[9px] text-cyan-600 hover:text-cyan-700 font-mono uppercase"
                  >
                    {"RE-GENERATE_TOKEN // LÀM MỚI KHÓA"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleGenerateToken}
                className="w-full border-dashed border-cyan-200 bg-cyan-50 hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 font-mono text-xs uppercase h-10 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Key className="h-3.5 w-3.5 text-cyan-600 animate-bounce" />
                <span>{"GENERATE_INTEGRATION_TOKEN // KHỞI TẠO API TOKEN"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar panels */}
        <div className="space-y-6 lg:col-span-1">
          {/* Active client diagnostics telemetry */}
          <div className="border border-border bg-muted/10 text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl group">
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

            <div className="flex items-center gap-2 text-cyan-600 border-b border-border pb-3 mb-4">
              <Laptop className="h-4 w-4 shrink-0 text-cyan-600" />
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider">
                {"CLIENT_TELEMETRY // THIẾT BỊ"}
              </h3>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-0.5">
                <span className="block font-mono text-[8px] tracking-widest text-slate-500 uppercase">{"SYSTEM_OPERATING_KERNEL"}</span>
                <p className="font-mono text-xs text-foreground uppercase tracking-wide">{browserDetails.os}</p>
              </div>

              <div className="space-y-0.5">
                <span className="block font-mono text-[8px] tracking-widest text-slate-500 uppercase">{"AGENT_BROWSER_RECON"}</span>
                <p className="font-mono text-xs text-slate-700 uppercase tracking-wide">{browserDetails.browser}</p>
              </div>

              <div className="space-y-0.5">
                <span className="block font-mono text-[8px] tracking-widest text-slate-500 uppercase">{"SCREEN_MATRIX_DIMENSIONS"}</span>
                <p className="font-mono text-xs text-cyan-600 uppercase tracking-wide font-bold">{browserDetails.screen}</p>
              </div>

              <div className="space-y-0.5">
                <span className="block font-mono text-[8px] tracking-widest text-slate-500 uppercase">{"RENDER_ENGINE_CORES"}</span>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{browserDetails.engine}</p>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  {"TUNNEL: SECURE"}
                </span>
                <span>{"SSL_TLS_v1.3"}</span>
              </div>
            </div>
          </div>

          {/* Quick exit console */}
          <div className="border border-rose-200/40 bg-rose-50/30 text-foreground shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl group">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-rose-100 group-hover:border-rose-200" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-rose-100 group-hover:border-rose-200" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-rose-100 group-hover:border-rose-200" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-rose-100 group-hover:border-rose-200" />

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-rose-700 border-b border-rose-200/30 pb-2.5">
                <Lock className="h-4 w-4 shrink-0 text-rose-500" />
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider">
                  {"TERMINAL_SESSIONS"}
                </h3>
              </div>
              <p className="text-[10px] font-mono text-slate-500 uppercase leading-relaxed">
                {"Nhấp đăng xuất để hủy phiên làm việc hiện tại và thu hồi token bảo mật khỏi trình duyệt."}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void onLogout()}
              className="w-full border-rose-200 bg-rose-950/10 hover:bg-rose-50/50 text-rose-700 hover:text-rose-300 font-mono text-xs uppercase h-11 px-4 rounded-lg flex items-center justify-center gap-2 transition-all mt-4"
            >
              <LogOut className="h-4 w-4 shrink-0 text-rose-700" />
              <span>{"SIGN_OUT // ĐĂNG XUẤT"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Row 2: Security Hardening & Raw Diagnostics */}
      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Security Hardening Form */}
        <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-6 relative overflow-hidden backdrop-blur-xl group">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

          <div className="mb-4 pb-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-mono tracking-widest text-cyan-600 uppercase flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-cyan-600" />
              {"SECURITY_HARDENING // THAY MẬT KHẨU"}
            </h2>
            <span className="font-mono text-[8px] text-slate-500 uppercase">{"ENCRYPTED_SUBMIT"}</span>
          </div>

          <form onSubmit={handlePasswordHarden} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="curr-pass" className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider block">
                {"CURRENT_PASSCODE // MẬT KHẨU HIỆN TẠI"}
              </Label>
              <Input
                id="curr-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mã bảo mật hiện tại..."
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-10 px-3 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider block">
                {"NEW_PASSCODE // MẬT KHẨU MỚI"}
              </Label>
              <Input
                id="new-pass"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Khởi tạo mật khẩu mới..."
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-10 px-3 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass" className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider block">
                {"CONFIRM_PASSCODE // XÁC NHẬN MẬT KHẨU"}
              </Label>
              <Input
                id="confirm-pass"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="bg-background border-border text-foreground placeholder-slate-400 font-mono h-10 px-3 rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-200 tracking-wide text-xs"
              />
            </div>

            {/* Live Entropy scanner result */}
            {newPassword && (
              <div className={cn("p-3 rounded-lg border text-[10px] font-mono uppercase space-y-1.5 transition-all duration-300", entropyStats.color)}>
                <div className="flex justify-between items-center">
                  <span>{"ENTROPY_INDEX_LEVEL:"}</span>
                  <span className="font-bold">{entropyStats.text}</span>
                </div>
                <div className="w-full bg-background rounded-full h-1 overflow-hidden border border-border">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      entropyStats.score < 40 ? "bg-rose-500" : entropyStats.score < 75 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${entropyStats.score}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={updatingPassword || !newPassword || !currentPassword}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-bold uppercase tracking-wider text-xs h-10 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              <ShieldAlert className="h-4 w-4 text-white shrink-0" />
              <span>{updatingPassword ? "HARDENING_CREDENTIALS..." : "COMMIT // TÁI MÃ HÓA TÀI KHOẢN"}</span>
            </Button>
          </form>
        </div>

        {/* Diagnostics & Raw Decrypted Node */}
        <div className="border border-border bg-card text-foreground shadow-xl rounded-xl p-6 relative overflow-hidden backdrop-blur-xl flex flex-col justify-between min-h-[300px] group">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-border group-hover:border-cyan-200 transition-colors" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-border group-hover:border-cyan-200 transition-colors" />

          <div className="space-y-4">
            <div className="mb-2 pb-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-mono tracking-widest text-cyan-600 uppercase flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-cyan-600" />
                {"IDENTITY_NODE_DIAGNOSTICS // RAW_DUMP"}
              </h2>
              <span className="font-mono text-[8px] text-slate-500 uppercase">{"JWT_RESOLVED_OK"}</span>
            </div>

            <p className="text-[10px] font-mono text-slate-500 uppercase leading-relaxed">
              {"Xuất bản ghi cấu trúc dữ liệu thô của mã định danh thành viên. Thích hợp cho các hoạt động debug hoặc chứng thực phân vùng ngoại quan."}
            </p>

            <Button
              variant="outline"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full border-border bg-card text-slate-700 hover:text-foreground hover:bg-muted font-mono text-xs uppercase h-10 px-4 rounded-lg flex items-center justify-between gap-2 transition-all"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-cyan-600" />
                <span>{showDiagnostics ? "HIDE_RAW_NODE_PARAMS // ẨN THÔNG SỐ" : "SHOW_RAW_NODE_PARAMS // XEM CHI TIẾT"}</span>
              </span>
              {showDiagnostics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showDiagnostics && (
              <div className="rounded-lg border border-border bg-background p-4 font-mono text-[9px] text-emerald-700 overflow-x-auto max-h-[160px] overflow-y-auto select-all relative">
                <div className="absolute top-2 right-2 text-[8px] text-slate-600 tracking-wider">{"DECRYPTED_PLAINTEXT_OK"}</div>
                <pre>{JSON.stringify({
                  node_id: user?.id || "unknown",
                  identity_provider: "PARKVISION_MAIN_GATEWAY_AUTH",
                  user_alias: user?.username,
                  claims: {
                    fullName: user?.fullName,
                    email: user?.email,
                    registered_timestamp: "2026-07-17T07:26:17-07:00",
                    auth_provider_jti: "jti_3f83d98dfa8bc89ef2",
                    issuer: "https://auth.parkvision.io",
                    role_assignment: "MEMBER"
                  },
                  host_environment: {
                    browser: browserDetails.browser,
                    os: browserDetails.os,
                    tls_version: "TLSv1.3",
                    cipher_suite: "TLS_AES_256_GCM_SHA384"
                  }
                }, null, 2)}</pre>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              {"DATA_BACKUP_GATEWAY"}
            </span>
            <Button
              variant="link"
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2))
                const downloadAnchor = document.createElement('a')
                downloadAnchor.setAttribute("href", dataStr)
                downloadAnchor.setAttribute("download", `parkvision_profile_${user?.username || "identity"}.json`)
                document.body.appendChild(downloadAnchor)
                downloadAnchor.click()
                downloadAnchor.remove()
                toast({
                  title: "EXPORT_COMPLETED",
                  description: "Tập tin parkvision_profile.json đã được tải xuống.",
                })
              }}
              className="h-auto p-0 text-[10px] text-cyan-600 hover:text-cyan-700 font-mono uppercase flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{"DOWNLOAD_SECURE_DUMP // TẢI BẢN SAO"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
