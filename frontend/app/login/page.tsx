"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
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
import {
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  ScanLine,
  MapPin,
  BellRing,
  AlertCircle,
} from "lucide-react"

const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
})

type LoginFormValues = z.infer<typeof loginSchema>

const BRAND_FEATURES = [
  { icon: ScanLine, text: "Nhận diện biển số tự động" },
  { icon: MapPin, text: "Bản đồ ô đỗ thời gian thực" },
  { icon: BellRing, text: "Cảnh báo di dời phương tiện" },
] as const

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const router = useRouter()
  const { login, isAuthenticated, isLoading } = useAuth()
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
      router.replace("/employees")
    }
  }, [isLoading, isAuthenticated, router])

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      await login(values)
      toast({
        title: "Đăng nhập thành công",
        description: "Chào mừng bạn đến với ParkVision",
      })
      router.push("/employees")
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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Đang tải" />
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-accent p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="ParkVision"
            width={48}
            height={48}
            className="rounded-lg shadow-md"
            priority
          />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">ParkVision</p>
            <p className="text-sm text-primary-foreground/70">Smart Parking 4.0</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Một dashboard cho mọi bãi xe
            </h1>
            <p className="text-primary-foreground/80">
              Nền tảng quản lý bãi đỗ thông minh: nhận diện biển số, giám sát ô
              đỗ và cảnh báo di dời trong thời gian thực.
            </p>
          </div>

          <ul className="space-y-4">
            {BRAND_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} ParkVision. Hệ thống quản lý ra vào và
          phương tiện.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          {/* Mobile brand header (brand panel is hidden below lg) */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Image
              src="/logo.jpg"
              alt="ParkVision"
              width={72}
              height={72}
              className="rounded-xl shadow-md"
              priority
            />
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground">
                ParkVision
              </p>
              <p className="text-sm text-muted-foreground">Smart Parking 4.0</p>
            </div>
          </div>

          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Đăng nhập
            </h2>
            <p className="text-sm text-muted-foreground">
              Nhập thông tin tài khoản để truy cập hệ thống.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? "username-error" : undefined}
                {...register("username")}
              />
              {errors.username && (
                <p id="username-error" role="alert" className="text-sm text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" disabled={isSubmitting} />
                <Label
                  htmlFor="remember"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  Ghi nhớ đăng nhập
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="rounded-sm text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Đăng nhập</span>
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Đăng ký dùng thử
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} ParkVision · Hệ thống quản lý ra vào và
            phương tiện
          </p>
        </div>
      </main>
    </div>
  )
}
