import type {
  Employee,
  Department,
  AccessLevel,
  CustomField,
  DocumentLibrary,
  Vehicle,
  EntryExitRequest,
} from "./types"
import { mockEmployees, mockDepartments, mockAccessLevels, mockCustomFields, mockDocuments } from "./mock-data"

class DataService {
  private employees: Employee[] = [...mockEmployees]
  private departments: Department[] = [...mockDepartments]
  private accessLevels: AccessLevel[] = [...mockAccessLevels]
  private customFields: CustomField[] = [...mockCustomFields]
  private documents: DocumentLibrary[] = [...mockDocuments]
  private vehicles: Vehicle[] = [
    {
      id: "1",
      employeeId: "1",
      employeeName: "Nguyễn Văn An",
      licensePlate: "30A-12345",
      vehicleType: "car",
      brand: "Toyota",
      model: "Camry",
      color: "Trắng",
      registrationDate: "2024-01-15",
      status: "active",
      createdAt: "2024-01-15T08:00:00Z",
      updatedAt: "2024-01-15T08:00:00Z",
    },
    {
      id: "2",
      employeeId: "2",
      employeeName: "Trần Thị Bình",
      licensePlate: "29B-67890",
      vehicleType: "motorbike",
      brand: "Honda",
      model: "Wave",
      color: "Đỏ",
      registrationDate: "2024-02-10",
      status: "active",
      createdAt: "2024-02-10T09:00:00Z",
      updatedAt: "2024-02-10T09:00:00Z",
    },
  ]
  private entryExitRequests: EntryExitRequest[] = [
    {
      id: "1",
      employeeId: "1",
      employeeName: "Nguyễn Văn An",
      vehicleId: "1",
      licensePlate: "30A-12345",
      requestType: "entry",
      requestTime: "2024-03-15T08:30:00Z",
      status: "approved",
      approvedBy: "admin",
      approvedAt: "2024-03-15T08:35:00Z",
      createdAt: "2024-03-15T08:30:00Z",
    },
  ]

  // Employee operations
  getEmployees(): Employee[] {
    return this.employees
  }

  getEmployee(id: string): Employee | undefined {
    return this.employees.find((emp) => emp.id === id)
  }

  createEmployee(employee: Omit<Employee, "id" | "createdAt" | "updatedAt">): Employee {
    const newEmployee: Employee = {
      ...employee,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.employees.push(newEmployee)
    return newEmployee
  }

  updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    const index = this.employees.findIndex((emp) => emp.id === id)
    if (index === -1) return null

    this.employees[index] = {
      ...this.employees[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    return this.employees[index]
  }

  deleteEmployee(id: string): boolean {
    const index = this.employees.findIndex((emp) => emp.id === id)
    if (index === -1) return false

    this.employees.splice(index, 1)
    return true
  }

  searchEmployees(query: string): Employee[] {
    const lowercaseQuery = query.toLowerCase()
    return this.employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(lowercaseQuery) ||
        emp.employeeId.toLowerCase().includes(lowercaseQuery) ||
        emp.department.toLowerCase().includes(lowercaseQuery) ||
        emp.email.toLowerCase().includes(lowercaseQuery),
    )
  }

  // Department operations
  getDepartments(): Department[] {
    return this.departments
  }

  getDepartment(id: string): Department | undefined {
    return this.departments.find((dept) => dept.id === id)
  }

  createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Department {
    const newDepartment: Department = {
      ...department,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.departments.push(newDepartment)
    return newDepartment
  }

  updateDepartment(id: string, updates: Partial<Department>): Department | null {
    const index = this.departments.findIndex((dept) => dept.id === id)
    if (index === -1) return null

    this.departments[index] = {
      ...this.departments[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    return this.departments[index]
  }

  deleteDepartment(id: string): boolean {
    const index = this.departments.findIndex((dept) => dept.id === id)
    if (index === -1) return false

    this.departments.splice(index, 1)
    return true
  }

  // Access level operations
  getAccessLevels(): AccessLevel[] {
    return this.accessLevels
  }

  // Custom field operations
  getCustomFields(): CustomField[] {
    return this.customFields
  }

  createCustomField(field: Omit<CustomField, "id">): CustomField {
    const newField: CustomField = {
      ...field,
      id: Date.now().toString(),
    }
    this.customFields.push(newField)
    return newField
  }

  updateCustomField(id: string, updates: Partial<CustomField>): CustomField | null {
    const index = this.customFields.findIndex((field) => field.id === id)
    if (index === -1) return null

    this.customFields[index] = { ...this.customFields[index], ...updates }
    return this.customFields[index]
  }

  deleteCustomField(id: string): boolean {
    const index = this.customFields.findIndex((field) => field.id === id)
    if (index === -1) return false

    this.customFields.splice(index, 1)
    return true
  }

  // Document operations
  getDocuments(): DocumentLibrary[] {
    return this.documents
  }

  createDocument(document: Omit<DocumentLibrary, "id">): DocumentLibrary {
    const newDocument: DocumentLibrary = {
      ...document,
      id: Date.now().toString(),
    }
    this.documents.push(newDocument)
    return newDocument
  }

  deleteDocument(id: string): boolean {
    const index = this.documents.findIndex((doc) => doc.id === id)
    if (index === -1) return false

    this.documents.splice(index, 1)
    return true
  }

  // Vehicle operations
  getVehicles(): Vehicle[] {
    return this.vehicles
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.find((vehicle) => vehicle.id === id)
  }

  createVehicle(vehicle: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Vehicle {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.vehicles.push(newVehicle)
    return newVehicle
  }

  updateVehicle(id: string, updates: Partial<Vehicle>): Vehicle | null {
    const index = this.vehicles.findIndex((vehicle) => vehicle.id === id)
    if (index === -1) return null

    this.vehicles[index] = {
      ...this.vehicles[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    return this.vehicles[index]
  }

  deleteVehicle(id: string): boolean {
    const index = this.vehicles.findIndex((vehicle) => vehicle.id === id)
    if (index === -1) return false

    this.vehicles.splice(index, 1)
    return true
  }

  // Entry/exit request operations
  getEntryExitRequests(): EntryExitRequest[] {
    return this.entryExitRequests
  }

  createEntryExitRequest(request: Omit<EntryExitRequest, "id" | "createdAt">): EntryExitRequest {
    const newRequest: EntryExitRequest = {
      ...request,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    this.entryExitRequests.push(newRequest)
    return newRequest
  }

  updateEntryExitRequest(id: string, updates: Partial<EntryExitRequest>): EntryExitRequest | null {
    const index = this.entryExitRequests.findIndex((request) => request.id === id)
    if (index === -1) return null

    this.entryExitRequests[index] = {
      ...this.entryExitRequests[index],
      ...updates,
    }
    return this.entryExitRequests[index]
  }

  deleteEntryExitRequest(id: string): boolean {
    const index = this.entryExitRequests.findIndex((request) => request.id === id)
    if (index === -1) return false

    this.entryExitRequests.splice(index, 1)
    return true
  }
}

export const dataService = new DataService()
