# Smart Parking 4.0 - Đồ án tốt nghiệp

## AI Parking Management System with LPR, Tracking & AI Chatbot

## 1. Mục tiêu

Xây dựng hệ thống quản lý bãi đỗ xe thông minh có khả năng: - Nhận diện
biển số xe. - Theo dõi vị trí xe theo thời gian thực. - Phát hiện người
và chuyển động. - Cập nhật vị trí xe khi bị di chuyển. - Lưu lịch sử,
hình ảnh. - Chatbot AI hỗ trợ tra cứu.

------------------------------------------------------------------------

# 2. Kiến trúc tổng thể

``` text
Camera
   │
Motion Detection
   │
Vehicle Detection (YOLO)
   │
Plate Detection
   │
OCR
   │
Tracking (ByteTrack)
   │
Parking Slot Mapping
   │
Event Bus
   ├── Database
   ├── Notification
   ├── Snapshot
   └── AI Chatbot API
```

------------------------------------------------------------------------

# 3. Module

## Phase 1 - AI Core

### 3.1 Motion Detection

-   OpenCV Background Subtraction
-   Frame Difference
-   Chỉ kích hoạt AI khi có chuyển động

Output - Motion Event

### 3.2 Vehicle Detection

-   YOLOv11
-   Detect Car/Motorbike

Output - Vehicle Bounding Box

### 3.3 License Plate Detection

-   YOLO
-   Crop Plate

### 3.4 OCR

-   PaddleOCR
-   So sánh EasyOCR/VietOCR

Output - Plate Number - Confidence

### 3.5 Vehicle Tracking

-   ByteTrack

Lưu: - TrackId - Plate - Position - Timestamp

------------------------------------------------------------------------

# Phase 2 - Smart Parking

## 4. Parking Slot Detection

Định nghĩa Polygon cho từng ô.

Ví dụ

A01

A02

A03

A04

Vehicle Center nằm trong polygon nào thì đó là vị trí hiện tại.

------------------------------------------------------------------------

## 5. Vehicle Relocation

Nếu:

TrackId giống nhau

Nhưng Slot thay đổi

=\> Sinh Event

VehicleRelocated

Update Database

Lưu ảnh.

------------------------------------------------------------------------

## 6. Snapshot Manager

Lưu ảnh khi

-   Xe vào
-   Xe đổi vị trí
-   Xe ra

Lưu: - Original - Cropped Plate - Snapshot

------------------------------------------------------------------------

# Phase 3 - Backend

## Service

-   AI Service
-   Parking Service
-   User Service
-   Notification Service
-   Chatbot Service

REST API

GET /vehicle/current

GET /vehicle/history

GET /parking/slots

POST /chat

------------------------------------------------------------------------

Database

Vehicle - Plate - OwnerId - CurrentSlot - LastSeen - SnapshotUrl

ParkingHistory - Plate - OldSlot - NewSlot - Time

MotionEvent - Camera - Person - Time

Snapshot - ImageUrl - EventType

------------------------------------------------------------------------

# Phase 4 - Dashboard

## Login

User

Guard

Admin

Dashboard

-   Live Camera
-   Parking Map
-   Occupied Slot
-   Empty Slot
-   Vehicle Search
-   Event Timeline
-   Analytics

------------------------------------------------------------------------

# Phase 5 - AI Chatbot

LLM + Tool Calling

Tool

getVehicleLocation()

getHistory()

getSnapshot()

getParkingStatus()

Ví dụ

Q: Xe tôi đang ở đâu?

A: Xe biển số 51A-12345 đang ở ô B12. Lần cuối ghi nhận 09:35. Kèm ảnh
mới nhất.

------------------------------------------------------------------------

# Phase 6 - Notification

Push Notification

Xe bị di chuyển.

Xe rời bãi.

Có người quanh xe quá lâu.

Camera offline.

------------------------------------------------------------------------

# Phase 7 - Analytics

-   Số xe hiện tại
-   Tỷ lệ lấp đầy
-   Thời gian đỗ trung bình
-   Top xe quay lại
-   Heatmap vị trí

------------------------------------------------------------------------

# Phase 8 - Event Driven

Events

VehicleDetected

PlateRecognized

VehicleEntered

VehicleRelocated

VehicleExited

PersonDetected

MotionDetected

SnapshotSaved

NotificationSent

------------------------------------------------------------------------

# Phase 9 - Triển khai

Docker Compose

Services

-   PostgreSQL
-   Redis
-   RabbitMQ
-   AI Service
-   Backend API
-   Frontend
-   Nginx

------------------------------------------------------------------------

# Công nghệ

AI - YOLOv11 - PaddleOCR - ByteTrack - OpenCV

Backend - Spring Boot hoặc ASP.NET Core - PostgreSQL - Redis - RabbitMQ

Frontend - React - TailwindCSS

AI Chatbot - Ollama - Qwen - Llama - Tool Calling

------------------------------------------------------------------------

# Roadmap

Tuần 1 - Motion Detection - Vehicle Detection

Tuần 2 - Plate Detection - OCR

Tuần 3 - Tracking - Parking Slot Mapping

Tuần 4 - Database - Backend API

Tuần 5 - Dashboard

Tuần 6 - Vehicle Relocation - Snapshot

Tuần 7 - Chatbot

Tuần 8 - Notification - Docker - Demo

------------------------------------------------------------------------

# Điểm nổi bật

-   Smart Parking 4.0
-   AI Computer Vision
-   Tracking thời gian thực
-   Parking Slot Mapping
-   Vehicle Relocation
-   AI Chatbot
-   Event Driven Architecture
-   Dashboard Realtime
-   Docker Deployment
