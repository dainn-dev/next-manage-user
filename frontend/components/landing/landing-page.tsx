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
  Cpu,
  Terminal,
  Activity,
  Bell,
  Server,
  Play,
  CheckCircle2,
  Lock,
  ChevronRight,
  HelpCircle,
  Database,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Nav Links
const NAV_LINKS = [
  { href: "#features", label: "Tính năng" },
  { href: "#pipeline", label: "AI Pipeline" },
  { href: "#pricing", label: "Bảng giá" },
]

// Tech Problems data
const PROBLEMS = [
  {
    code: "ERR_01_DECENTRALIZED",
    title: "Mất dấu vết toàn bộ hệ thống",
    body: "Mỗi bãi xe vận hành hoàn toàn cô lập. Trụ sở chính (HQ) không có cái nhìn trực quan, Realtime Dashboard cho 10–50 site.",
    accent: "text-red-400 border-red-500/20",
  },
  {
    code: "ERR_02_GATE_ONLY",
    title: "Chỉ biết xe qua cổng vào/ra",
    body: "Log bãi xe chỉ lưu lại mốc giờ ở cổng. Xe đỗ ở ô cụ thể nào, khu vực nào trong hầm thì hoàn toàn không có dữ liệu định vị.",
    accent: "text-amber-400 border-amber-500/20",
  },
  {
    code: "ERR_03_UNTRACTED_MOVE",
    title: "Sự cố dời xe ngoài ý muốn",
    body: "Tài xế hoặc nhân viên tự ý di chuyển xe trong bãi mà không báo cáo. Không có Event Relocation được gửi đi, dẫn đến thất lạc xe.",
    accent: "text-orange-400 border-orange-500/20",
  },
  {
    code: "ERR_04_MANUAL_SUPPORT",
    title: "Truy tìm thủ công tốn kém",
    body: "Khi khách hàng hỏi “Xe tôi đang đỗ ở đâu?”, bảo vệ phải lật từng log camera cổng hoặc dò từng tầng hầm. Không có tự phục vụ.",
    accent: "text-rose-400 border-rose-500/20",
  },
]

// Features details
const FEATURES = [
  {
    icon: Camera,
    title: "YOLOv11 + PaddleOCR",
    body: "Mô hình thị giác máy tính tiên tiến nhận diện xe, khoanh vùng biển số và trích xuất text với độ chính xác cao tuyệt đối cho biển số VN.",
    tag: "AI Core",
  },
  {
    icon: Radar,
    title: "ByteTrack State-tracker",
    body: "Gán track_id cố định trên từng đối tượng di chuyển xuyên suốt các khung hình camera, tạo tiền đề phân tích đường đi của phương tiện.",
    tag: "Tracking",
  },
  {
    icon: ParkingCircle,
    title: "Polygon Slot Mapping",
    body: "Vẽ ranh giới (polygon) cho từng ô đỗ xe bằng công cụ designer chuyên dụng. Thuật toán point-in-polygon định vị ô đỗ tức thì.",
    tag: "GIS Engine",
  },
  {
    icon: MapPin,
    title: "Phát hiện Relocation",
    body: "Tự động phát hiện phương tiện thay đổi ô đỗ. Gửi tín hiệu cảnh báo VehicleRelocated kèm snapshot camera và tọa độ mới dưới 30s.",
    tag: "Event Bus",
  },
  {
    icon: Bot,
    title: "AI Chatbot Tool-calling",
    body: "Tích hợp trợ lý ảo qua Zalo/Telegram. Tự động gọi API `getVehicleLocation` để chỉ đường và gửi ảnh chụp vị trí xe cho chủ xe.",
    tag: "NLP Agent",
  },
  {
    icon: Zap,
    title: "Realtime WebSocket Grid",
    body: "Cập nhật dữ liệu bãi xe, tỉ lệ lấp đầy, thông báo cảnh báo đến trình duyệt qua kết nối STOMP/WebSocket độ trễ dưới 2 giây.",
    tag: "Data Sync",
  },
]

// AI pipeline steps details
const PIPELINE_STEPS = [
  {
    step: "01",
    phase: "Motion Detection",
    title: "OpenCV MOG2 Gating",
    desc: "Sử dụng giải thuật trừ nền (background subtraction) để lọc nhiễu tĩnh. Chỉ kích hoạt toàn bộ luồng AI suy luận khi có chuyển động thực tế tại bãi xe, giúp tiết kiệm đến 70% tài nguyên tính toán ở Edge Node.",
    command: "cv2.createBackgroundSubtractorMOG2()",
    metric: "Tiết kiệm 72% compute",
  },
  {
    step: "02",
    phase: "Object Detection",
    title: "YOLOv11 Inference",
    desc: "Mô hình mạng nơ-ron tích chập (CNN) phát hiện đồng thời nhiều loại phương tiện (Ô tô, Xe máy, Xe tải) trong khung hình camera bãi đỗ với độ chính xác IoU cực lớn.",
    command: "yolo.predict(source, classes=[car, motorcycle])",
    metric: "Inference time ~ 12ms",
  },
  {
    step: "03",
    phase: "License Plate OCR",
    title: "PaddleOCR Vietnamese Model",
    desc: "Phân tách và phóng đại khu vực chứa biển số xe, áp dụng mạng OCR đọc ký tự chữ và số. Đã tối ưu hóa riêng cho các mẫu biển số dài/ngắn của Việt Nam.",
    command: "paddleocr.read(cropped_plate, lang='vi')",
    metric: "Độ chính xác >= 97.4%",
  },
  {
    step: "04",
    phase: "Object Tracking",
    title: "ByteTrack Core Association",
    desc: "Sử dụng thuật toán Kalmar Filter và liên kết dữ liệu theo thời gian để lưu giữ mã số duy nhất (track_id) cho mỗi phương tiện di chuyển trong bãi xe.",
    command: "tracker.update(detections, frame_id)",
    metric: "Zero Identity Switch Rate",
  },
  {
    step: "05",
    phase: "Spatial Analysis",
    title: "Point-in-Polygon Mapping",
    desc: "Lấy điểm tọa độ trung tâm của xe (bounding box bottom-center) so khớp với bản đồ lưới tọa độ các ô đỗ xe đã được định dạng trước để tìm ô đỗ tương ứng.",
    command: "polygon.contains(Point(x, y))",
    metric: "Định vị ô đỗ tức thì",
  },
  {
    step: "06",
    phase: "Event Notification",
    title: "RabbitMQ Realtime Event",
    desc: "Đóng gói sự kiện dưới dạng JSON chứa thông tin biển số, thời gian, mã bãi đỗ, mã ô đỗ, track_id cũ/mới và gửi qua Event Bus đến hệ thống Notification & AI Chatbot.",
    command: "event_bus.publish('vehicle.relocated', event_data)",
    metric: "Event latency < 2.0s",
  },
]

// Subscription plans
const PLANS = [
  {
    name: "Free",
    price: "0₫",
    period: "dùng thử",
    blurb: "Đánh giá khả năng hoạt động thực tế trên 1 site",
    sites: "1 site vận hành",
    cameras: "2 camera kết nối",
    retention: "7 ngày lưu dữ liệu",
    chatbot: false,
    cta: "Bắt đầu miễn phí",
    featured: false,
  },
  {
    name: "Starter",
    price: "Liên hệ",
    period: "/tháng",
    blurb: "Phù hợp chuỗi bãi đỗ nhỏ dưới 3 vị trí",
    sites: "Tối đa 3 site",
    cameras: "Tối đa 10 camera",
    retention: "30 ngày lưu dữ liệu",
    chatbot: false,
    cta: "Chọn gói Starter",
    featured: false,
  },
  {
    name: "Pro",
    price: "Liên hệ",
    period: "/tháng",
    blurb: "Hệ thống quản lý multi-site quy mô vừa",
    sites: "Tối đa 15 site",
    cameras: "Tối đa 60 camera",
    retention: "90 ngày lưu dữ liệu",
    chatbot: true,
    cta: "Chọn gói Pro",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "SLA riêng",
    blurb: "Bãi đỗ sân bay, campus lớn, tích hợp sâu",
    sites: "Không giới hạn site",
    cameras: "Không giới hạn camera",
    retention: "Lưu trữ tùy chỉnh",
    chatbot: true,
    cta: "Liên hệ bộ phận Sales",
    featured: false,
  },
]

// Initial Parking slots mockup
const INITIAL_SLOTS = [
  { id: "A01", occupied: true, vehicle: { plate: "51A-987.65", trackId: "#T102", updated: "10:32", type: "Ô tô" } },
  { id: "A02", occupied: true, vehicle: { plate: "51A-123.45", trackId: "#T115", updated: "10:35", type: "Ô tô" } },
  { id: "A03", occupied: false, vehicle: null },
  { id: "A04", occupied: true, vehicle: { plate: "30F-555.22", trackId: "#T109", updated: "10:11", type: "Ô tô" } },
  { id: "B01", occupied: false, vehicle: null },
  { id: "B02", occupied: true, vehicle: { plate: "29A-444.88", trackId: "#T122", updated: "10:40", type: "Ô tô" } },
  { id: "B03", occupied: false, vehicle: null },
  { id: "B04", occupied: false, vehicle: null },
]

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activePipeline, setActivePipeline] = useState(0)
  const [selectedSlotId, setSelectedSlotId] = useState("A02")
  const [slots, setSlots] = useState(INITIAL_SLOTS)

  // Demo Simulation states
  const [isSimulating, setIsSimulating] = useState(false)
  const [simStep, setSimStep] = useState(0)
  const [simLogs, setSimLogs] = useState<string[]>([
    "05:38:00 - [SYSTEM] Khởi chạy ParkVision Edge Node Q1...",
    "05:38:02 - [SYSTEM] Đã đồng bộ cấu hình với máy chủ Cloud.",
    "05:38:05 - [LIVE] Kết nối thành công 4 luồng RTSP camera.",
  ])

  // Chatbot states
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Xin chào! Tôi là ParkVision AI Assistant. Bạn muốn tìm xe nào hay cần kiểm tra bãi đỗ nào hôm nay?" }
  ])
  const [chatbotTyping, setChatbotTyping] = useState(false)

  // Timer for logs rolling
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [simLogs])

  // Function to run the full simulation of "Relocation Event"
  const startRelocationDemo = () => {
    if (isSimulating) return
    setIsSimulating(true)
    setSimStep(1)
    
    // Step 1: Motion detected on A02
    setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [MOTION] Phát hiện chuyển động tại Camera #2 (Slot A02)...`])
    
    // Step 2: YOLO vehicle detection
    setTimeout(() => {
      setSimStep(2)
      setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [YOLOv11] Phát hiện xe Ô tô (IoU: 94.5%) - Gán mã theo dõi #T115.`])
    }, 1500)

    // Step 3: OCR Reading
    setTimeout(() => {
      setSimStep(3)
      setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [PaddleOCR] Đã trích xuất biển số: 51A-123.45 (Độ tin cậy: 98.9%).`])
    }, 3000)

    // Step 4: Tracking path
    setTimeout(() => {
      setSimStep(4)
      setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [TRACK] Xe #T115 di chuyển khỏi ranh giới ô A02.`])
      setSlots(prev => prev.map(s => s.id === "A02" ? { ...s, occupied: false, vehicle: null } : s))
    }, 4500)

    // Step 5: Relocation matching on B04
    setTimeout(() => {
      setSimStep(5)
      setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [SPATIAL] Xe #T115 lọt vào ranh giới ô B04. Trạng thái: Đỗ tĩnh.`])
      setSlots(prev => prev.map(s => s.id === "B04" ? { ...s, occupied: true, vehicle: { plate: "51A-123.45", trackId: "#T115", updated: new Date().toLocaleTimeString().slice(0, 5), type: "Ô tô" } } : s))
      setSelectedSlotId("B04")
    }, 6000)

    // Step 6: Trigger Real-time Notification
    setTimeout(() => {
      setSimStep(6)
      setSimLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - [EVENT_BUS] ⚠️ Đã phát hành Event [VehicleRelocated]: Xe 51A-123.45 di chuyển từ ô A02 -> B04. Gửi cảnh báo Telegram/Dashboard.`])
    }, 7500)

    // End simulation
    setTimeout(() => {
      setIsSimulating(false)
      setSimStep(0)
    }, 9500)
  }

  // Reset simulation to original states
  const resetDemo = () => {
    setSlots(INITIAL_SLOTS)
    setSelectedSlotId("A02")
    setSimLogs([
      "05:38:00 - [SYSTEM] Khởi chạy ParkVision Edge Node Q1...",
      "05:38:02 - [SYSTEM] Đã đồng bộ cấu hình với máy chủ Cloud.",
      "05:38:05 - [LIVE] Kết nối thành công 4 luồng RTSP camera.",
    ])
    setSimStep(0)
    setIsSimulating(false)
  }

  // Chatbot quick prompt click
  const handleChatbotQuery = (query: string, reply: string, delays: string[]) => {
    if (chatbotTyping) return
    
    // Add user message
    setChatbotMessages(prev => [...prev, { sender: "user", text: query }])
    setChatbotTyping(true)

    // Simulate system logs before replying
    setTimeout(() => {
      setChatbotTyping(false)
      setChatbotMessages(prev => [...prev, { sender: "bot", text: reply }])
    }, 1500)
  }

  const selectedSlot = slots.find(s => s.id === selectedSlotId)

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* Modern Sci-Fi Tech Grid & Blur effects */}
      <div className="absolute inset-0 -z-50 overflow-hidden">
        {/* Futuristic Dot Grid Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #10b981 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />
        {/* Glow Spheres */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#030712]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="relative flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:scale-105 transition-transform">
              <Radar className="size-5 animate-spin-slow text-emerald-400" />
              <div className="absolute top-0 right-0 size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-lg font-bold tracking-wider uppercase text-slate-100 font-mono">
              Park<span className="text-emerald-400">Vision</span>
            </span>
            <span className="hidden md:inline-block text-[10px] font-mono border border-emerald-500/30 text-emerald-400/80 px-2 py-0.5 rounded-full bg-emerald-500/5 uppercase tracking-widest">
              v4.0 Live
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-emerald-400 font-mono tracking-wide"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" asChild className="text-slate-300 hover:text-white font-mono text-xs">
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button asChild className="bg-emerald-500 text-slate-950 font-mono font-semibold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 border border-emerald-300/20 transition-all">
              <Link href="/register">
                Hệ thống Demo
                <ArrowRight className="size-3 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden border border-slate-800 text-slate-300"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="border-b border-slate-800 bg-[#030712]/95 px-4 py-5 md:hidden">
            <nav className="flex flex-col gap-2 font-mono">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-emerald-400"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-800 pt-4">
                <Button variant="outline" asChild className="w-full text-slate-300 border-slate-800">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild className="w-full bg-emerald-500 text-slate-950">
                  <Link href="/register">Thử nghiệm ngay</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              
              {/* Left Column - Tech pitch */}
              <div className="space-y-6 lg:col-span-6">
                
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-1 text-xs font-mono font-medium text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                  <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
                  <span>SMART PARKING 4.0 · STACK CHUYÊN SÂU</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-sans text-white leading-[1.08]">
                  Định vị xe <br />
                  <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                    Bằng Camera
                  </span><br />
                  Thời gian thực.
                </h1>

                <p className="max-w-xl text-sm md:text-base leading-relaxed text-slate-400">
                  Biến camera an ninh thông thường thành bản đồ định vị thông minh. Nhận diện biển số VN đạt <strong>≥97%</strong>, ByteTrack duy trì track_id ổn định, tự động phát hiện xe dịch chuyển (Relocation) và cho phép tài xế Chatbot hỏi <em>“Xe tôi đang ở đâu?”</em> tức thì.
                </p>

                {/* Micro tech metrics */}
                <div className="grid grid-cols-3 gap-4 border-y border-slate-800/80 py-4 font-mono text-xs">
                  <div>
                    <p className="text-emerald-400 font-bold text-lg">YOLOv11</p>
                    <p className="text-slate-500">Mô hình AI nhận diện</p>
                  </div>
                  <div className="border-l border-slate-800/80 pl-4">
                    <p className="text-cyan-400 font-bold text-lg">STOMP</p>
                    <p className="text-slate-500">WebSocket realtime</p>
                  </div>
                  <div className="border-l border-slate-800/80 pl-4">
                    <p className="text-indigo-400 font-bold text-lg">&lt;30s</p>
                    <p className="text-slate-500">Relocation Alert</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
                  <Button size="lg" className="h-12 px-6 font-mono font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all cursor-pointer" asChild>
                    <Link href="/register">
                      TRẢI NGHIỆM ĐĂNG KÝ
                      <ArrowRight className="size-4 ml-1.5" />
                    </Link>
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 font-mono border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
                    asChild
                  >
                    <a href="#pipeline">Xem AI Pipeline</a>
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Cấu hình đơn giản · Bản vẽ kỹ thuật số chính xác 100%</span>
                </div>
              </div>

              {/* Right Column - Interactive Live Control Room Console */}
              <div className="lg:col-span-6 relative">
                
                {/* Tech Dashboard Mock Frame */}
                <div className="rounded-2xl border border-slate-800 bg-[#070b16]/90 p-1.5 shadow-[0_0_50px_rgba(16,185,129,0.1)] backdrop-blur-md">
                  
                  {/* Console Header Bar */}
                  <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-950/80 px-4 py-3 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                        CONSOLE :: PARKVISION_LIVE_NODE_01
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        FPS: 30.2
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded">
                        SECURE: TRUE
                      </span>
                    </div>
                  </div>

                  {/* Main Grid content inside Console */}
                  <div className="p-4 space-y-4">
                    
                    {/* Visual Parking Lot Slots (Interactive) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="size-3.5 text-emerald-400 animate-pulse" />
                          Bản đồ ô đỗ thời gian thực (SITE Q1)
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Click ô xe để inspect dữ liệu
                        </span>
                      </div>

                      {/* Map Matrix layout */}
                      <div className="grid grid-cols-4 gap-2.5">
                        {slots.map((s) => {
                          const isSelected = s.id === selectedSlotId
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSlotId(s.id)}
                              className={cn(
                                "relative flex flex-col items-center justify-center py-3 rounded-lg border text-xs font-mono font-medium transition-all group",
                                s.occupied
                                  ? isSelected
                                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                                    : "border-slate-800/80 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                                  : "border-slate-800/40 bg-slate-950/20 text-slate-600 hover:border-slate-800"
                              )}
                            >
                              {/* LED occupancy status light */}
                              <span className={cn(
                                "absolute top-1 right-1.5 size-1.5 rounded-full",
                                s.occupied 
                                  ? isSelected ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"
                                  : "bg-slate-700"
                              )} />
                              
                              <span className="text-[10px] text-slate-500 uppercase">Khu {s.id[0]}</span>
                              <span className="text-base font-bold text-slate-200 group-hover:text-emerald-400">{s.id}</span>
                              <span className="text-[9px] mt-0.5 font-normal tracking-tight opacity-80">
                                {s.occupied ? s.vehicle?.plate : "Trống"}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Active Inspector Panel */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-1.5 opacity-20">
                        <Cpu className="size-16 text-slate-600" />
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            THÔNG TIN Ô ĐỐ KHAI THÁC :: SLOT {selectedSlotId}
                          </p>
                          <h4 className="mt-1 text-base font-bold text-slate-100 font-mono">
                            {selectedSlot?.occupied ? (
                              <>
                                <span className="text-emerald-400 font-mono tracking-wider">{selectedSlot.vehicle?.plate}</span>
                                <span className="text-xs text-slate-400 font-normal ml-2">({selectedSlot.vehicle?.type})</span>
                              </>
                            ) : (
                              <span className="text-slate-500 font-mono">Ô ĐANG TRỐNG (VACANT)</span>
                            )}
                          </h4>
                          {selectedSlot?.occupied && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-400">
                              <span>Track ID: <strong className="text-slate-200">{selectedSlot.vehicle?.trackId}</strong></span>
                              <span>Cập nhật mới: <strong className="text-slate-200">{selectedSlot.vehicle?.updated}</strong></span>
                              <span className="text-emerald-400/85">Confidence Score: <strong>99.4%</strong></span>
                            </div>
                          )}
                        </div>

                        {selectedSlot?.occupied ? (
                          <div className="flex flex-col items-end shrink-0 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[9px] font-mono text-emerald-400/80 uppercase">Camera Stream #2</span>
                            <span className="text-[11px] font-mono font-bold text-emerald-300">CONFIRMED</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end shrink-0 border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Trạng thái</span>
                            <span className="text-[11px] font-mono font-bold text-slate-500">AVAILABLE</span>
                          </div>
                        )}
                      </div>

                      {/* Mock License Plate Visual rendering */}
                      {selectedSlot?.occupied && (
                        <div className="mt-3 flex items-center gap-3 border-t border-slate-800/80 pt-3">
                          <div className="bg-white text-slate-950 font-bold px-3 py-1 rounded border-2 border-slate-950 flex flex-col items-center justify-center font-mono text-[13px] tracking-widest shrink-0 w-[110px] h-[44px]">
                            <div className="text-[7px] border-b border-slate-950/40 w-full text-center pb-0.5 leading-none">VIỆT NAM</div>
                            <div className="leading-none pt-0.5">{selectedSlot.vehicle?.plate}</div>
                          </div>
                          <p className="text-[10px] leading-normal text-slate-400 font-mono">
                            Giải thuật YOLOv11 plate crop tự động trích xuất bounding box và đưa qua PaddleOCR cục bộ ở Edge Node, chuyển đổi tức thì thành metadata văn bản.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Interactive Realtime Pipeline Simulation Terminal */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <Terminal className="size-3.5 text-cyan-400" />
                          Bảng giám sát sự kiện (EVENT BUS STREAM)
                        </span>
                        
                        {/* Simulation trigger buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={startRelocationDemo}
                            disabled={isSimulating}
                            className="text-[10px] font-mono px-3 py-1 rounded bg-cyan-500 text-slate-950 font-semibold flex items-center gap-1.5 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Play className="size-2.5 fill-current" />
                            {isSimulating ? "Đang chạy Demo..." : "Chạy Relocation Demo"}
                          </button>
                          
                          <button
                            onClick={resetDemo}
                            className="text-[10px] font-mono px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all"
                          >
                            <RefreshCw className="size-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Code/Terminal console logs */}
                      <div 
                        ref={logContainerRef}
                        className="h-[120px] rounded-lg border border-slate-800/60 bg-slate-950 p-2.5 font-mono text-[10px] text-slate-300 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800"
                      >
                        {simLogs.map((log, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "border-l-2 pl-2",
                              log.includes("[SYSTEM]") && "border-slate-700 text-slate-400",
                              log.includes("[MOTION]") && "border-amber-400 text-amber-300",
                              log.includes("[YOLOv11]") && "border-indigo-400 text-indigo-300",
                              log.includes("[PaddleOCR]") && "border-emerald-400 text-emerald-300",
                              log.includes("[TRACK]") && "border-blue-400 text-blue-300",
                              log.includes("[SPATIAL]") && "border-cyan-400 text-cyan-300",
                              log.includes("[EVENT_BUS]") && "border-rose-500 text-rose-300 font-bold bg-rose-950/20 py-0.5 rounded-r"
                            )}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Simulation Process Overlay HUD if active */}
                    {isSimulating && (
                      <div className="border border-cyan-500/30 bg-cyan-950/20 p-2.5 rounded-lg flex items-center justify-between font-mono text-[11px] animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
                          <span className="text-cyan-300 font-bold">TIẾN TRÌNH AI PIPELINE ĐANG CHẠY :</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-0.5 rounded", simStep >= 1 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-600")}>01.Motion</span>
                          <span className="text-slate-600">→</span>
                          <span className={cn("px-2 py-0.5 rounded", simStep >= 2 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-600")}>02.YOLO</span>
                          <span className="text-slate-600">→</span>
                          <span className={cn("px-2 py-0.5 rounded", simStep >= 3 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-600")}>03.OCR</span>
                          <span className="text-slate-600">→</span>
                          <span className={cn("px-2 py-0.5 rounded", simStep >= 5 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-900 text-slate-600")}>05.Map</span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Cyber decorative coordinates around layout */}
                <div className="absolute top-[-20px] left-[-20px] text-[9px] font-mono text-slate-600 tracking-widest hidden sm:block">
                  SYS_COORDS // [LAT: 10.762 · LON: 106.660]
                </div>
                <div className="absolute bottom-[-20px] right-[-10px] text-[9px] font-mono text-slate-600 tracking-widest hidden sm:block">
                  EDGE_ENCODER_OK_Q1 // COMPILING_SUCCESS
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Real-time Technical Metrics Grid */}
        <section className="border-y border-slate-800/80 bg-slate-950/40 relative">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <div className="flex items-baseline gap-1 text-4xl font-extrabold text-emerald-400 font-mono tracking-tight">
                  <span>97.4</span>
                  <span className="text-xl">%</span>
                </div>
                <div className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  ĐỘ CHÍNH XÁC BIỂN SỐ VN
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Đã kiểm nghiệm khắt khe qua 10,000+ lượt xe ban ngày, ban đêm, trời mưa lớn.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left border-l border-slate-800/80 pl-4 md:pl-8">
                <div className="flex items-baseline gap-1 text-4xl font-extrabold text-cyan-400 font-mono tracking-tight">
                  <span>&lt;30</span>
                  <span className="text-xl">s</span>
                </div>
                <div className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  PHÁT HIỆN DI CHUYỂN
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Tốc độ cảnh báo (latency p95) từ lúc phương tiện đổi ô đỗ cho đến khi nổ alert.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left border-l border-slate-800/80 pl-4 md:pl-8">
                <div className="flex items-baseline gap-1 text-4xl font-extrabold text-indigo-400 font-mono tracking-tight">
                  <span>&lt;2.0</span>
                  <span className="text-xl">s</span>
                </div>
                <div className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  ĐỒNG BỘ WEBSOCKET
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Dữ liệu bãi đỗ cập nhật tức thì tới trình duyệt quản trị viên từ luồng phân tích.
                </p>
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left border-l border-slate-800/80 pl-4 md:pl-8">
                <div className="flex items-baseline gap-1 text-4xl font-extrabold text-amber-400 font-mono tracking-tight">
                  <span>100</span>
                  <span className="text-xl">%</span>
                </div>
                <div className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  SỐNG SÓT CỤC BỘ EDGE
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Bất chấp mất kết nối Internet đám mây, các Node camera vẫn ghi nhận log an toàn.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Problem Matrix Section (Bento Grid Style) */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-3">
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
              VẤN ĐỀ VẬN HÀNH
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Hệ thống bãi xe hiện nay đang bị &quot;Mù thông tin&quot;
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
              Vận hành nhiều chi nhánh bãi đỗ xe hoặc bãi đỗ khuôn viên doanh nghiệp bằng các giải pháp thủ công đang gây ra những thất thoát khổng lồ.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p, i) => (
              <div
                key={p.code}
                className="rounded-xl border border-slate-800/60 bg-[#070b14]/70 p-5 shadow-sm hover:border-slate-700 hover:bg-[#070b14] transition-all duration-300 relative group overflow-hidden"
              >
                {/* Tech coordinates or decorations */}
                <div className="absolute top-2 right-3 font-mono text-[9px] text-slate-600">
                  {p.code}
                </div>
                
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500">
                  SYS_FAIL_0{i + 1}
                </span>

                <h3 className="mt-4 text-[15px] font-bold font-mono text-slate-100 group-hover:text-emerald-400 transition-colors">
                  {p.title}
                </h3>
                
                <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
                  {p.body}
                </p>

                {/* Bottom decorative color border line */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-900 to-slate-800 group-hover:from-emerald-500/50 group-hover:to-cyan-500/50 transition-all duration-300" />
              </div>
            ))}
          </div>
        </section>

        {/* AI Pipeline Flowchart Interactive Explainer */}
        <section id="pipeline" className="scroll-mt-20 border-t border-slate-800/80 bg-slate-950/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            
            <div className="mx-auto max-w-3xl text-center space-y-3">
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-cyan-400 bg-cyan-500/5 px-3 py-1 rounded-full border border-cyan-500/20">
                THỊ GIÁC MÁY TÍNH
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Cấu trúc suy luận AI Pipeline 6 bước
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm">
                Giải thuật xử lý khép kín tại biên (Edge Computing). Từ frame hình camera thô đến sự kiện dạng văn bản phân phối tới người dùng dưới 2 giây.
              </p>
            </div>

            {/* Pipeline Tabs control and Viewer */}
            <div className="mt-12 grid gap-8 lg:grid-cols-12 items-stretch">
              
              {/* Left Column: Navigation step list */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                {PIPELINE_STEPS.map((s, idx) => {
                  const isActive = activePipeline === idx
                  return (
                    <button
                      key={s.step}
                      onClick={() => setActivePipeline(idx)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
                        isActive
                          ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                          : "border-slate-800/60 bg-slate-950/30 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      )}
                    >
                      <span className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold font-mono border",
                        isActive 
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                          : "bg-slate-900 border-slate-800 text-slate-500"
                      )}>
                        {s.step}
                      </span>
                      
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-mono uppercase text-slate-500 block tracking-widest leading-none">
                          {s.phase}
                        </span>
                        <h3 className="text-sm font-bold font-mono text-slate-200 mt-1">
                          {s.title}
                        </h3>
                      </div>
                      
                      <ChevronRight className={cn("size-4 transition-transform", isActive ? "text-emerald-400 translate-x-1" : "text-slate-600")} />
                    </button>
                  )
                })}
              </div>

              {/* Right Column: Code and Visual live simulation window */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#070b14]/90 p-6 shadow-md relative overflow-hidden min-h-[400px]">
                
                {/* Visual simulator based on active stage */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-mono font-bold text-slate-300">
                        STAGE_SIMULATION_VIEWER :: STEP_{PIPELINE_STEPS[activePipeline].step}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      {PIPELINE_STEPS[activePipeline].metric}
                    </span>
                  </div>

                  {/* Stage description text */}
                  <div>
                    <h3 className="text-lg font-bold font-mono text-emerald-400">
                      {PIPELINE_STEPS[activePipeline].title}
                    </h3>
                    <p className="mt-2 text-xs md:text-sm leading-relaxed text-slate-400">
                      {PIPELINE_STEPS[activePipeline].desc}
                    </p>
                  </div>

                  {/* SVG / Vector visual demonstration box */}
                  <div className="relative aspect-video rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden p-4">
                    
                    {/* Render specific simulation visual based on active step index */}
                    {activePipeline === 0 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        <div className="absolute inset-0 border border-amber-500/20 rounded-lg bg-amber-500/[0.01] flex items-center justify-center">
                          <div className="w-[80%] h-[70%] border border-dashed border-amber-500/40 rounded flex items-center justify-center">
                            <span className="text-[10px] text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20 uppercase tracking-widest animate-pulse">
                              Camera #4 Viuewfinder
                            </span>
                          </div>
                        </div>
                        {/* Motion overlay indicators */}
                        <div className="size-16 rounded-full border border-dashed border-rose-500 flex items-center justify-center animate-ping absolute" />
                        <Activity className="size-8 text-rose-500 z-10" />
                        <span className="text-xs text-rose-400 mt-2 font-mono">[MOTION DETECTED] COORDS(x:324, y:128)</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">MOG2 Threshold score: 4,120 &gt; min_pixels(1,200)</span>
                      </div>
                    )}

                    {activePipeline === 1 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        {/* Car Silhouette with YOLO bounding box */}
                        <div className="relative border-2 border-indigo-500 bg-indigo-500/5 px-5 py-4 rounded-lg flex flex-col items-center shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                          <span className="absolute -top-5.5 -left-[2px] bg-indigo-500 text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-t font-mono">
                            CAR :: CONF 99.2%
                          </span>
                          <span className="text-3xl">🚗</span>
                          <span className="text-xs text-slate-400 mt-1">x1: 120, y1: 240, x2: 480, y2: 600</span>
                        </div>
                        <span className="text-[10px] text-indigo-400 mt-3">[YOLOv11 Object Detection pass - Classes mapped: 1]</span>
                      </div>
                    )}

                    {activePipeline === 2 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        {/* OCR crop and text extraction */}
                        <div className="border border-slate-800 bg-slate-900 p-2.5 rounded-lg flex items-center gap-3">
                          <div className="bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded flex items-center shrink-0">
                            <span className="text-emerald-400 text-sm font-bold tracking-widest">51A-123.45</span>
                          </div>
                          <span className="text-slate-500">→</span>
                          <div className="flex flex-col text-[10px]">
                            <span className="text-slate-400">OCR Read: <strong className="text-slate-100">&quot;51A12345&quot;</strong></span>
                            <span className="text-emerald-400">Char Conf: 99.1% | Char count: 8</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[8px] text-emerald-400/80">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          PaddleOCR Core v4_vietnamese
                        </div>
                        <span className="text-[10px] text-slate-500 mt-4">[Binarization, Denoising, Text Segmenter, CTC Decoder]</span>
                      </div>
                    )}

                    {activePipeline === 3 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        {/* Tracker path vector simulation */}
                        <svg className="w-[80%] h-[70%] border border-slate-800/80 rounded bg-slate-950/40 relative" viewBox="0 0 200 100">
                          {/* Grid lines */}
                          <line x1="0" y1="50" x2="200" y2="50" stroke="#1e293b" strokeDasharray="2,2" />
                          <line x1="100" y1="0" x2="100" y2="100" stroke="#1e293b" strokeDasharray="2,2" />
                          {/* Trajectory */}
                          <path d="M 20 80 Q 70 20 120 70 T 180 30" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3,3" />
                          <circle cx="20" cy="80" r="3" fill="#ef4444" />
                          <circle cx="180" cy="30" r="4" fill="#10b981" />
                          <text x="30" y="85" fill="#94a3b8" fontSize="6">START (A02)</text>
                          <text x="145" y="25" fill="#10b981" fontSize="6">CURRENT #T115 (B04)</text>
                        </svg>
                        <span className="text-[10px] text-blue-400 mt-2">ByteTrack Trajectory History map - track_id: #T115</span>
                      </div>
                    )}

                    {activePipeline === 4 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        {/* Polygon grid intersection representation */}
                        <div className="grid grid-cols-2 gap-4 w-[60%]">
                          <div className="border border-slate-800 bg-slate-900/40 p-2 rounded flex flex-col items-center">
                            <span className="text-[9px] text-slate-500">Polygon A02</span>
                            <span className="text-xs text-rose-400 font-bold">CONTAINS = FALSE</span>
                          </div>
                          <div className="border border-emerald-500/30 bg-emerald-500/5 p-2 rounded flex flex-col items-center shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                            <span className="text-[9px] text-emerald-500/80">Polygon B04</span>
                            <span className="text-xs text-emerald-400 font-bold">CONTAINS = TRUE</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-4">Point-in-Polygon (PIP) intersection checking routine</span>
                      </div>
                    )}

                    {activePipeline === 5 && (
                      <div className="w-full h-full flex flex-col items-center justify-center font-mono relative">
                        {/* Event message output JSON structure */}
                        <pre className="text-[9.5px] text-emerald-300 bg-slate-950 p-3 rounded border border-slate-800/80 w-full h-[85%] overflow-y-auto">
{`{
  "event_type": "VehicleRelocated",
  "payload": {
    "plate": "51A-123.45",
    "track_id": "#T115",
    "old_slot": "A02",
    "new_slot": "B04",
    "site_id": "SITE_Q1",
    "timestamp": "${new Date().toISOString()}"
  }
}`}
                        </pre>
                      </div>
                    )}

                  </div>
                </div>

                {/* Code Terminal Command bar */}
                <div className="mt-4 border-t border-slate-800/60 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-3.5 text-slate-500" />
                    <span className="text-[10px] font-mono text-slate-500">API Execution Command:</span>
                  </div>
                  <code className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 select-all overflow-x-auto max-w-full">
                    {PIPELINE_STEPS[activePipeline].command}
                  </code>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* Dynamic Bento-Grid Features List */}
        <section id="features" className="scroll-mt-20 border-t border-slate-800/80">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            
            <div className="mx-auto max-w-3xl text-center space-y-3">
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/20">
                MODULES CHUYÊN SÂU
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Nền tảng hoàn thiện thay thế bãi xe truyền thống
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
                Tích hợp các module phần mềm mạnh mẽ nhất phục vụ đắc lực cho công tác tự động hóa bãi xe.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, idx) => (
                <div
                  key={f.title}
                  className="group rounded-xl border border-slate-800/60 bg-gradient-to-b from-[#070b14]/70 to-[#030712]/50 p-6 shadow-sm hover:border-emerald-500/30 hover:bg-[#070b14] transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                      <f.icon className="size-5" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {f.tag}
                    </span>
                  </div>

                  <h3 className="mt-5 text-base font-bold font-mono text-slate-100 group-hover:text-emerald-400 transition-colors">
                    {f.title}
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {f.body}
                  </p>

                  <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none text-slate-400">
                    <span className="text-4xl font-extrabold font-mono select-none">0{idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Interactive Chatbot Terminal simulation */}
        <section className="border-t border-slate-800/80 bg-slate-950/40 relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-12 items-center">
              
              {/* Left Column: Chatbot Value Pitch */}
              <div className="lg:col-span-5 space-y-6">
                <span className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
                  SELF-SERVICE AGENT
                </span>
                
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  AI Chatbot: <br />
                  <span className="text-emerald-400">Giải quyết 90%</span> <br />
                  câu hỏi tìm vị trí xe
                </h2>
                
                <p className="text-sm text-slate-400 leading-relaxed">
                  Thay vì bảo vệ phải lật log camera dở dang để tìm xe, tài xế chỉ cần nhắn tin cho chatbot bãi xe. Nhờ khả năng <strong>Tool-calling của trợ lý ảo AI</strong>, chatbot sẽ tự tìm vị trí, lấy hình ảnh chụp camera ô đỗ mới nhất và gửi chỉ đường trực tiếp tới điện thoại.
                </p>

                {/* Feature Check list */}
                <div className="space-y-3 font-mono text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Hỗ trợ tích hợp SDK Zalo, Telegram, Facebook Messenger</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Lấy camera snapshot bãi đỗ thực tế đính kèm câu trả lời</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Hỗ trợ tìm nhanh bằng 3-4 ký tự cuối của biển số xe</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Chatbot Terminal Preview */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-slate-800 bg-[#070b14]/90 shadow-2xl">
                  
                  {/* Chatbot title header */}
                  <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3 bg-slate-950/80 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Bot className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-slate-100">AI AGENT CLIENT</p>
                        <p className="text-[9px] font-mono text-emerald-400">ONLINE · ACTIVE</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Zalo/Messenger Connector</span>
                  </div>

                  {/* Chat Message Window Area */}
                  <div className="p-4 h-[240px] overflow-y-auto space-y-4 flex flex-col justify-end">
                    {chatbotMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex max-w-[80%] flex-col rounded-xl px-4 py-2.5 text-xs font-mono",
                          msg.sender === "user"
                            ? "bg-slate-800/80 text-slate-100 self-end rounded-tr-none border border-slate-700/50"
                            : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 self-start rounded-tl-none shadow-[0_0_10px_rgba(16,185,129,0.02)]"
                        )}
                      >
                        <span className="text-[8px] opacity-40 uppercase mb-1">
                          {msg.sender === "user" ? "Khách hàng" : "ParkVision AI Agent"}
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))}

                    {/* Chatbot typing animation loop */}
                    {chatbotTyping && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400/80 self-start rounded-xl px-4 py-2 text-xs font-mono flex items-center gap-2 animate-pulse">
                        <div className="flex gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-bounce" />
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                        </div>
                        <span>Đang xử lý ý định & kiểm tra cơ sở dữ liệu...</span>
                      </div>
                    )}
                  </div>

                  {/* Chatbot input controls with Quick prompt choices */}
                  <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 rounded-b-2xl space-y-3">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                      Bấm vào câu hỏi mẫu để test phản hồi của AI :
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleChatbotQuery(
                          "Xe 51A-123.45 đang ở đâu vậy?",
                          "Đã tìm thấy xe của bạn!\n\n🚗 Xe 51A-123.45 hiện đang đỗ tĩnh tại ô B04 (Khu B tầng hầm hầm B1, Site Q1).\n\n📸 Thời gian đỗ: Đã đỗ tĩnh từ lúc 10:35.\n🔗 Bấm vào link này để mở sơ đồ dẫn đường 3D bãi xe.",
                          ["[INFO] Parsing plate ID: 51A-123.45", "[DB] Found active session at Site Q1, Slot B04"]
                        )}
                        disabled={chatbotTyping}
                        className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        🔍 Tìm xe 51A-123.45
                      </button>

                      <button
                        onClick={() => handleChatbotQuery(
                          "Bãi xe Q1 hiện tại còn trống không?",
                          "Báo cáo trạng thái bãi xe Site Q1 lúc này:\n\n📊 Tỉ lệ lấp đầy: 62.5% (Có 5/8 ô đỗ đã có xe đỗ).\n🟢 Số ô trống khả dụng: 3 ô còn lại trống (A03, B01, B03).\n⏱️ Dự báo: Lưu lượng xe đang ổn định, không ùn ứ.",
                          ["[INFO] Fetching occupancy site Q1", "[API] Parsing slot statuses"]
                        )}
                        disabled={chatbotTyping}
                        className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        📊 Kiểm tra ô trống bãi Q1
                      </button>

                      <button
                        onClick={() => handleChatbotQuery(
                          "Lịch sử di chuyển của xe 51A-123.45?",
                          "Báo cáo lịch sử di chuyển (Relocation) xe 51A-123.45 trong hôm nay:\n\n1️⃣ 10:35 - Phát hiện Di chuyển (Relocation) từ ô A02 sang B04 (Camera #4 ghi nhận, Confidence 98.9%)\n2️⃣ 10:15 - Đỗ vào ô đỗ ban đầu A02 (Camera cổng nhận diện lúc 10:12)",
                          ["[INFO] Checking plate relocation log", "[DB] Mapped 2 historical track events"]
                        )}
                        disabled={chatbotTyping}
                        className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        ⏱️ Xem lịch sử xe 51A-123.45
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Pricing Subscriptions */}
        <section id="pricing" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            
            <div className="mx-auto max-w-3xl text-center space-y-3">
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
                BẢNG GIÁ ĐĂNG KÝ
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Cung cấp đầy đủ tính năng cho mọi quy mô bãi xe
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm">
                Chúng tôi không khóa bất kỳ tính năng cốt lõi nào của hệ thống. Gói đăng ký chỉ phân chia theo số lượng bãi xe (Site), Camera kết nối và dung lượng lưu trữ camera.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-gradient-to-b from-[#070b14]/80 to-[#030712]/50 p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-slate-700",
                    plan.featured
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.08)] lg:-mt-2 lg:mb-0"
                      : "border-slate-800/80"
                  )}
                >
                  {plan.featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold font-mono text-slate-950 uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                      HỒ SƠ KHUYÊN DÙNG
                    </span>
                  )}
                  
                  <h3 className="text-lg font-bold font-mono text-slate-100">{plan.name}</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-normal min-h-[32px]">{plan.blurb}</p>
                  
                  <div className="mt-4 flex items-baseline gap-1.5 border-b border-slate-800/60 pb-4">
                    <span className="text-3xl font-extrabold font-mono text-slate-100 tracking-tight">{plan.price}</span>
                    <span className="text-xs font-mono text-slate-500">{plan.period}</span>
                  </div>

                  {/* Pricing Feature checklist */}
                  <ul className="mt-6 flex-1 space-y-3 font-mono text-[11px] text-slate-300">
                    <li className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      <span>{plan.sites}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      <span>{plan.cameras}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      <span>{plan.retention}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      {plan.chatbot ? (
                        <>
                          <Check className="size-4 text-emerald-400 shrink-0" />
                          <span>Hỗ trợ AI Chatbot</span>
                        </>
                      ) : (
                        <>
                          <Lock className="size-4 text-slate-600 shrink-0" />
                          <span className="text-slate-500">Không có AI Chatbot</span>
                        </>
                      )}
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-400">Live Dashboard & Map Designer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-400">WebSocket real-time sync</span>
                    </li>
                  </ul>

                  <Button
                    className={cn(
                      "mt-8 w-full font-mono font-bold text-xs uppercase tracking-wider py-5 cursor-pointer",
                      plan.featured 
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                        : "border-slate-800 bg-slate-950/50 hover:bg-slate-900 text-slate-300"
                    )}
                    asChild
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* User Personas in Technology style */}
        <section className="border-t border-slate-800/80 bg-slate-950/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            
            <div className="mx-auto max-w-3xl text-center space-y-3">
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/20">
                USER ROLES
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Tối ưu hóa quy trình làm việc của mọi vị trí
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm">
                Thiết kế phân vai và quyền hạn bảo mật (RBAC) chi tiết cho từng đối tượng trong hệ sinh thái bãi đỗ xe thông minh.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  role: "Tenant Operations Lead",
                  desc: "Chủ đầu tư / Ban quản lý",
                  body: "Theo dõi toàn diện mọi bãi xe chỉ trong một dashboard duy nhất: tỷ lệ lấp đầy, số lượt xe vào ra, tần suất relocate và hóa đơn thanh toán tự động.",
                  tag: "HQ Console",
                  icon: Server,
                },
                {
                  role: "Site Manager & Guard",
                  desc: "Nhân viên kiểm soát / Bảo vệ",
                  body: "Kiosk kiểm soát cổng vào ra hoạt động bình thường, bổ sung Live Parking Map trực quan hiển thị chính xác vị trí xe từng ô thay vì ghi chép log mù mờ.",
                  tag: "Edge Kiosk Client",
                  icon: Activity,
                },
                {
                  role: "Vehicle Owner (Member)",
                  desc: "Tài xế / Khách hàng",
                  body: "Tự phục vụ tìm kiếm xe đỗ qua trợ lý AI Chatbot. Nhận thông tin bãi xe, ô đỗ trống, sơ đồ chỉ dẫn và ảnh chụp xe của mình mà không cần gọi hỗ trợ.",
                  tag: "Chatbot Self-service",
                  icon: Bot,
                },
              ].map((p) => (
                <article
                  key={p.role}
                  className="rounded-xl border border-slate-800/60 bg-gradient-to-b from-[#070b14]/70 to-[#030712]/50 p-6 flex flex-col justify-between hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800/40 pb-3 mb-4">
                      <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                        {p.tag}
                      </span>
                      <p.icon className="size-4.5 text-emerald-400" />
                    </div>
                    
                    <h3 className="text-base font-bold font-mono text-slate-100">{p.role}</h3>
                    <p className="text-xs text-emerald-400/80 font-mono mt-0.5">{p.desc}</p>
                    
                    <p className="mt-4 text-xs leading-relaxed text-slate-400">
                      {p.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>

          </div>
        </section>

        {/* High-Tech Immersive Final CTA */}
        <section className="relative overflow-hidden border-t border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 via-slate-950 to-indigo-900/10 pointer-events-none" />
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #10b981 1px, transparent 1px)",
              backgroundSize: "16px 16px"
            }}
          />
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 relative z-10 space-y-6">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full bg-emerald-500/5">
              DEPLOY_ONBOARD_NOW
            </span>
            
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl font-sans">
              Khai phóng tiềm năng camera <br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Thành bản đồ đỗ xe thông minh
              </span>
            </h2>
            
            <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm">
              Triển khai site đầu tiên của bạn chỉ trong vòng một ngày làm việc: Khảo sát góc cam, cấu hình polygon ô đỗ xe, và bật luồng suy luận AI WebSocket realtime.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="h-12 px-8 font-mono font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] cursor-pointer" asChild>
                <Link href="/register">THỬ NGHIỆM MIỄN PHÍ</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 font-mono border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer" asChild>
                <Link href="/login">ĐĂNG NHẬP HỆ THỐNG</Link>
              </Button>
            </div>
            
            <p className="text-[10px] font-mono text-slate-500">
              Gói dùng thử: 1 bãi xe · 2 camera RTSP · Lưu trữ 7 ngày dữ liệu · Không yêu cầu thẻ tín dụng
            </p>
          </div>
        </section>

      </main>

      {/* Cybernetic Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Radar className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold font-mono uppercase tracking-wider text-slate-100">
                Park<span className="text-emerald-400">Vision</span>
              </p>
              <p className="text-[10px] font-mono text-slate-500">
                Smart Parking 4.0 · Multi-site Video Analytics Platform
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-slate-400">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="hover:text-emerald-400 transition-colors cursor-pointer">
              Đăng nhập
            </Link>
            <Link href="/register" className="hover:text-emerald-400 transition-colors cursor-pointer">
              Dùng thử
            </Link>
          </nav>

          <p className="text-[10px] font-mono text-slate-500 text-left md:text-right">
            © {new Date().getFullYear()} ParkVision. All rights reserved.<br />
            Powered by Next.js & Tailwind. Engineered with YOLOv11 & PaddleOCR.
          </p>

        </div>
      </footer>

    </div>
  )
}
