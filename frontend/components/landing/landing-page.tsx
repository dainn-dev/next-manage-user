"use client"

import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  MapPin,
  Menu,
  MoveRight,
  ParkingCircle,
  Radar,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "#features", label: "Tính năng" },
  { href: "#how-it-works", label: "Cách hoạt động" },
  { href: "#pricing", label: "Bảng giá" },
]

const PROBLEMS = [
  {
    title: "Không thấy toàn hệ thống",
    body: "Mỗi bãi xe vận hành rời rạc — HQ không có dashboard realtime cho 10–50 site.",
  },
  {
    title: "Chỉ biết xe vào/ra",
    body: "Log cổng ghi timestamp, không biết xe đang ở ô nào trong bãi.",
  },
  {
    title: "Xe bị di chuyển?",
    body: "Staff hoặc tài xế dời xe — không có event Relocation, không ai được báo.",
  },
  {
    title: "Hỗ trợ thủ công",
    body: "“Xe tôi ở đâu?” phải gọi bảo vệ hoặc lật log — không có self-service.",
  },
]

const FEATURES = [
  {
    icon: Camera,
    title: "AI nhận diện biển số",
    body: "YOLOv11 + PaddleOCR: phát hiện xe, crop biển, OCR độ tin cậy cao cho biển VN.",
  },
  {
    icon: Radar,
    title: "Tracking thời gian thực",
    body: "ByteTrack gắn track_id ổn định qua từng frame — nền tảng cho relocation.",
  },
  {
    icon: ParkingCircle,
    title: "Bản đồ ô đỗ (Slot mapping)",
    body: "Polygon từng slot, point-in-polygon → biết chính xác xe đang ở A12 hay B03.",
  },
  {
    icon: MapPin,
    title: "Phát hiện relocation",
    body: "Cùng track_id nhưng đổi slot → VehicleRelocated, snapshot + alert tức thì.",
  },
  {
    icon: Bot,
    title: "AI Chatbot",
    body: "Tool-calling: getVehicleLocation, getHistory, getSnapshot, getParkingStatus.",
  },
  {
    icon: Zap,
    title: "Dashboard realtime",
    body: "Live map, occupancy, timeline sự kiện qua STOMP/WebSocket — cập nhật < 2s.",
  },
]

const PIPELINE = [
  { step: "01", title: "Motion", desc: "OpenCV MOG2 chỉ kích hoạt AI khi có chuyển động" },
  { step: "02", title: "Detect", desc: "YOLOv11 phát hiện xe / mô tô trong khung hình" },
  { step: "03", title: "OCR", desc: "YOLO plate + PaddleOCR đọc biển số" },
  { step: "04", title: "Track", desc: "ByteTrack giữ track_id ổn định" },
  { step: "05", title: "Map", desc: "Center-in-polygon → ParkingSlot hiện tại" },
  { step: "06", title: "Event", desc: "Event bus → DB, dashboard, notify, chatbot" },
]

const PLANS = [
  {
    name: "Free",
    price: "0₫",
    period: "dùng thử",
    blurb: "POC / đánh giá 1 site",
    sites: "1 site",
    cameras: "2 camera",
    retention: "7 ngày",
    chatbot: false,
    cta: "Bắt đầu miễn phí",
    featured: false,
  },
  {
    name: "Starter",
    price: "Liên hệ",
    period: "/tháng",
    blurb: "Chuỗi nhỏ 1–3 bãi",
    sites: "Tối đa 3 site",
    cameras: "Tối đa 10 camera",
    retention: "30 ngày",
    chatbot: false,
    cta: "Chọn Starter",
    featured: false,
  },
  {
    name: "Pro",
    price: "Liên hệ",
    period: "/tháng",
    blurb: "Chuỗi vừa — multi-site ops",
    sites: "Tối đa 15 site",
    cameras: "Tối đa 60 camera",
    retention: "90 ngày",
    chatbot: true,
    cta: "Chọn Pro",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "SLA",
    blurb: "Chuỗi lớn, SLA & tool riêng",
    sites: "Không giới hạn",
    cameras: "Không giới hạn",
    retention: "Tùy chỉnh",
    chatbot: true,
    cta: "Liên hệ sales",
    featured: false,
  },
]

const STATS = [
  { value: "≥97%", label: "Độ chính xác biển số (điều kiện tốt)" },
  { value: "<30s", label: "Latency phát hiện relocation (p95)" },
  { value: "<2s", label: "Event → dashboard (p95)" },
  { value: "100%", label: "Edge offline — zero data loss" },
]

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5 cursor-pointer">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ParkingCircle className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Park<span className="text-primary">Vision</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Điều hướng chính">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground cursor-pointer"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Dùng thử
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Menu mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link href="/register">Dùng thử</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -20%, color-mix(in oklab, var(--primary) 18%, transparent), transparent), radial-gradient(ellipse 50% 40% at 90% 20%, color-mix(in oklab, var(--accent) 12%, transparent), transparent)",
            }}
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <Sparkles className="size-3.5 text-primary" aria-hidden />
                Smart Parking 4.0 · Multi-tenant SaaS
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Một nền tảng.{" "}
                <span className="text-primary">Mọi bãi xe.</span>{" "}
                Xe luôn được định vị.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                ParkVision giúp chuỗi siêu thị và campus vận hành nhiều bãi đỗ:
                nhận diện biển số, map ô đỗ, phát hiện xe bị di chuyển, và chatbot
                trả lời “xe tôi đang ở đâu?” — một đăng nhập, một dashboard, một hóa đơn.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-11 px-6 text-base cursor-pointer" asChild>
                  <Link href="/register">
                    Bắt đầu miễn phí
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 text-base cursor-pointer"
                  asChild
                >
                  <a href="#how-it-works">Xem pipeline AI</a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Free: 1 site · 2 camera · 7 ngày retention · không cần thẻ
              </p>
            </div>

            {/* Hero product mock */}
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card/60 p-2 shadow-xl shadow-primary/5 backdrop-blur-sm">
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <span className="size-2.5 rounded-full bg-destructive/80" />
                    <span className="size-2.5 rounded-full bg-chart-4/80" />
                    <span className="size-2.5 rounded-full bg-chart-3/80" />
                    <span className="ml-2 text-xs text-muted-foreground">
                      Live occupancy · Site Q1
                    </span>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-5">
                    <div className="space-y-3 sm:col-span-3">
                      <div className="grid grid-cols-4 gap-2">
                        {["A01", "A02", "A03", "A04", "B01", "B02", "B03", "B04"].map(
                          (slot, i) => {
                            const occupied = [0, 2, 3, 5, 7].includes(i)
                            return (
                              <div
                                key={slot}
                                className={cn(
                                  "flex aspect-[4/3] flex-col items-center justify-center rounded-lg border text-[10px] font-medium transition-colors",
                                  occupied
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-border bg-muted/50 text-muted-foreground",
                                )}
                              >
                                <span>{slot}</span>
                                <span className="mt-0.5 opacity-70">
                                  {occupied ? "Occupied" : "Free"}
                                </span>
                              </div>
                            )
                          },
                        )}
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">51A-12345</span>
                        {" · "}ô <span className="text-primary font-medium">B02</span>
                        {" · "}cập nhật 09:35
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Hôm nay
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                          128
                        </p>
                        <p className="text-xs text-muted-foreground">lượt vào</p>
                      </div>
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                          Relocation
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          3 cảnh báo
                        </p>
                        <p className="text-xs text-muted-foreground">p95 &lt; 30s</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-start gap-2">
                          <Bot className="mt-0.5 size-3.5 shrink-0 text-accent" />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            “Xe 51A-12345 đang ở{" "}
                            <span className="font-medium text-foreground">B02</span>.
                            Ảnh mới nhất 09:35.”
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                aria-hidden
                className="absolute -bottom-4 -right-4 -z-10 size-40 rounded-full bg-accent/10 blur-3xl"
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center lg:text-left">
                <p className="text-2xl font-bold tabular-nums text-primary sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Problems */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Vấn đề
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Vận hành nhiều bãi xe vẫn đang thủ công
            </h2>
            <p className="mt-3 text-muted-foreground">
              ParkVision giải quyết 4 pain point cốt lõi của operator multi-site
              (docs/00_Vision).
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p, i) => (
              <article
                key={p.title}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <span className="text-xs font-semibold tabular-nums text-primary">
                  0{i + 1}
                </span>
                <h3 className="mt-2 text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Tính năng MVP
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Từ camera đến vị trí xe — end-to-end
              </h2>
              <p className="mt-3 text-muted-foreground">
                Theo Smart Parking 4.0 Project Plan: AI Core → Smart Parking →
                Dashboard → Chatbot → Notification.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="group rounded-xl border border-border bg-background p-6 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Pipeline
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                AI pipeline 6 bước
              </h2>
              <p className="mt-3 text-muted-foreground">
                Motion-gated inference: tiết kiệm compute, vẫn bắt mọi xe di chuyển.
              </p>
            </div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((step, idx) => (
                <li
                  key={step.step}
                  className="relative flex gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground tabular-nums">
                    {step.step}
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                    {idx < PIPELINE.length - 1 && (
                      <MoveRight
                        className="absolute right-3 top-1/2 hidden size-4 -translate-y-1/2 text-border lg:block xl:right-[-0.75rem] xl:text-muted-foreground/50"
                        aria-hidden
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Subscription
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Gói theo quy mô, không khóa tính năng
              </h2>
              <p className="mt-3 text-muted-foreground">
                Mọi tenant dùng full product; plan khác nhau ở số site, camera,
                retention và AI usage (docs/00_Vision §8).
              </p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md",
                    plan.featured
                      ? "border-primary ring-2 ring-primary/20 lg:-mt-2 lg:mb-0 lg:shadow-lg"
                      : "border-border",
                  )}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      Phổ biến
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {[
                      plan.sites,
                      plan.cameras,
                      `Retention ${plan.retention}`,
                      plan.chatbot ? "Chatbot AI" : "Không gồm chatbot",
                      "Dashboard realtime",
                      "Snapshot & history",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            item.startsWith("Không")
                              ? "text-muted-foreground"
                              : "text-primary",
                          )}
                          aria-hidden
                        />
                        <span
                          className={
                            item.startsWith("Không")
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full cursor-pointer"
                    variant={plan.featured ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Personas */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Ai dùng ParkVision?
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  title: "Tenant ops lead",
                  body: "Một dashboard realtime mọi site — occupancy, in/out, relocation, exception.",
                },
                {
                  title: "Site manager / Guard",
                  body: "Kiosk cổng như hiện tại + live parking map thay cho log thô.",
                },
                {
                  title: "Tài xế (Member)",
                  body: "Self-service “where is my car” qua chatbot — không gọi lễ tân.",
                },
              ].map((p) => (
                <article
                  key={p.title}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-primary"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at 20% 50%, white 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, color-mix(in oklab, var(--accent) 80%, white) 0%, transparent 45%)",
            }}
          />
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground text-balance sm:text-4xl">
              Sẵn sàng biến camera thành bản đồ đỗ xe sống?
            </h2>
            <p className="mt-4 text-primary-foreground/85">
              Onboard site đầu tiên trong một ngày làm việc — calibrate camera,
              map slots, xem occupancy realtime.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-11 bg-background px-6 text-base text-foreground hover:bg-background/90 cursor-pointer"
                asChild
              >
                <Link href="/login">
                  Vào dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-primary-foreground/30 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground cursor-pointer"
                asChild
              >
                <a href="#pricing">Xem bảng giá</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ParkingCircle className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">
                Park<span className="text-primary">Vision</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Smart Parking 4.0 · Vision License Plate evolved
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="hover:text-foreground transition-colors cursor-pointer">
              Đăng nhập
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ParkVision. MVP plan: docs/
          </p>
        </div>
      </footer>
    </div>
  )
}
