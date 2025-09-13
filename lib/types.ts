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
  vehicleType: "car" | "motorbike"
  brand?: string
  model?: string
  color?: string
  registrationDate: string
  status: "active" | "inactive"
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
