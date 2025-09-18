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
  rank?: string // Cấp bậc
  jobTitle?: string // Chức vụ
  militaryCivilian?: string // SQ/QNCN
  hireDate: string
  birthDate?: string
  gender?: "male" | "female" | "other"
  address?: string
  emergencyContact?: string
  emergencyPhone?: string
  salary?: number
  status: "active" | "inactive" | "terminated"
  avatar?: string
  accessLevel: "general" | "restricted" | "admin"
  permissions: string[]
  location?: string // Vị trí làm việc
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

export interface Position {
  id: string
  name: string
  description?: string
  parentId?: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
  parentName?: string
  childrenCount?: number
}

export enum PositionLevel {
  // Chức vụ hierarchy
  CHUC_VU = "chuc_vu",
  SI_QUAN = "si_quan",
  QNCN = "qncn",
  
  // Sĩ quan levels
  TRUNG_DOI = "trung_doi",
  DAI_DOI = "dai_doi",
  TIEU_DOAN = "tieu_doan",
  TRUNG_DOAN = "trung_doan",
  CO_QUAN_SQ = "co_quan_sq",
  
  // QNCN levels
  TIEU_DOAN_QNCN = "tieu_doan_qncn",
  CO_QUAN_QNCN = "co_quan_qncn",
  THAM_MUU = "tham_muu",
  CHINH_TRI = "chinh_tri",
  HAU_CAN_KY_THUAT = "hau_can_ky_thuat",
  
  // Traditional levels
  INTERN = "intern",
  JUNIOR = "junior",
  SENIOR = "senior",
  LEAD = "lead",
  MANAGER = "manager",
  DIRECTOR = "director",
  EXECUTIVE = "executive",
}


export interface DepartmentStatistics {
  totalDepartments: number
  totalEmployees: number
  averageEmployeesPerDepartment: number
  largestDepartment: {
    id: string
    name: string
    employeeCount: number
  }
  departmentHierarchy: {
    parentDepartments: number
    childDepartments: number
    maxDepth: number
  }
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
  status: "approved" | "rejected" | "exited" | "entered"
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid"
  capacity?: number
  notes?: string
  imagePath?: string
  createdAt: string
  updatedAt: string
}


export interface VehicleStatistics {
  totalVehicles: number
  activeVehicles: number
  inactiveVehicles: number
  maintenanceVehicles: number
  retiredVehicles: number
  vehicleTypeStats: Record<string, number>
  fuelTypeStats: Record<string, number>
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
  completedCount: number
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
  completedCount: number
  rejectedCount: number
  uniqueVehicles: number
  averageDailyRequests: number
}

export interface VehicleMonthlyStats {
  month: number
  year: number
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  completedCount: number
  rejectedCount: number
  uniqueVehicles: number
  averageDailyRequests: number
  peakDay: { date: string; requestCount: number }
}
