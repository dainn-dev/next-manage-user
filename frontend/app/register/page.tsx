"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Factory,
  GraduationCap,
  Hospital,
  House,
  LockKeyhole,
  MapPinned,
  ParkingCircle,
  Plane,
  ShoppingCart,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const MANAGEMENT_MODELS = [
  {
    value: "boarding-house",
    label: "Phòng trọ",
    description: "Nhà trọ, chung cư mini hoặc khu lưu trú.",
    icon: House,
  },
  {
    value: "school",
    label: "Trường học",
    description: "Campus, trường học hoặc cơ sở đào tạo.",
    icon: GraduationCap,
  },
  {
    value: "retail",
    label: "Siêu thị",
    description: "Siêu thị, trung tâm thương mại hoặc chuỗi bán lẻ.",
    icon: ShoppingCart,
  },
  {
    value: "airport",
    label: "Sân bay",
    description: "Sân bay, nhà ga hoặc khu trung chuyển.",
    icon: Plane,
  },
  {
    value: "hospital",
    label: "Bệnh viện",
    description: "Bệnh viện, phòng khám hoặc cơ sở y tế.",
    icon: Hospital,
  },
  {
    value: "industrial-park",
    label: "Khu công nghiệp",
    description: "Nhà máy, khu công nghiệp hoặc kho vận.",
    icon: Factory,
  },
  {
    value: "other",
    label: "Mô hình khác",
    description: "Tòa nhà, văn phòng hoặc mô hình riêng của bạn.",
    icon: Building2,
  },
] as const

const MANAGEMENT_MODEL_VALUES = MANAGEMENT_MODELS.map((model) => model.value) as [
  (typeof MANAGEMENT_MODELS)[number]["value"],
  ...(typeof MANAGEMENT_MODELS)[number]["value"][],
]

const registerFieldsSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Tên tổ chức cần có ít nhất 2 ký tự.")
    .max(80, "Tên tổ chức không nên vượt quá 80 ký tự."),
  managementModel: z.enum(MANAGEMENT_MODEL_VALUES, {
    required_error: "Vui lòng chọn mô hình quản lý.",
  }),
  areaCount: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số bãi hoặc khu vực cần quản lý.")
    .refine(
      (value) => {
        const amount = Number(value)
        return Number.isInteger(amount) && amount >= 1 && amount <= 999
      },
      "Số lượng phải là số nguyên từ 1 đến 999.",
    ),
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._-]{3,32}$/,
      "Tên đăng nhập gồm 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.",
    ),
  password: z
    .string()
    .min(8, "Mật khẩu cần có ít nhất 8 ký tự.")
    .regex(/[A-Za-z]/, "Mật khẩu cần có ít nhất 1 chữ cái.")
    .regex(/\d/, "Mật khẩu cần có ít nhất 1 chữ số."),
  confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
})

const registerSchema = registerFieldsSchema.refine(
  (values) => values.password === values.confirmPassword,
  {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  },
)

const STEP_SCHEMAS = [
  registerFieldsSchema.pick({ organizationName: true }),
  registerFieldsSchema.pick({ managementModel: true }),
  registerFieldsSchema.pick({ areaCount: true }),
  registerFieldsSchema
    .pick({ username: true, password: true, confirmPassword: true })
    .refine((values) => values.password === values.confirmPassword, {
      message: "Mật khẩu nhập lại chưa khớp.",
      path: ["confirmPassword"],
    }),
] as const

type RegisterFormValues = z.infer<typeof registerSchema>
type ManagementModel = RegisterFormValues["managementModel"]

const STEPS = [
  { title: "Tổ chức", description: "Cho chúng tôi biết đơn vị của bạn" },
  { title: "Mô hình", description: "Chọn không gian bạn quản lý" },
  { title: "Quy mô", description: "Số bãi hoặc khu vực" },
  { title: "Tài khoản", description: "Tạo tài khoản quản trị" },
] as const

const STEP_FIELDS = [
  ["organizationName"],
  ["managementModel"],
  ["areaCount"],
  ["username", "password", "confirmPassword"],
] as const satisfies readonly (readonly (keyof RegisterFormValues)[])[]

const TRUST_POINTS = [
  "Thiết lập cho nhiều bãi và khu vực trong một nơi.",
  "Phù hợp từ nhà trọ đến campus, siêu thị và sân bay.",
  "Sẵn sàng mở rộng khi nhu cầu vận hành tăng lên.",
] as const

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null

  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [attemptedSteps, setAttemptedSteps] = useState<Set<number>>(new Set())
  const [isComplete, setIsComplete] = useState(false)
  const stepTitleRef = useRef<HTMLHeadingElement>(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      organizationName: "",
      managementModel: undefined,
      areaCount: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  })

  const selectedModel = watch("managementModel")
  const showOrganizationError = attemptedSteps.has(0)
  const showModelError = attemptedSteps.has(1)
  const showAreaError = attemptedSteps.has(2)
  const showAccountErrors = attemptedSteps.has(3)

  useEffect(() => {
    clearErrors()
    if (currentStep > 0) {
      stepTitleRef.current?.focus()
    }
  }, [clearErrors, currentStep])

  const goToNextStep = () => {
    const stepFields = STEP_FIELDS[currentStep]
    const validation = STEP_SCHEMAS[currentStep].safeParse(getValues())

    if (!validation.success) {
      clearErrors(stepFields)
      setAttemptedSteps((steps) => new Set(steps).add(currentStep))
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as keyof RegisterFormValues, {
            type: "manual",
            message: issue.message,
          })
        }
      })
      return
    }

    clearErrors()
    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1))
  }

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  const onSubmit = () => {
    setIsComplete(true)
    toast({
      title: "Thông tin đăng ký đã sẵn sàng",
      description: "Bạn có thể kiểm tra lại hoặc tiếp tục đến trang đăng nhập.",
    })
  }

  if (isComplete) {
    return (
      <div className="grid min-h-dvh bg-background lg:grid-cols-2">
        <BrandPanel />
        <main className="flex items-center justify-center px-4 py-10 sm:px-6">
          <section
            aria-labelledby="register-complete-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card/90 p-6 shadow-xl shadow-primary/10 backdrop-blur-xl sm:p-8"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-primary">
              Hoàn tất thông tin
            </p>
            <h1 id="register-complete-title" className="mt-2 text-3xl font-bold tracking-tight">
              Sẵn sàng để thiết lập không gian quản lý của bạn
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Thông tin tổ chức, mô hình vận hành và tài khoản quản trị đã được kiểm tra.
              Tính năng tạo tài khoản trực tiếp sẽ được kết nối khi API đăng ký công khai
              sẵn sàng.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 flex-1">
                <Link href="/login">Về trang đăng nhập</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => {
                  setIsComplete(false)
                  setCurrentStep(STEPS.length - 1)
                }}
              >
                Chỉnh sửa thông tin
              </Button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <BrandPanel />

      <main className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <section className="w-full max-w-2xl" aria-labelledby="register-title">
          <MobileBrand />

          <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-xl shadow-primary/10 backdrop-blur-xl sm:p-8">
            <div className="mb-8">
              <p className="text-sm font-semibold text-primary">Thiết lập ParkVision</p>
              <h1 id="register-title" className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                Tạo không gian quản lý của bạn
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Chỉ mất khoảng 2 phút để cá nhân hóa hệ thống theo mô hình vận hành của bạn.
              </p>
            </div>

            <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Tiến trình đăng ký">
              {STEPS.map((step, index) => {
                const isActive = index === currentStep
                const isDone = index < currentStep

                return (
                  <li
                    key={step.title}
                    aria-current={isActive ? "step" : undefined}
                    className="min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors motion-reduce:transition-none",
                          isDone && "border-primary bg-primary text-primary-foreground",
                          isActive && "border-primary bg-primary/10 text-primary",
                          !isDone && !isActive && "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {isDone ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-px min-w-0 flex-1 bg-border",
                            isDone && "bg-primary",
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-2 truncate text-xs font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                  </li>
                )
              })}
            </ol>

            <div
              className="mb-8 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Tiến độ đăng ký"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={currentStep + 1}
              aria-valuetext={`Bước ${currentStep + 1} trên ${STEPS.length}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none"
                style={{ transform: `scaleX(${(currentStep + 1) / STEPS.length})`, transformOrigin: "left" }}
              />
            </div>

            <form
              onSubmit={handleSubmit(onSubmit, () =>
                setAttemptedSteps((steps) => new Set(steps).add(STEPS.length - 1)),
              )}
              noValidate
            >
              <div className="min-h-[296px]">
                <p className="text-sm font-medium text-primary">
                  Bước {currentStep + 1} / {STEPS.length}
                </p>
                <h2
                  ref={stepTitleRef}
                  tabIndex={-1}
                  className="mt-1 text-2xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STEPS[currentStep].title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {STEPS[currentStep].description}
                </p>

                {currentStep === 0 && (
                  <div className="mt-7 space-y-2">
                    <Label htmlFor="organizationName">Tên tổ chức / nhà trọ</Label>
                    <Input
                      id="organizationName"
                      autoFocus
                      autoComplete="organization"
                      placeholder="VD: Nhà trọ An Bình, Trường THPT Minh Khai"
                      className="h-11"
                      aria-invalid={showOrganizationError && Boolean(errors.organizationName)}
                      aria-describedby={
                        showOrganizationError && errors.organizationName
                          ? "organizationName-error"
                          : "organizationName-help"
                      }
                      {...register("organizationName")}
                    />
                    <p id="organizationName-help" className="text-sm text-muted-foreground">
                      Tên này sẽ giúp nhận diện không gian quản lý của bạn.
                    </p>
                    <FieldError
                      id="organizationName-error"
                      message={showOrganizationError ? errors.organizationName?.message : undefined}
                    />
                  </div>
                )}

                {currentStep === 1 && (
                  <fieldset className="mt-7">
                    <legend className="sr-only">Chọn mô hình quản lý</legend>
                    <RadioGroup
                      value={selectedModel}
                      onValueChange={(value) => {
                        setValue("managementModel", value as ManagementModel, {
                          shouldDirty: true,
                        })
                        clearErrors("managementModel")
                      }}
                      aria-invalid={showModelError && Boolean(errors.managementModel)}
                      aria-describedby={
                        showModelError && errors.managementModel
                          ? "managementModel-error"
                          : undefined
                      }
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {MANAGEMENT_MODELS.map((model) => {
                        const Icon = model.icon
                        const isSelected = selectedModel === model.value
                        const optionId = `management-model-${model.value}`

                        return (
                          <div
                            key={model.value}
                            className={cn(
                              "flex min-h-24 items-start gap-3 rounded-xl border p-3 transition-colors motion-reduce:transition-none",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border bg-background hover:border-primary/40",
                            )}
                          >
                            <RadioGroupItem
                              id={optionId}
                              value={model.value}
                              className="mt-1 size-5"
                            />
                            <Label htmlFor={optionId} className="flex flex-1 cursor-pointer items-start gap-3 leading-normal">
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                )}
                              >
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold text-foreground">
                                  {model.label}
                                </span>
                                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                  {model.description}
                                </span>
                              </span>
                            </Label>
                          </div>
                        )
                      })}
                    </RadioGroup>
                    <FieldError
                      id="managementModel-error"
                      message={showModelError ? errors.managementModel?.message : undefined}
                    />
                  </fieldset>
                )}

                {currentStep === 2 && (
                  <div className="mt-7 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="areaCount">Số bãi / khu vực cần quản lý</Label>
                      <Input
                        id="areaCount"
                        type="number"
                        min="1"
                        max="999"
                        step="1"
                        inputMode="numeric"
                        placeholder="VD: 3"
                        className="h-11"
                        aria-invalid={showAreaError && Boolean(errors.areaCount)}
                        aria-describedby={
                          showAreaError && errors.areaCount ? "areaCount-error" : "areaCount-help"
                        }
                        {...register("areaCount")}
                      />
                      <p id="areaCount-help" className="text-sm text-muted-foreground">
                        Có thể là số bãi xe, khu vực, cổng hoặc site bạn cần theo dõi.
                      </p>
                      <FieldError
                        id="areaCount-error"
                        message={showAreaError ? errors.areaCount?.message : undefined}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label="Gợi ý số lượng khu vực">
                      {["1", "2", "3", "5", "10"].map((count) => (
                        <Button
                          key={count}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 min-w-11"
                          onClick={() => {
                            setValue("areaCount", count, { shouldDirty: true })
                            clearErrors("areaCount")
                          }}
                        >
                          {count}{count === "10" ? "+" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="mt-7 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username">Tên đăng nhập</Label>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="username"
                          autoComplete="username"
                          placeholder="VD: anbinh.admin"
                          className="h-11 pl-10"
                          aria-invalid={showAccountErrors && Boolean(errors.username)}
                          aria-describedby={
                            showAccountErrors && errors.username ? "username-error" : "username-help"
                          }
                          {...register("username")}
                        />
                      </div>
                      <p id="username-help" className="text-sm text-muted-foreground">
                        Dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.
                      </p>
                      <FieldError
                        id="username-error"
                        message={showAccountErrors ? errors.username?.message : undefined}
                      />
                    </div>

                    <PasswordField
                      id="password"
                      label="Mật khẩu"
                      placeholder="Tạo mật khẩu mạnh"
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onToggle={() => setShowPassword((value) => !value)}
                      error={showAccountErrors ? errors.password?.message : undefined}
                      helperText="Tối thiểu 8 ký tự, có ít nhất 1 chữ cái và 1 chữ số."
                      registration={register("password")}
                    />

                    <PasswordField
                      id="confirmPassword"
                      label="Nhập lại mật khẩu"
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
                      showPassword={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword((value) => !value)}
                      error={showAccountErrors ? errors.confirmPassword?.message : undefined}
                      registration={register("confirmPassword")}
                    />
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 sm:min-w-28"
                  onClick={goToPreviousStep}
                  disabled={currentStep === 0 || isSubmitting}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Quay lại
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button type="button" className="h-11 sm:min-w-36" onClick={goToNextStep}>
                    Tiếp tục
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="submit" className="h-11 sm:min-w-52" disabled={isSubmitting}>
                    <LockKeyhole className="size-4" aria-hidden="true" />
                    Hoàn tất đăng ký
                  </Button>
                )}
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Đăng nhập
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}

function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  showPassword,
  onToggle,
  error,
  helperText,
  registration,
}: {
  id: "password" | "confirmPassword"
  label: string
  placeholder: string
  autoComplete: string
  showPassword: boolean
  onToggle: () => void
  error?: string
  helperText?: string
  registration: ReturnType<typeof useForm<RegisterFormValues>>["register"] extends (
    name: typeof id,
  ) => infer Result
    ? Result
    : never
}) {
  const errorId = `${id}-error`
  const helperId = `${id}-help`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-11 pl-10 pr-11"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          {...registration}
        />
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <button
          type="button"
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={showPassword ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          onClick={onToggle}
        >
          {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {helperText && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-accent p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl"
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
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            <ParkingCircle className="size-3.5" aria-hidden="true" />
            Onboarding theo mô hình của bạn
          </span>
          <h2 className="text-4xl font-bold tracking-tight text-balance">
            Một hệ thống phù hợp với từng không gian đỗ xe.
          </h2>
          <p className="leading-relaxed text-primary-foreground/80">
            Từ một nhà trọ đến chuỗi bãi xe nhiều site, ParkVision giúp bạn có một
            điểm nhìn thống nhất cho vận hành hằng ngày.
          </p>
        </div>

        <ul className="space-y-4">
          {TRUST_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Check className="size-3" aria-hidden="true" />
              </span>
              <span className="leading-relaxed text-primary-foreground/90">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} ParkVision. Hệ thống quản lý ra vào và phương tiện.
      </p>
    </aside>
  )
}

function MobileBrand() {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <MapPinned className="size-7" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xl font-bold tracking-tight text-foreground">ParkVision</p>
        <p className="text-sm text-muted-foreground">Smart Parking 4.0</p>
      </div>
    </div>
  )
}
