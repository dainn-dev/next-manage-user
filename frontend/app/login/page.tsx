"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { canViewDashboard, isMember, isPlatformAdmin, type UserRole } from "@/lib/types"
import {
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  ParkingCircle,
  Cpu,
  Terminal,
  AlertCircle,
} from "lucide-react"

function homeForRole(role?: UserRole): string {
  if (isPlatformAdmin(role)) return "/platform/overview"
  if (isMember(role)) return "/me"
  if (canViewDashboard(role)) return "/dashboard"
  return "/me"
}

const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const router = useRouter()
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  // Redirect already-authenticated users away from the login screen.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(homeForRole(user?.role))
    }
  }, [isLoading, isAuthenticated, router, user?.role])

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      const loggedIn = await login(values)
      toast({
        title: "Đăng nhập thành công",
        description: "Chào mừng bạn đến với ParkVision",
      })
      router.push(homeForRole(loggedIn.role))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Có lỗi xảy ra khi đăng nhập"
      setFormError(message)
      toast({
        title: "Đăng nhập thất bại",
        description: message,
        variant: "destructive",
      })
    }
  }

  // Avoid flashing the form while the auth state is being resolved / redirecting.
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#020617]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-label="Đang tải" />
      </div>
    )
  }

  return (
    <div className="relative grid min-h-dvh bg-[#020617] text-slate-100 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* Glow effects in the background */}
      <div className="absolute inset-0 -z-50 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle, #10b981 1.2px, transparent 1.2px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[150px]" />
      </div>

      {/* Brand panel — desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800/60 bg-slate-950/40 p-12 lg:flex">
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <ParkingCircle className="size-5 text-emerald-400" />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-white font-mono">
              PARK<span className="text-emerald-400">VISION</span>
            </p>
            <p className="text-xs text-slate-500 font-mono">VER_4.0_ONBOARDING</p>
          </div>
        </div>

        {/* Technical overview section */}
        <div className="relative max-w-md space-y-8 my-auto">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <Cpu className="size-3.5 animate-pulse" />
              SẮN SÀNG TRIỂN KHAI
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white leading-snug">
              Một dashboard cho mọi bãi xe
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Nền tảng quản lý bãi đỗ thông minh: nhận diện biển số, giám sát ô
              đỗ và cảnh báo di dời trong thời gian thực.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 font-mono text-xs text-slate-400 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Terminal className="size-3.5 text-emerald-400" /> SYSTEM_STATUS:
              </span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Nhận diện OCR biển số Việt Nam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Theo dõi định vị track_id ByteTrack</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Cập nhật WebSocket độ trễ &lt; 2s</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 font-mono">
          © {new Date().getFullYear()} PARKVISION. ALL INTENTIONS SECURED.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 relative">
        <div className="w-full max-w-md space-y-6">
          {/* Logo on mobile only */}
          <div className="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <ParkingCircle className="size-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white font-mono">
                PARK<span className="text-emerald-400">VISION</span>
              </p>
              <p className="text-xs text-slate-500 font-mono">Smart Parking 4.0</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 shadow-2xl backdrop-blur-xl sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                  PORTAL ACCESS // ĐĂNG NHẬP
                </span>
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Chào mừng trở lại
              </h1>
              <p className="text-xs text-slate-400">
                Nhập thông tin xác thực để truy cập bảng điều khiển hệ thống.
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs font-mono text-red-400"
              >
                ● ERR_AUTH: {formError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-slate-300 font-mono">
                  &gt; TÊN ĐĂNG NHẬP
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin_username"
                  autoComplete="username"
                  autoFocus
                  disabled={isSubmitting}
                  aria-invalid={!!errors.username}
                  className="h-10 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                  {...register("username")}
                />
                {errors.username && (
                  <p role="alert" className="text-xs text-red-400 mt-1 font-mono">
                    ● {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-slate-300 font-mono">
                  &gt; MẬT KHẨU
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.password}
                    className="h-10 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p role="alert" className="text-xs text-red-400 mt-1 font-mono">
                    ● {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    disabled={isSubmitting}
                    className="border-slate-700 text-emerald-500"
                  />
                  <Label
                    htmlFor="remember"
                    className="cursor-pointer text-xs font-mono text-slate-400 select-none"
                  >
                    Ghi nhớ đăng nhập
                  </Label>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] border-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>ĐANG XÁC THỰC...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    <span>ĐĂNG NHẬP HỆ THỐNG</span>
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-center justify-between pt-4 border-t border-slate-900">
              <span className="text-xs font-mono text-slate-500">SYS_AUTH: SECURE</span>
              <Link
                href="/register"
                className="text-xs font-mono text-emerald-400 hover:underline hover:text-emerald-300"
              >
                &gt; CHƯA CÓ TÀI KHOẢN? ĐĂNG KÝ
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 font-mono lg:hidden">
            © {new Date().getFullYear()} PARKVISION. ALL INTENTIONS SECURED.
          </p>
        </div>
      </main>
    </div>
  )
}
