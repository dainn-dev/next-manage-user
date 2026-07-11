"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, RotateCcw } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AuthRecoveryShell } from "@/components/auth/auth-recovery-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api/auth-api"

const schema = z.object({
  password: z.string().min(8, "Mật khẩu cần có ít nhất 8 ký tự.").max(100, "Mật khẩu không được vượt quá 100 ký tự.").regex(/[A-Za-z]/, "Mật khẩu cần có ít nhất 1 chữ cái.").regex(/\d/, "Mật khẩu cần có ít nhất 1 chữ số."),
  confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Mật khẩu nhập lại chưa khớp.",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const [token] = useState(() => searchParams.get("token")?.trim() ?? "")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  useEffect(() => {
    if (token && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [token])

  const onSubmit = async ({ password }: FormValues) => {
    setFormError(null)
    try {
      await authApi.confirmPasswordReset(token, password)
      setIsComplete(true)
      requestAnimationFrame(() => headingRef.current?.focus())
    } catch {
      setFormError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.")
    }
  }

  if (!token) {
    return (
      <AuthRecoveryShell title="Liên kết không hợp lệ" description="Liên kết đặt lại mật khẩu bị thiếu, không hợp lệ hoặc đã hết hạn.">
        <section role="alert" className="space-y-5 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted-foreground">Vì lý do bảo mật, mỗi liên kết chỉ sử dụng được một lần và sẽ tự động hết hạn.</p>
          </div>
          <Button asChild className="min-h-11 w-full"><Link href="/forgot-password"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Yêu cầu liên kết mới</Link></Button>
        </section>
      </AuthRecoveryShell>
    )
  }

  return (
    <AuthRecoveryShell title="Đặt lại mật khẩu" description="Tạo mật khẩu mới để tiếp tục sử dụng ParkVision. Sau khi hoàn tất, các phiên đăng nhập cũ sẽ không còn hiệu lực.">
      {isComplete ? (
        <section aria-live="polite" className="space-y-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="space-y-2">
              <h2 ref={headingRef} tabIndex={-1} className="font-semibold text-foreground focus:outline-none">Mật khẩu đã được cập nhật</h2>
              <p className="text-sm leading-6 text-muted-foreground">Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
            </div>
          </div>
          <Button asChild className="min-h-11 w-full"><Link href="/login">Đi đến đăng nhập</Link></Button>
        </section>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {formError && (
            <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{formError}</span></div>
              <Link href="/forgot-password" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Yêu cầu liên kết mới</Link>
            </div>
          )}

          <PasswordField id="password" label="Mật khẩu mới" shown={showPassword} onToggle={() => setShowPassword((value) => !value)} disabled={isSubmitting} error={errors.password?.message} registration={register("password")} />
          <PasswordField id="confirmPassword" label="Xác nhận mật khẩu" shown={showConfirm} onToggle={() => setShowConfirm((value) => !value)} disabled={isSubmitting} error={errors.confirmPassword?.message} registration={register("confirmPassword")} />

          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
            <p className="text-xs leading-5 text-muted-foreground">Mật khẩu cần có 8–100 ký tự, gồm ít nhất một chữ cái và một chữ số.</p>
          </div>

          <Button type="submit" size="lg" className="min-h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Đang lưu mật khẩu...</> : <><KeyRound className="h-4 w-4" aria-hidden="true" /> Lưu mật khẩu mới</>}
          </Button>
        </form>
      )}
    </AuthRecoveryShell>
  )
}

function PasswordField({ id, label, shown, onToggle, disabled, error, registration }: {
  id: "password" | "confirmPassword"
  label: string
  shown: boolean
  onToggle: () => void
  disabled: boolean
  error?: string
  registration: ReturnType<typeof useForm<FormValues>>["register"] extends (name: typeof id) => infer Result ? Result : never
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={shown ? "text" : "password"} autoComplete="new-password" placeholder={id === "password" ? "Nhập mật khẩu mới" : "Nhập lại mật khẩu"} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="min-h-11 pr-11" {...registration} />
        <button type="button" onClick={onToggle} disabled={disabled} aria-label={shown ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
