"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Mail, Send, AlertCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthRecoveryShell } from "@/components/auth/auth-recovery-shell"
import { authApi } from "@/lib/api/auth-api"

const schema = z.object({
  email: z.string().trim().email("Vui lòng nhập email hợp lệ."),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isComplete, setIsComplete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } })

  const onSubmit = async ({ email }: FormValues) => {
    setFormError(null)
    try {
      await authApi.requestPasswordReset(email)
      setIsComplete(true)
      requestAnimationFrame(() => headingRef.current?.focus())
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.")
    }
  }

  return (
    <AuthRecoveryShell
      title="Quên mật khẩu?"
      description="Nhập email đã đăng ký. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu đến hộp thư của bạn."
    >
      {isComplete ? (
        <section aria-live="polite" className="space-y-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="space-y-2">
              <h2 ref={headingRef} tabIndex={-1} className="font-semibold text-foreground focus:outline-none">Kiểm tra hộp thư của bạn</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Nếu email khớp với tài khoản, hướng dẫn đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư mục Spam.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link href="/login">Quay lại đăng nhập</Link>
          </Button>
        </section>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email đăng ký</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : "email-help"}
                className="min-h-11 pl-10"
                {...register("email")}
              />
            </div>
            <p id="email-help" className="text-xs leading-5 text-muted-foreground">Chúng tôi không tiết lộ email có liên kết với tài khoản hay không.</p>
            {errors.email && <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <Button type="submit" size="lg" className="min-h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Đang gửi yêu cầu...</> : <><Send className="h-4 w-4" aria-hidden="true" /> Gửi liên kết đặt lại</>}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Nhớ mật khẩu rồi?{" "}
            <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Đăng nhập</Link>
          </p>
        </form>
      )}
    </AuthRecoveryShell>
  )
}
