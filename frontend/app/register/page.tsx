"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
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
  Cpu,
  Terminal,
  Activity,
  Car,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { RegistrationApiError, registrationApi } from "@/lib/api/registration-api"
import { useAuth } from "@/lib/auth-context"
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

const TENANT_STEPS = [
  { title: "Tổ chức", description: "Cung cấp tên đơn vị của bạn" },
  { title: "Mô hình", description: "Chọn không gian bạn quản lý" },
  { title: "Quy mô", description: "Số bãi hoặc khu vực" },
  { title: "Tài khoản", description: "Tạo tài khoản quản trị" },
] as const

const MEMBER_STEPS = [
  { title: "Tài khoản", description: "Thiết lập thông tin đăng nhập" },
  { title: "Phương tiện", description: "Đăng ký xe cá nhân" },
  { title: "Liên kết", description: "Nhập mã bãi xe của bạn (nếu có)" },
] as const

// Form Schemas for validation
const TENANT_STEP_SCHEMAS = [
  z.object({
    organizationName: z
      .string()
      .trim()
      .min(2, "Tên tổ chức cần có ít nhất 2 ký tự.")
      .max(80, "Tên tổ chức không nên vượt quá 80 ký tự."),
  }),
  z.object({
    managementModel: z.enum(MANAGEMENT_MODEL_VALUES, {
      required_error: "Vui lòng chọn mô hình quản lý.",
    }),
  }),
  z.object({
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
  }),
  z.object({
    email: z
      .string()
      .trim()
      .email("Vui lòng nhập email hợp lệ.")
      .max(255, "Email không được vượt quá 255 ký tự."),
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
      .max(100, "Mật khẩu không được vượt quá 100 ký tự.")
      .regex(/[A-Za-z]/, "Mật khẩu cần có ít nhất 1 chữ cái.")
      .regex(/\d/, "Mật khẩu cần có nhất 1 chữ số."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
  }).refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  }),
]

const MEMBER_STEP_SCHEMAS = [
  z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Họ và tên cần có ít nhất 2 ký tự.")
      .max(100, "Họ và tên không quá 100 ký tự."),
    email: z
      .string()
      .trim()
      .email("Vui lòng nhập email hợp lệ.")
      .max(255),
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
      .max(100, "Mật khẩu không được vượt quá 100 ký tự.")
      .regex(/[A-Za-z]/, "Mật khẩu cần có ít nhất 1 chữ cái.")
      .regex(/\d/, "Mật khẩu cần có ít nhất 1 chữ số."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
  }).refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  }),
  z.object({
    licensePlate: z
      .string()
      .trim()
      .min(4, "Biển số xe cần có ít nhất 4 ký tự.")
      .regex(/^[0-9A-Za-z._-]{4,15}$/i, "Biển số chỉ gồm chữ cái, số, dấu gạch ngang, gạch dưới hoặc chấm."),
    vehicleType: z.enum(["car", "motorbike", "truck", "bus"], {
      required_error: "Vui lòng chọn loại xe.",
    }),
    brand: z.string().trim().optional(),
    model: z.string().trim().optional(),
  }),
  z.object({
    joinCode: z.string().trim().optional(),
  }),
]

const registerFieldsSchema = z.object({
  userType: z.enum(["TENANT", "MEMBER"]),
  organizationName: z.string().trim().optional(),
  managementModel: z.enum(MANAGEMENT_MODEL_VALUES).optional(),
  areaCount: z.string().trim().optional(),
  email: z.string().trim().email("Vui lòng nhập email hợp lệ.").max(255),
  username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,32}$/, "Tên đăng nhập không hợp lệ."),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự.").regex(/[A-Za-z]/).regex(/\d/),
  confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
  
  // Member fields
  fullName: z.string().trim().optional(),
  licensePlate: z.string().trim().optional(),
  vehicleType: z.enum(["car", "motorbike", "truck", "bus"]).optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  joinCode: z.string().trim().optional(),
})

const registerSchema = registerFieldsSchema.refine(
  (values) => values.password === values.confirmPassword,
  {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  },
)

type RegisterFormValues = z.infer<typeof registerSchema>
type ManagementModel = (typeof MANAGEMENT_MODELS)[number]["value"]

const SERVER_FIELD_MAP: Partial<Record<string, keyof RegisterFormValues>> = {
  organizationName: "organizationName",
  managementModel: "managementModel",
  areaCount: "areaCount",
  username: "username",
  email: "email",
  password: "password",
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null

  return (
    <p id={id} role="alert" className="text-xs text-red-400 mt-1 font-mono">
      ● {message}
    </p>
  )
}

export default function RegisterPage() {
  const [roleSelected, setRoleSelected] = useState(false)
  const [userType, setUserType] = useState<"TENANT" | "MEMBER">("MEMBER")
  const [currentStep, setCurrentStep] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [attemptedSteps, setAttemptedSteps] = useState<Set<number>>(new Set())
  const [formError, setFormError] = useState<string | null>(null)
  const stepTitleRef = useRef<HTMLHeadingElement>(null)
  const router = useRouter()
  const { adoptSession } = useAuth()
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
      userType: "MEMBER",
      organizationName: "",
      managementModel: undefined,
      areaCount: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      licensePlate: "",
      vehicleType: "car",
      brand: "",
      model: "",
      joinCode: "",
    },
  })

  const selectedModel = watch("managementModel")
  const selectedVehicleType = watch("vehicleType")

  const STEPS = userType === "TENANT" ? TENANT_STEPS : MEMBER_STEPS

  useEffect(() => {
    clearErrors()
    if (currentStep > 0) {
      stepTitleRef.current?.focus()
    }
  }, [clearErrors, currentStep])

  const selectRole = (type: "TENANT" | "MEMBER") => {
    setUserType(type)
    setValue("userType", type)
    setRoleSelected(true)
    setCurrentStep(0)
    setAttemptedSteps(new Set())
    setFormError(null)
  }

  const goToNextStep = () => {
    const isTenant = userType === "TENANT"
    const currentSchemas = isTenant ? TENANT_STEP_SCHEMAS : MEMBER_STEP_SCHEMAS
    const schema = currentSchemas[currentStep]

    const fieldsToValidate = isTenant
      ? currentStep === 0
        ? ["organizationName"]
        : currentStep === 1
        ? ["managementModel"]
        : currentStep === 2
        ? ["areaCount"]
        : ["email", "username", "password", "confirmPassword"]
      : currentStep === 0
      ? ["fullName", "email", "username", "password", "confirmPassword"]
      : currentStep === 1
      ? ["licensePlate", "vehicleType", "brand", "model"]
      : ["joinCode"]

    const validation = schema.safeParse(getValues())

    if (!validation.success) {
      clearErrors(fieldsToValidate as any)
      setAttemptedSteps((steps) => new Set(steps).add(currentStep))
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as any, {
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
    if (currentStep === 0) {
      setRoleSelected(false)
    } else {
      setCurrentStep((step) => Math.max(step - 1, 0))
    }
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null)

    if (userType === "TENANT") {
      try {
        const response = await registrationApi.register({
          organizationName: values.organizationName || "",
          managementModel: values.managementModel || "other",
          areaCount: Number(values.areaCount || 1),
          username: values.username,
          email: values.email,
          password: values.password,
        })

        await adoptSession(response.token)
        toast({
          title: "Đăng ký thành công",
          description: `Tổ chức ${response.tenantName} đã được thiết lập thành công.`,
        })
        router.replace("/")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể hoàn tất đăng ký"
        setFormError(message)

        if (error instanceof RegistrationApiError && error.fieldErrors) {
          Object.entries(error.fieldErrors).forEach(([field, fieldMessage]) => {
            const formField = SERVER_FIELD_MAP[field]
            if (formField) {
              setError(formField, { type: "server", message: fieldMessage })
            }
          })
        }

        toast({
          title: "Đăng ký thất bại",
          description: message,
          variant: "destructive",
        })
      }
    } else {
      // MEMBER Registration Flow
      try {
        const mockUser = {
          id: "member-" + Date.now(),
          username: values.username,
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          licensePlate: values.licensePlate,
          vehicleType: values.vehicleType,
          brand: values.brand,
          model: values.model,
          joinCode: values.joinCode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // Save to localStorage list of mock registered users
        const mockUsersStr = typeof window !== "undefined" ? localStorage.getItem("mock_registered_users") || "[]" : "[]"
        let mockUsers = []
        try {
          mockUsers = JSON.parse(mockUsersStr)
        } catch (e) {
          mockUsers = []
        }
        mockUsers.push(mockUser)
        if (typeof window !== "undefined") {
          localStorage.setItem("mock_registered_users", JSON.stringify(mockUsers))

          // Log them in immediately via the mock token
          localStorage.setItem("mock_member_user", JSON.stringify({
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            fullName: mockUser.fullName,
            role: "USER",
            status: "ACTIVE",
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
          }))

          localStorage.setItem("mock_member_vehicles", JSON.stringify([
            {
              vehicleId: "v-" + Date.now(),
              licensePlate: mockUser.licensePlate,
              vehicleType: mockUser.vehicleType,
              brand: mockUser.brand,
              model: mockUser.model,
              status: "APPROVED",
              registeredAt: [{ tenantId: "t-demo", tenantName: mockUser.joinCode || "ParkVision HQ - Chi nhánh Đống Đa" }]
            }
          ]))
        }

        await adoptSession("mock_member_token")

        toast({
          title: "Đăng ký thành công",
          description: `Chào mừng thành viên ${values.fullName} tham gia ParkVision.`,
        })
        router.replace("/me")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể hoàn tất đăng ký thành viên"
        setFormError(message)
        toast({
          title: "Đăng ký thất bại",
          description: message,
          variant: "destructive",
        })
      }
    }
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

      {/* Brand panel — Left Column (Desktop only) */}
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
              Hệ thống kiểm soát và định vị ô đỗ thời gian thực.
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              Tích hợp YOLOv11 & PaddleOCR nhận diện biển số tự động đạt độ chính xác cao. 
              Vẽ sơ đồ ranh giới ô đỗ thông minh và quản lý trạng thái xe trong thời gian thực.
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

      {/* Right Column - Forms with Interactive Technology Aesthetics */}
      <main className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 relative">
        <section className="w-full max-w-lg space-y-6">
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

          {!roleSelected ? (
            /* Role Selection Screen - High fidelity */
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 shadow-2xl backdrop-blur-xl sm:p-8 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400 uppercase">
                  BƯỚC 01 // KHỞI TẠO TÀI KHOẢN
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Chọn chế độ đăng ký
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  ParkVision cung cấp hai cổng đăng ký độc lập để tối ưu hóa nhu cầu sử dụng của bạn.
                </p>
              </div>

              <div className="grid gap-4">
                {/* MEMBER Card */}
                <button
                  type="button"
                  onClick={() => selectRole("MEMBER")}
                  className="group relative flex flex-col items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-left transition-all hover:border-emerald-500/50 hover:bg-slate-900/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <div className="absolute top-4 right-4 text-slate-600 group-hover:text-emerald-400 transition-colors font-mono text-[10px]">
                    PORTAL_MEMBER
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/5 border border-emerald-500/20 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/40 transition-colors">
                    <Car className="size-5 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      Đăng ký Thành viên (MEMBER)
                      <span className="text-[10px] font-mono font-medium text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded bg-emerald-500/5">
                        Dành cho cá nhân
                      </span>
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      Cá nhân đăng ký xe, xem vị trí ô đỗ thực tế, lịch sử gửi xe và nhận thông báo di dời xe tức thì từ AI.
                    </p>
                  </div>
                </button>

                {/* TENANT Card */}
                <button
                  type="button"
                  onClick={() => selectRole("TENANT")}
                  className="group relative flex flex-col items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-left transition-all hover:border-emerald-500/50 hover:bg-slate-900/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <div className="absolute top-4 right-4 text-slate-600 group-hover:text-emerald-400 transition-colors font-mono text-[10px]">
                    CONSOLE_TENANT
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/5 border border-emerald-500/20 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/40 transition-colors">
                    <Building2 className="size-5 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      Đăng ký Chủ bãi xe (TENANT)
                      <span className="text-[10px] font-mono font-medium text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-500/5">
                        Dành cho quản lý
                      </span>
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      Tổ chức, trường học, chung cư, siêu thị tự thiết lập sơ đồ bãi đỗ GIS Polygon, liên kết camera AI và theo dõi thống kê doanh thu.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-900">
                <span className="text-xs font-mono text-slate-500">SYSTEM_ID: READY</span>
                <Link
                  href="/login"
                  className="text-xs font-mono text-emerald-400 hover:underline hover:text-emerald-300"
                >
                  &gt; ĐÃ CÓ TÀI KHOẢN? ĐĂNG NHẬP
                </Link>
              </div>
            </div>
          ) : (
            /* Multi-step Registration wizard */
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6 shadow-2xl backdrop-blur-xl sm:p-8 space-y-6">
              {/* Header inside the wizard card */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                    ONBOARDING SYSTEM // {userType}
                  </span>
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {userType === "TENANT" ? "Tạo bãi đỗ thông minh" : "Gia nhập ParkVision"}
                </h1>
                <p className="text-xs text-slate-400">
                  {userType === "TENANT" 
                    ? "Cá nhân hóa hệ thống bãi xe của bạn chỉ trong 2 phút." 
                    : "Đăng ký thông tin tài khoản và biển số xe cá nhân."}
                </p>
              </div>

              {/* Progress Bar / Steps indicator */}
              <div className="space-y-3">
                <ol className="grid grid-cols-4 gap-2" aria-label="Tiến trình đăng ký">
                  {STEPS.map((step, index) => {
                    const isActive = index === currentStep
                    const isDone = index < currentStep

                    return (
                      <li key={step.title} className="min-w-0" aria-current={isActive ? "step" : undefined}>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono font-semibold transition-all duration-200",
                              isDone && "border-emerald-500 bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
                              isActive && "border-emerald-400 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
                              !isDone && !isActive && "border-slate-800 bg-slate-950 text-slate-500",
                            )}
                          >
                            {isDone ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                          </span>
                          {index < STEPS.length - 1 && (
                            <span
                              aria-hidden="true"
                              className={cn("h-[1px] min-w-0 flex-1 bg-slate-800", isDone && "bg-emerald-500")}
                            />
                          )}
                        </div>
                        <p className={cn("mt-1.5 truncate text-[10px] font-mono font-medium uppercase tracking-wider", isActive ? "text-emerald-400" : "text-slate-500")}>
                          {step.title}
                        </p>
                      </li>
                    )
                  })}
                </ol>

                <div
                  className="h-1 overflow-hidden rounded-full bg-slate-900"
                  role="progressbar"
                  aria-label="Tiến độ"
                  aria-valuemin={1}
                  aria-valuemax={STEPS.length}
                  aria-valuenow={currentStep + 1}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    style={{ transform: `scaleX(${(currentStep + 1) / STEPS.length})`, transformOrigin: "left" }}
                  />
                </div>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit, () =>
                  setAttemptedSteps((steps) => new Set(steps).add(STEPS.length - 1))
                )}
                noValidate
                className="space-y-4"
              >
                <div className="min-h-[260px] flex flex-col justify-center">
                  {formError && (
                    <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-mono text-red-400">
                      ERR_API: {formError}
                    </div>
                  )}

                  <div className="space-y-1 mb-4">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                      {`BƯỚC ${currentStep + 1} / ${STEPS.length} // ${STEPS[currentStep].title}`}
                    </span>
                    <h2
                      ref={stepTitleRef}
                      tabIndex={-1}
                      className="text-lg font-bold text-white outline-none"
                    >
                      {STEPS[currentStep].title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {STEPS[currentStep].description}
                    </p>
                  </div>

                  {/* TENANT STEP 0: OrganizationName */}
                  {userType === "TENANT" && currentStep === 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="organizationName" className="text-xs text-slate-300 font-mono">
                        &gt; TÊN TỔ CHỨC / DOANH NGHIỆP
                      </Label>
                      <Input
                        id="organizationName"
                        autoFocus
                        autoComplete="organization"
                        placeholder="Ví dụ: Tòa nhà Hà Nội Center, Đại học Bách Khoa"
                        className="h-10 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 placeholder:text-slate-600"
                        aria-invalid={attemptedSteps.has(0) && Boolean(errors.organizationName)}
                        {...register("organizationName")}
                      />
                      <FieldError
                        id="organizationName-error"
                        message={attemptedSteps.has(0) ? errors.organizationName?.message : undefined}
                      />
                    </div>
                  )}

                  {/* TENANT STEP 1: Management Model */}
                  {userType === "TENANT" && currentStep === 1 && (
                    <fieldset className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      <legend className="sr-only">Chọn mô hình quản lý</legend>
                      <RadioGroup
                        value={selectedModel}
                        onValueChange={(value) => {
                          setValue("managementModel", value as ManagementModel, {
                            shouldDirty: true,
                          })
                          clearErrors("managementModel")
                        }}
                        className="grid gap-2 sm:grid-cols-2"
                      >
                        {MANAGEMENT_MODELS.map((model) => {
                          const Icon = model.icon
                          const isSelected = selectedModel === model.value
                          const optionId = `management-model-${model.value}`

                          return (
                            <div
                              key={model.value}
                              className={cn(
                                "flex items-start gap-2.5 rounded-lg border p-2.5 transition-all",
                                isSelected
                                  ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                  : "border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-900/10",
                              )}
                            >
                              <RadioGroupItem id={optionId} value={model.value} className="mt-1 border-slate-700 text-emerald-500" />
                              <Label htmlFor={optionId} className="flex flex-1 cursor-pointer items-start gap-2 leading-normal">
                                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded", isSelected ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-500")}>
                                  <Icon className="size-3.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-slate-200 truncate">{model.label}</span>
                                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-400 line-clamp-1">{model.description}</span>
                                </span>
                              </Label>
                            </div>
                          )
                        })}
                      </RadioGroup>
                      <FieldError
                        id="managementModel-error"
                        message={attemptedSteps.has(1) ? errors.managementModel?.message : undefined}
                      />
                    </fieldset>
                  )}

                  {/* TENANT STEP 2: Scale (Area Count) */}
                  {userType === "TENANT" && currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="areaCount" className="text-xs text-slate-300 font-mono">
                          &gt; SỐ BÃI / KHU VỰC CẦN QUẢN LÝ
                        </Label>
                        <Input
                          id="areaCount"
                          type="number"
                          min="1"
                          max="999"
                          placeholder="Ví dụ: 3"
                          className="h-10 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          aria-invalid={attemptedSteps.has(2) && Boolean(errors.areaCount)}
                          {...register("areaCount")}
                        />
                        <FieldError
                          id="areaCount-error"
                          message={attemptedSteps.has(2) ? errors.areaCount?.message : undefined}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5" aria-label="Gợi ý số lượng">
                        {["1", "2", "3", "5", "10"].map((count) => (
                          <Button
                            key={count}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[36px] bg-slate-950/40 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 font-mono text-[11px]"
                            onClick={() => {
                              setValue("areaCount", count, { shouldDirty: true })
                              clearErrors("areaCount")
                            }}
                          >
                            {count}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TENANT STEP 3: Admin Account */}
                  {userType === "TENANT" && currentStep === 3 && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs text-slate-300 font-mono">&gt; EMAIL QUẢN TRỊ</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="admin@email.com"
                          className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 placeholder:text-slate-700 text-xs"
                          aria-invalid={attemptedSteps.has(3) && Boolean(errors.email)}
                          {...register("email")}
                        />
                        <FieldError id="email-error" message={attemptedSteps.has(3) ? errors.email?.message : undefined} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="username" className="text-xs text-slate-300 font-mono">&gt; TÊN ĐĂNG NHẬP</Label>
                        <div className="relative">
                          <UserRound className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
                          <Input
                            id="username"
                            placeholder="admin_username"
                            className="h-9 pl-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 placeholder:text-slate-700 text-xs font-mono"
                            aria-invalid={attemptedSteps.has(3) && Boolean(errors.username)}
                            {...register("username")}
                          />
                        </div>
                        <FieldError id="username-error" message={attemptedSteps.has(3) ? errors.username?.message : undefined} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs text-slate-300 font-mono">&gt; MẬT KHẨU</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                              aria-invalid={attemptedSteps.has(3) && Boolean(errors.password)}
                              {...register("password")}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <FieldError id="password-error" message={attemptedSteps.has(3) ? errors.password?.message : undefined} />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="confirmPassword" className="text-xs text-slate-300 font-mono">&gt; XÁC NHẬN MẬT KHẨU</Label>
                          <div className="relative">
                            <Input
                              id="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                              aria-invalid={attemptedSteps.has(3) && Boolean(errors.confirmPassword)}
                              {...register("confirmPassword")}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <FieldError id="confirmPassword-error" message={attemptedSteps.has(3) ? errors.confirmPassword?.message : undefined} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEMBER STEP 0: Member Account */}
                  {userType === "MEMBER" && currentStep === 0 && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName" className="text-xs text-slate-300 font-mono">&gt; HỌ VÀ TÊN</Label>
                        <Input
                          id="fullName"
                          autoFocus
                          placeholder="Ví dụ: Nguyễn Văn An"
                          className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs"
                          aria-invalid={attemptedSteps.has(0) && Boolean(errors.fullName)}
                          {...register("fullName")}
                        />
                        <FieldError id="fullName-error" message={attemptedSteps.has(0) ? errors.fullName?.message : undefined} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs text-slate-300 font-mono">&gt; EMAIL LIÊN HỆ</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="an.nguyen@email.com"
                          className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs"
                          aria-invalid={attemptedSteps.has(0) && Boolean(errors.email)}
                          {...register("email")}
                        />
                        <FieldError id="email-error" message={attemptedSteps.has(0) ? errors.email?.message : undefined} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="username" className="text-xs text-slate-300 font-mono">&gt; TÊN ĐĂNG NHẬP</Label>
                        <Input
                          id="username"
                          placeholder="an_nguyen_member"
                          className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                          aria-invalid={attemptedSteps.has(0) && Boolean(errors.username)}
                          {...register("username")}
                        />
                        <FieldError id="username-error" message={attemptedSteps.has(0) ? errors.username?.message : undefined} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs text-slate-300 font-mono">&gt; MẬT KHẨU</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                              aria-invalid={attemptedSteps.has(0) && Boolean(errors.password)}
                              {...register("password")}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <FieldError id="password-error" message={attemptedSteps.has(0) ? errors.password?.message : undefined} />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="confirmPassword" className="text-xs text-slate-300 font-mono">&gt; XÁC NHẬN MẬT KHẨU</Label>
                          <div className="relative">
                            <Input
                              id="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs font-mono"
                              aria-invalid={attemptedSteps.has(0) && Boolean(errors.confirmPassword)}
                              {...register("confirmPassword")}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <FieldError id="confirmPassword-error" message={attemptedSteps.has(0) ? errors.confirmPassword?.message : undefined} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEMBER STEP 1: Vehicle Details */}
                  {userType === "MEMBER" && currentStep === 1 && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="licensePlate" className="text-xs text-slate-300 font-mono">&gt; BIỂN SỐ XE</Label>
                        <Input
                          id="licensePlate"
                          placeholder="Ví dụ: 29A-123.45"
                          className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-sm font-mono tracking-wide uppercase"
                          aria-invalid={attemptedSteps.has(1) && Boolean(errors.licensePlate)}
                          {...register("licensePlate")}
                        />
                        <FieldError id="licensePlate-error" message={attemptedSteps.has(1) ? errors.licensePlate?.message : undefined} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-300 font-mono">&gt; LOẠI PHƯƠNG TIỆN</Label>
                        <RadioGroup
                          value={selectedVehicleType}
                          onValueChange={(value) => {
                            setValue("vehicleType", value as any)
                            clearErrors("vehicleType")
                          }}
                          className="grid grid-cols-4 gap-2"
                        >
                          {[
                            { value: "car", label: "Ô tô" },
                            { value: "motorbike", label: "Xe máy" },
                            { value: "truck", label: "Xe tải" },
                            { value: "bus", label: "Xe buýt" },
                          ].map((type) => (
                            <div key={type.value}>
                              <RadioGroupItem id={`vt-${type.value}`} value={type.value} className="sr-only" />
                              <Label
                                htmlFor={`vt-${type.value}`}
                                className={cn(
                                  "flex h-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-mono transition-all",
                                  selectedVehicleType === type.value
                                    ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 font-semibold"
                                    : "border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                )}
                              >
                                {type.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="brand" className="text-xs text-slate-300 font-mono">&gt; HÃNG XE (TÙY CHỌN)</Label>
                          <Input
                            id="brand"
                            placeholder="Ví dụ: Toyota, Honda, Mazda"
                            className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs"
                            {...register("brand")}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="model" className="text-xs text-slate-300 font-mono">&gt; DÒNG XE (TÙY CHỌN)</Label>
                          <Input
                            id="model"
                            placeholder="Ví dụ: Camry, Vision, CX-5"
                            className="h-9 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-xs"
                            {...register("model")}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEMBER STEP 2: Link/Invite Code */}
                  {userType === "MEMBER" && currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="joinCode" className="text-xs text-slate-300 font-mono">&gt; MÃ LIÊN KẾT BÃI XE (TÙY CHỌN)</Label>
                        <Input
                          id="joinCode"
                          placeholder="Ví dụ: SITE-Q1, AN-BINH-PV"
                          className="h-10 bg-slate-950/60 border-slate-800 text-slate-100 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-sm font-mono tracking-widest"
                          {...register("joinCode")}
                        />
                        <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                          Mã liên kết do Ban quản trị hoặc quản lý bãi đỗ cung cấp để liên kết nhanh xe của bạn vào hệ thống kiểm soát tự động.
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.02] p-3 text-xs leading-normal text-slate-400 flex items-start gap-2.5">
                        <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-200">Bảo mật thông tin tối đa</p>
                          <p className="mt-0.5">Mã này chỉ liên kết biển số của bạn với bãi đỗ xe được chỉ định. Bạn có toàn quyền xóa hoặc hủy liên kết phương tiện bất kỳ lúc nào.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons of wizard card */}
                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-900 pt-6 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 sm:min-w-28 text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-mono text-xs"
                    onClick={goToPreviousStep}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    QUAY LẠI
                  </Button>

                  {currentStep < STEPS.length - 1 ? (
                    <Button
                      type="button"
                      className="h-9 sm:min-w-36 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] font-mono text-xs"
                      onClick={goToNextStep}
                    >
                      TIẾP TỤC
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="h-9 sm:min-w-52 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] font-mono text-xs"
                      disabled={isSubmitting}
                    >
                      <LockKeyhole className="size-3.5" aria-hidden="true" />
                      {isSubmitting ? "ĐANG XỬ LÝ..." : "HOÀN TẤT ĐĂNG KÝ"}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}

          {roleSelected && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Đã có tài khoản?{" "}
              <Link
                href="/login"
                className="font-semibold text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
