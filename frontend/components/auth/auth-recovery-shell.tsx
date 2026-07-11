import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, Clock3, ShieldCheck } from "lucide-react"

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Liên kết bảo mật chỉ sử dụng được một lần" },
  { icon: Clock3, text: "Tự động hết hạn sau thời gian ngắn" },
  { icon: BadgeCheck, text: "Mọi phiên đăng nhập cũ sẽ bị vô hiệu hóa" },
] as const

export function AuthRecoveryShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-accent p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Image src="/logo.jpg" alt="ParkVision" width={48} height={48} className="rounded-lg shadow-md" priority />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">ParkVision</p>
            <p className="text-sm text-primary-foreground/70">Smart Parking 4.0</p>
          </div>
        </Link>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">Khôi phục truy cập an toàn</h1>
            <p className="text-primary-foreground/80">
              Quy trình xác minh đơn giản giúp bạn quay lại hệ thống mà không làm lộ thông tin tài khoản.
            </p>
          </div>
          <ul className="space-y-4">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">© {new Date().getFullYear()} ParkVision · Hệ thống quản lý phương tiện</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <Image src="/logo.jpg" alt="ParkVision" width={72} height={72} className="rounded-xl shadow-md" priority />
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground">ParkVision</p>
              <p className="text-sm text-muted-foreground">Smart Parking 4.0</p>
            </div>
          </div>

          <Link
            href="/login"
            className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Về trang đăng nhập
          </Link>

          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          {children}

          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} ParkVision · Hệ thống quản lý ra vào và phương tiện
          </p>
        </div>
      </main>
    </div>
  )
}
