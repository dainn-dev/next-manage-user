import { Suspense } from "react"
import ResetPasswordForm from "./reset-password-form"

function LoadingState() {
  return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">Đang tải...</div>
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
