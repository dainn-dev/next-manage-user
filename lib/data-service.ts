import type {
  Employee,
  Department,
  AccessLevel,
  Position,
  Vehicle,
  VehicleStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
  DepartmentStatistics,
} from "./types"
import { vehicleApi } from "./api/vehicle-api"
import { employeeApi } from "./api/employee-api"
import { vehicleStatisticsApi } from "./api/vehicle-statistics-api"
import { departmentApi } from "./api/department-api"
import { positionApi } from "./api/position-api"
import { vehicleLogApi, type EmployeeVehicleInfo } from "./api/vehicle-log-api"

class DataService {
  
  // Cache for API data to prevent multiple calls
  private departmentsCache: Department[] | null = null
  private departmentsCacheTime: number = 0
  private positionsCache: Position[] | null = null
  private positionsCacheTime: number = 0
  private employeesCache: Employee[] | null = null
  private employeesCacheTime: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  
  // Promise cache to prevent multiple simultaneous calls
  private departmentsPromise: Promise<Department[]> | null = null
  private employeesPromise: Promise<Employee[]> | null = null
  
  // Clear departments cache
  clearDepartmentsCache(): void {
    this.departmentsCache = null
    this.departmentsCacheTime = 0
    this.departmentsPromise = null
  }
  
  // Clear positions cache
  clearPositionsCache(): void {
    this.positionsCache = null
    this.positionsCacheTime = 0
  }
  
  // Clear employees cache
  clearEmployeesCache(): void {
    this.employeesCache = null
    this.employeesCacheTime = 0
    this.employeesPromise = null
  }
  
  // Clear all caches
  clearAllCaches(): void {
    this.clearDepartmentsCache()
    this.clearPositionsCache()
    this.clearEmployeesCache()
  }
  private vehicles: Vehicle[] = [
    {
      id: "1",
      employeeId: "1",
      employeeName: "Nguyễn Văn An",
      licensePlate: "30A-12345",
      vehicleType: "car",
      brand: "Toyota",
      model: "Camry",
      year: 2022,
      color: "Trắng",
      fuelType: "gasoline",
      status: "approved",
      registrationDate: "2022-01-15T00:00:00Z",
      lastMaintenanceDate: "2024-01-15T00:00:00Z",
      nextMaintenanceDate: "2024-07-15T00:00:00Z",
      notes: "Xe đang hoạt động bình thường",
      createdAt: "2024-03-15T08:30:00Z",
      updatedAt: "2024-03-15T08:30:00Z",
    },
    {
      id: "2",
      employeeId: "2",
      employeeName: "Trần Thị Bình",
      licensePlate: "29B-67890",
      vehicleType: "motorbike",
      brand: "Honda",
      model: "Wave Alpha",
      year: 2021,
      color: "Đỏ",
      fuelType: "gasoline",
      status: "approved",
      registrationDate: "2021-06-10T00:00:00Z",
      lastMaintenanceDate: "2024-02-10T00:00:00Z",
      nextMaintenanceDate: "2024-08-10T00:00:00Z",
      notes: "Xe máy cá nhân",
      createdAt: "2024-03-16T08:15:00Z",
      updatedAt: "2024-03-16T08:15:00Z",
    },
    {
      id: "3",
      employeeId: "3",
      employeeName: "Lê Văn Cường",
      licensePlate: "51G-11111",
      vehicleType: "car",
      brand: "Honda",
      model: "Civic",
      year: 2023,
      color: "Xanh",
      fuelType: "gasoline",
      status: "exited",
      registrationDate: "2023-03-01T00:00:00Z",
      lastMaintenanceDate: "2024-03-01T00:00:00Z",
      nextMaintenanceDate: "2024-09-01T00:00:00Z",
      notes: "Đang bảo dưỡng định kỳ",
      createdAt: "2024-03-17T09:00:00Z",
      updatedAt: "2024-03-17T09:00:00Z",
    },
    {
      id: "4",
      employeeId: "4",
      employeeName: "Phạm Thị Dung",
      licensePlate: "43C-22222",
      vehicleType: "car",
      brand: "Mazda",
      model: "CX-5",
      year: 2021,
      color: "Đen",
      fuelType: "diesel",
      status: "approved",
      registrationDate: "2021-11-20T00:00:00Z",
      lastMaintenanceDate: "2024-01-20T00:00:00Z",
      nextMaintenanceDate: "2024-07-20T00:00:00Z",
      notes: "SUV gia đình",
      createdAt: "2024-03-17T16:45:00Z",
      updatedAt: "2024-03-17T16:45:00Z",
    },
    {
      id: "5",
      employeeId: "5",
      employeeName: "Hoàng Văn Em",
      licensePlate: "77S-33333",
      vehicleType: "truck",
      brand: "Isuzu",
      model: "NPR",
      year: 2020,
      color: "Trắng",
      fuelType: "diesel",
      status: "entered",
      registrationDate: "2020-09-05T00:00:00Z",
      lastMaintenanceDate: "2023-09-05T00:00:00Z",
      nextMaintenanceDate: "2024-03-05T00:00:00Z",
      notes: "Xe tải đã nghỉ hưu",
      createdAt: "2024-03-18T07:30:00Z",
      updatedAt: "2024-03-18T07:30:00Z",
    },
    {
      id: "6",
      employeeId: "6",
      employeeName: "Đỗ Thị Hoa",
      licensePlate: "88H-44444",
      vehicleType: "bus",
      brand: "Hyundai",
      model: "County",
      year: 2019,
      color: "Vàng",
      fuelType: "diesel",
      status: "approved",
      registrationDate: "2019-12-01T00:00:00Z",
      lastMaintenanceDate: "2024-02-01T00:00:00Z",
      nextMaintenanceDate: "2024-08-01T00:00:00Z",
      notes: "Xe bus đưa đón nhân viên",
      createdAt: "2024-03-20T11:00:00Z",
      updatedAt: "2024-03-20T11:00:00Z",
    },
  ]

  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    const now = Date.now()
    
    // Return cached data if it's still valid
    if (this.employeesCache && (now - this.employeesCacheTime) < this.CACHE_DURATION) {
      return this.employeesCache
    }
    
    // If there's already a request in progress, return that promise
    if (this.employeesPromise) {
      return this.employeesPromise
    }
    
    // Create a new promise and cache it
    this.employeesPromise = this.fetchEmployeesFromAPI(now)
    
    try {
      const result = await this.employeesPromise
      return result
    } finally {
      // Clear the promise cache after the request completes
      this.employeesPromise = null
    }
  }
  
  private async fetchEmployeesFromAPI(now: number): Promise<Employee[]> {
    try {
      const apiEmployees = await employeeApi.getAllEmployeesList()
      
      // Cache the result
      this.employeesCache = apiEmployees
      this.employeesCacheTime = now
      
      return apiEmployees
    } catch (error) {
      console.error('Failed to fetch employees from API:', error)
      throw new Error('Unable to fetch employees data')
    }
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    const now = Date.now()
    
    // Return cached data if it's still valid
    if (this.departmentsCache && (now - this.departmentsCacheTime) < this.CACHE_DURATION) {
      return this.departmentsCache
    }
    
    // If there's already a request in progress, return that promise
    if (this.departmentsPromise) {
      return this.departmentsPromise
    }
    
    // Create a new promise and cache it
    this.departmentsPromise = this.fetchDepartmentsFromAPI(now)
    
    try {
      const result = await this.departmentsPromise
      return result
    } finally {
      // Clear the promise cache after the request completes
      this.departmentsPromise = null
    }
  }
  
  private async fetchDepartmentsFromAPI(now: number): Promise<Department[]> {
    try {
      const apiDepartments = await departmentApi.getAllDepartmentsList()
      const departments = apiDepartments
      
      // Cache the result
      this.departmentsCache = departments
      this.departmentsCacheTime = now
      
      return departments
    } catch (error) {
      console.error('Failed to fetch departments from API:', error)
      throw new Error('Unable to fetch departments data')
    }
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    try {
      const apiDepartment = await departmentApi.getDepartmentById(id)
      return apiDepartment
    } catch (error) {
      console.error('Failed to fetch department:', error)
      throw new Error(`Unable to fetch department with id: ${id}`)
    }
  }

  async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    try {
      const apiResponse = await departmentApi.createDepartment(department)
      
      // Clear departments cache since we added a new department
      this.clearDepartmentsCache()
      
      return apiResponse
    } catch (error) {
      console.error('Failed to create department:', error)
      throw new Error('Unable to create department')
    }
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department | null> {
    try {
      const existingDepartment = await this.getDepartment(id)
      if (!existingDepartment) return null

      const updatedDepartment = { ...existingDepartment, ...updates }
      const apiResponse = await departmentApi.updateDepartment(id, updatedDepartment)
      
      // Clear departments cache since we updated a department
      this.clearDepartmentsCache()
      
      return apiResponse
    } catch (error) {
      console.error('Failed to update department:', error)
      throw new Error('Unable to update department')
    }
  }

  async deleteDepartment(id: string): Promise<boolean> {
    try {
      await departmentApi.deleteDepartment(id)
      
      // Clear departments cache since we deleted a department
      this.clearDepartmentsCache()
      
      return true
    } catch (error) {
      console.error('Failed to delete department:', error)
      throw new Error('Unable to delete department')
    }
  }

  async getDepartmentEmployees(departmentId: string): Promise<Employee[]> {
    try {
      return await departmentApi.getDepartmentEmployees(departmentId)
    } catch (error) {
      console.error('Failed to fetch department employees:', error)
      throw new Error('Unable to fetch department employees')
    }
  }

  async getDepartmentStatistics(): Promise<DepartmentStatistics> {
    try {
      return await departmentApi.getDepartmentStatistics()
    } catch (error) {
      console.error('Failed to fetch department statistics:', error)
      throw new Error('Unable to fetch department statistics')
    }
  }

  async searchDepartments(query: string): Promise<Department[]> {
    try {
      const departments = await this.getDepartments()
      const lowercaseQuery = query.toLowerCase()
      return departments.filter(
        (dept) =>
          dept.name.toLowerCase().includes(lowercaseQuery) ||
          (dept.description && dept.description.toLowerCase().includes(lowercaseQuery))
      )
    } catch (error) {
      console.error('Failed to search departments:', error)
      throw new Error('Unable to search departments')
    }
  }

  // Access level operations
  async getAccessLevels(): Promise<AccessLevel[]> {
    // Access levels are typically static configuration, but we can make this async for consistency
    // If you need dynamic access levels, implement an API endpoint
    throw new Error('Access levels functionality not implemented')
  }

  // Position operations
  async getPositions(): Promise<Position[]> {
    const now = Date.now()
    
    // Return cached data if it's still valid
    if (this.positionsCache && (now - this.positionsCacheTime) < this.CACHE_DURATION) {
      return this.positionsCache
    }
    
    try {
      const apiPositions = await positionApi.getAllPositionsList()
      const positions = apiPositions.map(pos => positionApi.convertToPosition(pos))
      
      // Cache the result
      this.positionsCache = positions
      this.positionsCacheTime = now
      
      return positions
    } catch (error) {
      console.error('Failed to fetch positions:', error)
      throw new Error('Unable to fetch positions data')
    }
  }

  async getPositionsWithParent(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getPositionsWithParent()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch positions with parent:', error)
      throw new Error('Unable to fetch positions with parent data')
    }
  }

  async getPosition(id: string): Promise<Position | undefined> {
    try {
      const apiPosition = await positionApi.getPositionById(id)
      return positionApi.convertToPosition(apiPosition)
    } catch (error) {
      console.error('Failed to fetch position:', error)
      throw new Error(`Unable to fetch position with id: ${id}`)
    }
  }

  async createPosition(position: Omit<Position, "id" | "createdAt" | "updatedAt">): Promise<Position> {
    try {
      const apiRequest = positionApi.convertToApiRequest({
        ...position,
        id: '',
        createdAt: '',
        updatedAt: '',
        childrenCount: 0,
      } as Position)
      const apiResponse = await positionApi.createPosition(apiRequest)
      const newPosition = positionApi.convertToPosition(apiResponse)
      
      // Clear positions cache since we added a new position
      this.clearPositionsCache()
      
      return newPosition
    } catch (error) {
      console.error('Failed to create position:', error)
      throw new Error('Unable to create position')
    }
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | null> {
    try {
      const existingPosition = await this.getPosition(id)
      if (!existingPosition) return null

      const updatedPositionData = { ...existingPosition, ...updates }
      const apiRequest = positionApi.convertToApiRequest(updatedPositionData)
      const apiResponse = await positionApi.updatePosition(id, { ...apiRequest, id })
      const updatedPosition = positionApi.convertToPosition(apiResponse)
      
      // Clear positions cache since we updated a position
      this.clearPositionsCache()
      
      return updatedPosition
    } catch (error) {
      console.error('Failed to update position:', error)
      throw new Error('Unable to update position')
    }
  }

  async deletePosition(id: string): Promise<boolean> {
    try {
      await positionApi.deletePosition(id)
      
      // Clear positions cache since we deleted a position
      this.clearPositionsCache()
      
      return true
    } catch (error) {
      console.error('Failed to delete position:', error)
      throw new Error('Unable to delete position')
    }
  }

  async getPositionsByLevel(level: string): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getPositionsByLevel(level)
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch positions by level:', error)
      throw new Error('Unable to fetch positions by level')
    }
  }

  async getActivePositions(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getAllActivePositions()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch active positions:', error)
      throw new Error('Unable to fetch active positions')
    }
  }

  async getRootPositions(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getRootPositions()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch root positions:', error)
      throw new Error('Unable to fetch root positions')
    }
  }

  async getChildPositions(parentId: string): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getChildPositions(parentId)
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch child positions:', error)
      throw new Error('Unable to fetch child positions')
    }
  }

  async bulkDeletePositions(positionIds: string[]): Promise<boolean> {
    try {
      await positionApi.bulkDeletePositions(positionIds)
      
      // Clear positions cache since we deleted multiple positions
      this.clearPositionsCache()
      
      return true
    } catch (error) {
      console.error('Failed to bulk delete positions:', error)
      throw new Error('Unable to bulk delete positions')
    }
  }

  async getPositionStatistics(): Promise<any> {
    try {
      return await positionApi.getPositionStatistics()
    } catch (error) {
      console.error('Failed to fetch position statistics:', error)
      throw new Error('Unable to fetch position statistics')
    }
  }

  async searchPositions(query: string): Promise<Position[]> {
    try {
      const positions = await this.getPositions()
      const lowercaseQuery = query.toLowerCase()
      return positions.filter(
        (pos) =>
          pos.name.toLowerCase().includes(lowercaseQuery) ||
          (pos.description && pos.description.toLowerCase().includes(lowercaseQuery))
      )
    } catch (error) {
      console.error('Failed to search positions:', error)
      throw new Error('Unable to search positions')
    }
  }

  // Vehicle operations
  async getVehicles(page: number = 0, size: number = 10, sort: string = 'createdAt', direction: string = 'desc'): Promise<{
    vehicles: Vehicle[]
    totalElements: number
    totalPages: number
    currentPage: number
    pageSize: number
  }> {
    try {
      return await vehicleApi.getAllVehiclesPaginated(page, size, sort, direction)
    } catch (error) {
      console.error('Failed to fetch vehicles from API, falling back to mock data:', error)
      // Calculate pagination for mock data
      const startIndex = page * size
      const endIndex = startIndex + size
      const paginatedVehicles = this.vehicles.slice(startIndex, endIndex)
      
      return {
        vehicles: paginatedVehicles,
        totalElements: this.vehicles.length,
        totalPages: Math.ceil(this.vehicles.length / size),
        currentPage: page,
        pageSize: size
      }
    }
  }

  async getVehicles(page: number = 0, size: number = 10, sort: string = 'updatedAt', direction: string = 'desc'): Promise<{
    vehicles: Vehicle[]
    totalElements: number
    totalPages: number
    currentPage: number
  }> {
    try {
      const response = await vehicleApi.getAllVehicles(page, size, sort, direction)
      return {
        vehicles: response.content,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        currentPage: response.number
      }
    } catch (error) {
      console.error('Failed to fetch vehicles from API, falling back to mock data:', error)
      // Fallback to mock data with pagination simulation
      const startIndex = page * size
      const endIndex = startIndex + size
      const paginatedVehicles = this.vehicles.slice(startIndex, endIndex)
      
      return {
        vehicles: paginatedVehicles,
        totalElements: this.vehicles.length,
        totalPages: Math.ceil(this.vehicles.length / size),
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
        year: vehicle.year,
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        status: vehicle.status,
        registrationDate: vehicle.registrationDate,
        notes: vehicle.notes,
      })
      
      // Return the vehicle from the response
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

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
    try {
      const existingVehicle = await this.getVehicle(id)
      if (!existingVehicle) return null

      const updatedData = {
        employeeId: updates.employeeId || existingVehicle.employeeId,
        employeeName: updates.employeeName || existingVehicle.employeeName,
        licensePlate: updates.licensePlate || existingVehicle.licensePlate,
        vehicleType: updates.vehicleType || existingVehicle.vehicleType,
        brand: updates.brand || existingVehicle.brand,
        model: updates.model || existingVehicle.model,
        year: updates.year || existingVehicle.year,
        color: updates.color || existingVehicle.color,
        fuelType: updates.fuelType || existingVehicle.fuelType,
        status: updates.status || existingVehicle.status,
        registrationDate: updates.registrationDate || existingVehicle.registrationDate,
        lastMaintenanceDate: updates.lastMaintenanceDate || existingVehicle.lastMaintenanceDate,
        nextMaintenanceDate: updates.nextMaintenanceDate || existingVehicle.nextMaintenanceDate,
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

  // Vehicle Statistics operations
  async getVehicleStatistics(): Promise<VehicleStatistics> {
    return await vehicleStatisticsApi.getVehicleStatistics()
  }

  // Vehicle Log operations
  async getEmployeeInfoByLicensePlate(licensePlateNumber: string, type: 'entry' | 'exit'): Promise<EmployeeVehicleInfo> {
    return await vehicleLogApi.getEmployeeInfoByLicensePlate(licensePlateNumber, type)
  }

}

export const dataService = new DataService()