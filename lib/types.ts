export interface Employee {
  id: string
  employeeId: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  department: string
  position: string
  hireDate: string
  birthDate?: string
  gender?: "male" | "female" | "other"
  address?: string
  emergencyContact?: string
  emergencyPhone?: string
  salary?: number
  status: "active" | "inactive" | "terminated"
  avatar?: string
  cardNumber?: string
  accessLevel: "general" | "restricted" | "admin"
  permissions: string[]
  customFields?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  description?: string
  parentId?: string
  managerId?: string
  employeeCount: number
  createdAt: string
  updatedAt: string
}

export interface AccessLevel {
  id: string
  name: string
  description: string
  permissions: string[]
  isDefault: boolean
}

export interface CustomField {
  id: string
  name: string
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea"
  options?: string[]
  required: boolean
  category: string
  order: number
}

export interface DocumentLibrary {
  id: string
  name: string
  type: "folder" | "document"
  parentId?: string
  size?: number
  uploadDate?: string
  uploadedBy?: string
  permissions: string[]
  url?: string
}

export interface AuditLog {
  id: string
  action: string
  entityType: "employee" | "department" | "document"
  entityId: string
  userId: string
  timestamp: string
  details: Record<string, any>
}

export interface Vehicle {
  id: string
  employeeId: string
  employeeName: string
  licensePlate: string
  vehicleType: "car" | "motorbike" | "truck" | "bus"
  brand?: string
  model?: string
  color?: string
  year?: number
  engineNumber?: string
  chassisNumber?: string
  registrationDate: string
  expiryDate?: string
  insuranceNumber?: string
  insuranceExpiry?: string
  status: "active" | "inactive" | "maintenance" | "retired"
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid"
  capacity?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface EntryExitRequest {
  id: string
  employeeId: string
  employeeName: string
  vehicleId: string
  licensePlate: string
  requestType: "entry" | "exit"
  requestTime: string
  approvedBy?: string
  approvedAt?: string
  status: "pending" | "approved" | "rejected"
  notes?: string
  createdAt: string
}

export interface VehicleStatistics {
  totalVehicles: number
  activeVehicles: number
  inactiveVehicles: number
  maintenanceVehicles: number
  retiredVehicles: number
  vehicleTypeStats: Record<string, number>
  fuelTypeStats: Record<string, number>
  entryExitStats: {
    totalRequests: number
    approvedRequests: number
    pendingRequests: number
    rejectedRequests: number
    entryRequests: number
    exitRequests: number
  }
  dailyStats: VehicleDailyStats[]
  weeklyStats: VehicleWeeklyStats[]
  monthlyStats: VehicleMonthlyStats[]
}

export interface VehicleDailyStats {
  date: string
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  uniqueVehicles: number
}

export interface VehicleWeeklyStats {
  week: number
  startDate: string
  endDate: string
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  uniqueVehicles: number
}

export interface VehicleMonthlyStats {
  month: number
  year: number
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  uniqueVehicles: number
}
