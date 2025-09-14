import type {
  Employee,
  Department,
  AccessLevel,
  CustomField,
  DocumentLibrary,
  Vehicle,
  EntryExitRequest,
  VehicleStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
} from "./types"
import { mockEmployees, mockDepartments, mockAccessLevels, mockCustomFields, mockDocuments } from "./mock-data"
import { customFieldsApi } from "./api/custom-fields-api"
import { vehicleApi } from "./api/vehicle-api"
import { entryExitRequestApi } from "./api/entry-exit-request-api"
import { employeeApi } from "./api/employee-api"
import { vehicleStatisticsApi } from "./api/vehicle-statistics-api"

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
      year: 2020,
      engineNumber: "ENG123456789",
      chassisNumber: "CHS987654321",
      registrationDate: "2024-01-15",
      expiryDate: "2025-01-15",
      insuranceNumber: "INS123456789",
      insuranceExpiry: "2025-06-15",
      status: "active",
      fuelType: "gasoline",
      capacity: 5,
      notes: "Xe công vụ chính",
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
      year: 2021,
      engineNumber: "ENG987654321",
      chassisNumber: "CHS123456789",
      registrationDate: "2024-02-10",
      expiryDate: "2025-02-10",
      insuranceNumber: "INS987654321",
      insuranceExpiry: "2025-08-10",
      status: "active",
      fuelType: "gasoline",
      capacity: 2,
      notes: "Xe cá nhân",
      createdAt: "2024-02-10T09:00:00Z",
      updatedAt: "2024-02-10T09:00:00Z",
    },
    {
      id: "3",
      employeeId: "3",
      employeeName: "Lê Văn Cường",
      licensePlate: "51G-11111",
      vehicleType: "truck",
      brand: "Hyundai",
      model: "HD78",
      color: "Xanh",
      year: 2019,
      engineNumber: "ENG555666777",
      chassisNumber: "CHS888999000",
      registrationDate: "2023-12-01",
      expiryDate: "2024-12-01",
      insuranceNumber: "INS555666777",
      insuranceExpiry: "2025-03-01",
      status: "maintenance",
      fuelType: "diesel",
      capacity: 3,
      notes: "Xe tải vận chuyển",
      createdAt: "2023-12-01T10:00:00Z",
      updatedAt: "2024-03-01T14:30:00Z",
    },
    {
      id: "4",
      employeeId: "4",
      employeeName: "Phạm Thị Dung",
      licensePlate: "43C-22222",
      vehicleType: "bus",
      brand: "Mercedes",
      model: "Sprinter",
      color: "Trắng",
      year: 2022,
      engineNumber: "ENG111222333",
      chassisNumber: "CHS444555666",
      registrationDate: "2024-03-20",
      expiryDate: "2025-03-20",
      insuranceNumber: "INS111222333",
      insuranceExpiry: "2025-09-20",
      status: "active",
      fuelType: "diesel",
      capacity: 16,
      notes: "Xe bus đưa đón nhân viên",
      createdAt: "2024-03-20T11:00:00Z",
      updatedAt: "2024-03-20T11:00:00Z",
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
    {
      id: "2",
      employeeId: "1",
      employeeName: "Nguyễn Văn An",
      vehicleId: "1",
      licensePlate: "30A-12345",
      requestType: "exit",
      requestTime: "2024-03-15T17:30:00Z",
      status: "approved",
      approvedBy: "admin",
      approvedAt: "2024-03-15T17:35:00Z",
      createdAt: "2024-03-15T17:30:00Z",
    },
    {
      id: "3",
      employeeId: "2",
      employeeName: "Trần Thị Bình",
      vehicleId: "2",
      licensePlate: "29B-67890",
      requestType: "entry",
      requestTime: "2024-03-16T08:15:00Z",
      status: "approved",
      approvedBy: "admin",
      approvedAt: "2024-03-16T08:20:00Z",
      createdAt: "2024-03-16T08:15:00Z",
    },
    {
      id: "4",
      employeeId: "3",
      employeeName: "Lê Văn Cường",
      vehicleId: "3",
      licensePlate: "51G-11111",
      requestType: "entry",
      requestTime: "2024-03-16T09:00:00Z",
      status: "pending",
      createdAt: "2024-03-16T09:00:00Z",
    },
    {
      id: "5",
      employeeId: "4",
      employeeName: "Phạm Thị Dung",
      vehicleId: "4",
      licensePlate: "43C-22222",
      requestType: "entry",
      requestTime: "2024-03-17T07:45:00Z",
      status: "approved",
      approvedBy: "admin",
      approvedAt: "2024-03-17T07:50:00Z",
      createdAt: "2024-03-17T07:45:00Z",
    },
    {
      id: "6",
      employeeId: "1",
      employeeName: "Nguyễn Văn An",
      vehicleId: "1",
      licensePlate: "30A-12345",
      requestType: "entry",
      requestTime: "2024-03-18T08:00:00Z",
      status: "approved",
      approvedBy: "admin",
      approvedAt: "2024-03-18T08:05:00Z",
      createdAt: "2024-03-18T08:00:00Z",
    },
    {
      id: "7",
      employeeId: "2",
      employeeName: "Trần Thị Bình",
      vehicleId: "2",
      licensePlate: "29B-67890",
      requestType: "exit",
      requestTime: "2024-03-18T18:00:00Z",
      status: "rejected",
      approvedBy: "admin",
      approvedAt: "2024-03-18T18:05:00Z",
      createdAt: "2024-03-18T18:00:00Z",
    },
  ]

  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    try {
      return await employeeApi.getAllEmployeesList()
    } catch (error) {
      console.error('Failed to fetch employees from API, falling back to mock data:', error)
      return this.employees
    }
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
  // Custom Fields operations - using real API
  async getCustomFields(): Promise<CustomField[]> {
    try {
      return await customFieldsApi.getAllCustomFieldsList()
    } catch (error) {
      console.error('Failed to fetch custom fields from API, falling back to mock data:', error)
      return this.customFields
    }
  }

  async createCustomField(field: Omit<CustomField, "id">): Promise<CustomField> {
    try {
      return await customFieldsApi.createCustomField({
        name: field.name,
        type: field.type,
        options: field.options,
        required: field.required,
        category: field.category,
        order: field.order,
        description: field.description,
        defaultValue: field.defaultValue,
        validationRules: field.validationRules,
        isActive: true,
      })
    } catch (error) {
      console.error('Failed to create custom field via API, falling back to mock data:', error)
      const newField: CustomField = {
        ...field,
        id: Date.now().toString(),
      }
      this.customFields.push(newField)
      return newField
    }
  }

  async updateCustomField(id: string, updates: Partial<CustomField>): Promise<CustomField | null> {
    try {
      const existingField = await customFieldsApi.getCustomFieldById(id)
      const updatedData = {
        name: updates.name || existingField.name,
        type: updates.type || existingField.type,
        options: updates.options || existingField.options,
        required: updates.required !== undefined ? updates.required : existingField.required,
        category: updates.category || existingField.category,
        order: updates.order !== undefined ? updates.order : existingField.order,
        description: updates.description || existingField.description,
        defaultValue: updates.defaultValue || existingField.defaultValue,
        validationRules: updates.validationRules || existingField.validationRules,
        isActive: updates.isActive !== undefined ? updates.isActive : true,
      }
      return await customFieldsApi.updateCustomField(id, updatedData)
    } catch (error) {
      console.error('Failed to update custom field via API, falling back to mock data:', error)
      const index = this.customFields.findIndex((field) => field.id === id)
      if (index === -1) return null

      this.customFields[index] = { ...this.customFields[index], ...updates }
      return this.customFields[index]
    }
  }

  async deleteCustomField(id: string): Promise<boolean> {
    try {
      await customFieldsApi.deleteCustomField(id)
      return true
    } catch (error) {
      console.error('Failed to delete custom field via API, falling back to mock data:', error)
      const index = this.customFields.findIndex((field) => field.id === id)
      if (index === -1) return false

      this.customFields.splice(index, 1)
      return true
    }
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
  // Vehicle operations - using real API
  async getVehicles(page: number = 0, size: number = 10, sortBy: string = 'createdAt', sortDir: string = 'desc'): Promise<{vehicles: Vehicle[], totalElements: number, totalPages: number, currentPage: number}> {
    try {
      const response = await vehicleApi.getAllVehicles(page, size, sortBy, sortDir)
      return {
        vehicles: response.content,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        currentPage: response.number
      }
    } catch (error) {
      console.error('Failed to fetch vehicles from API, falling back to mock data:', error)
      // For mock data, implement simple pagination
      const startIndex = page * size
      const endIndex = startIndex + size
      const paginatedVehicles = this.vehicles.slice(startIndex, endIndex)
      const totalPages = Math.ceil(this.vehicles.length / size)
      
      return {
        vehicles: paginatedVehicles,
        totalElements: this.vehicles.length,
        totalPages: totalPages,
        currentPage: page
      }
    }
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    try {
      return await vehicleApi.getVehicleById(id)
    } catch (error) {
      console.error('Failed to fetch vehicle from API, falling back to mock data:', error)
      return this.vehicles.find((vehicle) => vehicle.id === id)
    }
  }

  async createVehicle(vehicle: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Promise<Vehicle> {
    try {
      const response = await vehicleApi.createVehicle({
        employeeId: vehicle.employeeId,
        employeeName: vehicle.employeeName,
        licensePlate: vehicle.licensePlate,
        vehicleType: vehicle.vehicleType,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
        engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber,
        registrationDate: vehicle.registrationDate,
        expiryDate: vehicle.expiryDate,
        insuranceNumber: vehicle.insuranceNumber,
        insuranceExpiry: vehicle.insuranceExpiry,
        status: vehicle.status,
        fuelType: vehicle.fuelType,
        capacity: vehicle.capacity,
        notes: vehicle.notes,
      })
      return response.vehicle
    } catch (error) {
      console.error('Failed to create vehicle via API, falling back to mock data:', error)
      const newVehicle: Vehicle = {
        ...vehicle,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.vehicles.push(newVehicle)
      return newVehicle
    }
  }

  async createVehicleWithResponse(vehicle: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Promise<{vehicle: Vehicle, alreadyExists: boolean, message: string}> {
    try {
      const response = await vehicleApi.createVehicle({
        employeeId: vehicle.employeeId,
        employeeName: vehicle.employeeName,
        licensePlate: vehicle.licensePlate,
        vehicleType: vehicle.vehicleType,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
        engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber,
        registrationDate: vehicle.registrationDate,
        expiryDate: vehicle.expiryDate,
        insuranceNumber: vehicle.insuranceNumber,
        insuranceExpiry: vehicle.insuranceExpiry,
        status: vehicle.status,
        fuelType: vehicle.fuelType,
        capacity: vehicle.capacity,
        notes: vehicle.notes,
      })
      return response
    } catch (error) {
      console.error('Failed to create vehicle via API, falling back to mock data:', error)
      const newVehicle: Vehicle = {
        ...vehicle,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.vehicles.push(newVehicle)
      return {
        vehicle: newVehicle,
        alreadyExists: false,
        message: "Xe đã được tạo thành công (mock data)"
      }
    }
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
    try {
      const existingVehicle = await vehicleApi.getVehicleById(id)
      const updatedData = {
        employeeId: updates.employeeId || existingVehicle.employeeId,
        employeeName: updates.employeeName || existingVehicle.employeeName,
        licensePlate: updates.licensePlate || existingVehicle.licensePlate,
        vehicleType: updates.vehicleType || existingVehicle.vehicleType,
        brand: updates.brand || existingVehicle.brand,
        model: updates.model || existingVehicle.model,
        color: updates.color || existingVehicle.color,
        year: updates.year !== undefined ? updates.year : existingVehicle.year,
        engineNumber: updates.engineNumber || existingVehicle.engineNumber,
        chassisNumber: updates.chassisNumber || existingVehicle.chassisNumber,
        registrationDate: updates.registrationDate || existingVehicle.registrationDate,
        expiryDate: updates.expiryDate || existingVehicle.expiryDate,
        insuranceNumber: updates.insuranceNumber || existingVehicle.insuranceNumber,
        insuranceExpiry: updates.insuranceExpiry || existingVehicle.insuranceExpiry,
        status: updates.status || existingVehicle.status,
        fuelType: updates.fuelType || existingVehicle.fuelType,
        capacity: updates.capacity !== undefined ? updates.capacity : existingVehicle.capacity,
        notes: updates.notes || existingVehicle.notes,
      }
      return await vehicleApi.updateVehicle(id, updatedData)
    } catch (error) {
      console.error('Failed to update vehicle via API, falling back to mock data:', error)
      const index = this.vehicles.findIndex((vehicle) => vehicle.id === id)
      if (index === -1) return null

      this.vehicles[index] = {
        ...this.vehicles[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return this.vehicles[index]
    }
  }

  async deleteVehicle(id: string): Promise<boolean> {
    try {
      await vehicleApi.deleteVehicle(id)
      return true
    } catch (error) {
      console.error('Failed to delete vehicle via API, falling back to mock data:', error)
      const index = this.vehicles.findIndex((vehicle) => vehicle.id === id)
      if (index === -1) return false

      this.vehicles.splice(index, 1)
      return true
    }
  }

  // Entry/exit request operations - using real API
  async getEntryExitRequests(): Promise<EntryExitRequest[]> {
    try {
      return await entryExitRequestApi.getAllRequestsList()
    } catch (error) {
      console.error('Failed to fetch entry/exit requests from API, falling back to mock data:', error)
      return this.entryExitRequests
    }
  }

  async createEntryExitRequest(request: Omit<EntryExitRequest, "id" | "createdAt">): Promise<EntryExitRequest> {
    try {
      return await entryExitRequestApi.createRequest({
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        vehicleId: request.vehicleId,
        licensePlate: request.licensePlate,
        requestType: request.requestType,
        requestTime: request.requestTime,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt,
        status: request.status,
        notes: request.notes,
      })
    } catch (error) {
      console.error('Failed to create entry/exit request via API, falling back to mock data:', error)
      const newRequest: EntryExitRequest = {
        ...request,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      this.entryExitRequests.push(newRequest)
      return newRequest
    }
  }

  async updateEntryExitRequest(id: string, updates: Partial<EntryExitRequest>): Promise<EntryExitRequest | null> {
    try {
      // Use dedicated approve/reject endpoints if available
      if (updates.status === "approved" && updates.approvedBy) {
        return await entryExitRequestApi.approveRequest(id, updates.approvedBy)
      } else if (updates.status === "rejected" && updates.approvedBy) {
        return await entryExitRequestApi.rejectRequest(id, updates.approvedBy)
      } else {
        // Fallback to general update for other fields
        const existingRequest = await entryExitRequestApi.getRequestById(id)
        const updatedData = {
          employeeId: updates.employeeId || existingRequest.employeeId,
          employeeName: updates.employeeName || existingRequest.employeeName,
          vehicleId: updates.vehicleId || existingRequest.vehicleId,
          licensePlate: updates.licensePlate || existingRequest.licensePlate,
          requestType: updates.requestType || existingRequest.requestType,
          requestTime: updates.requestTime || existingRequest.requestTime,
          approvedBy: updates.approvedBy || existingRequest.approvedBy,
          approvedAt: updates.approvedAt || existingRequest.approvedAt,
          status: updates.status || existingRequest.status,
          notes: updates.notes || existingRequest.notes,
        }
        return await entryExitRequestApi.updateRequest(id, updatedData)
      }
    } catch (error) {
      console.error('Failed to update entry/exit request via API, falling back to mock data:', error)
      const index = this.entryExitRequests.findIndex((request) => request.id === id)
      if (index === -1) return null

      this.entryExitRequests[index] = {
        ...this.entryExitRequests[index],
        ...updates,
      }
      return this.entryExitRequests[index]
    }
  }

  async deleteEntryExitRequest(id: string): Promise<boolean> {
    try {
      await entryExitRequestApi.deleteRequest(id)
      return true
    } catch (error) {
      console.error('Failed to delete entry/exit request via API, falling back to mock data:', error)
      const index = this.entryExitRequests.findIndex((request) => request.id === id)
      if (index === -1) return false

      this.entryExitRequests.splice(index, 1)
      return true
    }
  }

  // Vehicle Statistics operations
  async getVehicleStatistics(): Promise<VehicleStatistics> {
    return await vehicleStatisticsApi.getVehicleStatistics()
  }

  // Legacy method - keeping for backward compatibility but should not be used
  getVehicleStatisticsSync(): VehicleStatistics {
    const vehicles = this.vehicles
    const requests = this.entryExitRequests

    // Basic vehicle stats
    const totalVehicles = vehicles.length
    const activeVehicles = vehicles.filter(v => v.status === "active").length
    const inactiveVehicles = vehicles.filter(v => v.status === "inactive").length
    const maintenanceVehicles = vehicles.filter(v => v.status === "maintenance").length
    const retiredVehicles = vehicles.filter(v => v.status === "retired").length

    // Vehicle type stats
    const vehicleTypeStats = {
      car: vehicles.filter(v => v.vehicleType === "car").length,
      motorbike: vehicles.filter(v => v.vehicleType === "motorbike").length,
      truck: vehicles.filter(v => v.vehicleType === "truck").length,
      bus: vehicles.filter(v => v.vehicleType === "bus").length,
    }

    // Fuel type stats
    const fuelTypeStats = {
      gasoline: vehicles.filter(v => v.fuelType === "gasoline").length,
      diesel: vehicles.filter(v => v.fuelType === "diesel").length,
      electric: vehicles.filter(v => v.fuelType === "electric").length,
      hybrid: vehicles.filter(v => v.fuelType === "hybrid").length,
    }

    // Entry/Exit stats
    const entryExitStats = {
      totalRequests: requests.length,
      approvedRequests: requests.filter(r => r.status === "approved").length,
      pendingRequests: requests.filter(r => r.status === "pending").length,
      rejectedRequests: requests.filter(r => r.status === "rejected").length,
      entryRequests: requests.filter(r => r.requestType === "entry").length,
      exitRequests: requests.filter(r => r.requestType === "exit").length,
    }

    // Generate daily, weekly, and monthly stats
    const dailyStats = this.generateDailyStats(requests)
    const weeklyStats = this.generateWeeklyStats(requests)
    const monthlyStats = this.generateMonthlyStats(requests)

    return {
      totalVehicles,
      activeVehicles,
      inactiveVehicles,
      maintenanceVehicles,
      retiredVehicles,
      vehicleTypeStats,
      fuelTypeStats,
      entryExitStats,
      dailyStats,
      weeklyStats,
      monthlyStats,
    }
  }

  private generateDailyStats(requests: EntryExitRequest[]): VehicleDailyStats[] {
    const dailyMap = new Map<string, VehicleDailyStats>()
    const uniqueVehiclesPerDay = new Map<string, Set<string>>()

    requests.forEach(request => {
      const date = new Date(request.requestTime).toISOString().split('T')[0]
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          entryCount: 0,
          exitCount: 0,
          totalRequests: 0,
          approvedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          uniqueVehicles: 0,
        })
        uniqueVehiclesPerDay.set(date, new Set())
      }

      const dayStats = dailyMap.get(date)!
      uniqueVehiclesPerDay.get(date)!.add(request.vehicleId)

      dayStats.totalRequests++
      if (request.requestType === "entry") {
        dayStats.entryCount++
      } else {
        dayStats.exitCount++
      }

      if (request.status === "approved") dayStats.approvedCount++
      else if (request.status === "pending") dayStats.pendingCount++
      else if (request.status === "rejected") dayStats.rejectedCount++
    })

    // Set unique vehicles count
    dailyMap.forEach((stats, date) => {
      stats.uniqueVehicles = uniqueVehiclesPerDay.get(date)!.size
    })

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  private generateWeeklyStats(requests: EntryExitRequest[]): VehicleWeeklyStats[] {
    const weeklyMap = new Map<string, VehicleWeeklyStats>()
    const uniqueVehiclesPerWeek = new Map<string, Set<string>>()

    requests.forEach(request => {
      const date = new Date(request.requestTime)
      const weekStart = this.getWeekStart(date)
      const weekKey = weekStart.toISOString().split('T')[0]
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          week: `Tuần ${this.getWeekNumber(date)}`,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          entryCount: 0,
          exitCount: 0,
          totalRequests: 0,
          approvedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          uniqueVehicles: 0,
          averageDailyRequests: 0,
        })
        uniqueVehiclesPerWeek.set(weekKey, new Set())
      }

      const weekStats = weeklyMap.get(weekKey)!
      uniqueVehiclesPerWeek.get(weekKey)!.add(request.vehicleId)

      weekStats.totalRequests++
      if (request.requestType === "entry") {
        weekStats.entryCount++
      } else {
        weekStats.exitCount++
      }

      if (request.status === "approved") weekStats.approvedCount++
      else if (request.status === "pending") weekStats.pendingCount++
      else if (request.status === "rejected") weekStats.rejectedCount++
    })

    // Set unique vehicles count and average daily requests
    weeklyMap.forEach((stats, weekKey) => {
      stats.uniqueVehicles = uniqueVehiclesPerWeek.get(weekKey)!.size
      stats.averageDailyRequests = Math.round((stats.totalRequests / 7) * 10) / 10
    })

    return Array.from(weeklyMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  private generateMonthlyStats(requests: EntryExitRequest[]): VehicleMonthlyStats[] {
    const monthlyMap = new Map<string, VehicleMonthlyStats>()
    const uniqueVehiclesPerMonth = new Map<string, Set<string>>()
    const dailyRequestsPerMonth = new Map<string, Map<string, number>>()

    requests.forEach(request => {
      const date = new Date(request.requestTime)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const dayKey = date.toISOString().split('T')[0]
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: this.getMonthName(date.getMonth()),
          year: date.getFullYear(),
          entryCount: 0,
          exitCount: 0,
          totalRequests: 0,
          approvedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          uniqueVehicles: 0,
          averageDailyRequests: 0,
          peakDay: { date: "", requestCount: 0 },
        })
        uniqueVehiclesPerMonth.set(monthKey, new Set())
        dailyRequestsPerMonth.set(monthKey, new Map())
      }

      const monthStats = monthlyMap.get(monthKey)!
      uniqueVehiclesPerMonth.get(monthKey)!.add(request.vehicleId)
      
      const dayRequests = dailyRequestsPerMonth.get(monthKey)!
      dayRequests.set(dayKey, (dayRequests.get(dayKey) || 0) + 1)

      monthStats.totalRequests++
      if (request.requestType === "entry") {
        monthStats.entryCount++
      } else {
        monthStats.exitCount++
      }

      if (request.status === "approved") monthStats.approvedCount++
      else if (request.status === "pending") monthStats.pendingCount++
      else if (request.status === "rejected") monthStats.rejectedCount++
    })

    // Set unique vehicles count, average daily requests, and peak day
    monthlyMap.forEach((stats, monthKey) => {
      stats.uniqueVehicles = uniqueVehiclesPerMonth.get(monthKey)!.size
      const daysInMonth = new Date(stats.year, parseInt(monthKey.split('-')[1]), 0).getDate()
      stats.averageDailyRequests = Math.round((stats.totalRequests / daysInMonth) * 10) / 10
      
      const dayRequests = dailyRequestsPerMonth.get(monthKey)!
      let peakDay = { date: "", requestCount: 0 }
      dayRequests.forEach((count, date) => {
        if (count > peakDay.requestCount) {
          peakDay = { date, requestCount: count }
        }
      })
      stats.peakDay = peakDay
    })

    return Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month.localeCompare(b.month)
    })
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    return new Date(d.setDate(diff))
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  private getMonthName(monthIndex: number): string {
    const months = [
      "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ]
    return months[monthIndex]
  }
}

export const dataService = new DataService()
