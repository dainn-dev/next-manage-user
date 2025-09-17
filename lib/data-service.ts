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
import { mockEmployees, mockDepartments, mockAccessLevels, mockPositions } from "./mock-data"
import { vehicleApi } from "./api/vehicle-api"
import { employeeApi } from "./api/employee-api"
import { vehicleStatisticsApi } from "./api/vehicle-statistics-api"
import { departmentApi } from "./api/department-api"
import { positionApi } from "./api/position-api"

class DataService {
  private employees: Employee[] = [...mockEmployees]
  private departments: Department[] = [...mockDepartments]
  private accessLevels: AccessLevel[] = [...mockAccessLevels]
  private positions: Position[] = [...mockPositions]
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
    try {
      return await employeeApi.getAllEmployeesList()
    } catch (error) {
      console.error('Failed to fetch employees from API, falling back to mock data:', error)
      return this.employees
    }
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    try {
      const apiDepartments = await departmentApi.getAllDepartmentsList()
      return apiDepartments.map(dept => departmentApi.convertToDepartment(dept))
    } catch (error) {
      console.error('Failed to fetch departments from API, falling back to mock data:', error)
      return this.departments
    }
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    try {
      const apiDepartment = await departmentApi.getDepartmentById(id)
      return departmentApi.convertToDepartment(apiDepartment)
    } catch (error) {
      console.error('Failed to fetch department:', error)
      // Fallback to mock data
      return this.departments.find((dept) => dept.id === id)
    }
  }

  async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    try {
      const apiRequest = departmentApi.convertToApiRequest({
        ...department,
        id: '',
        createdAt: '',
        updatedAt: '',
      } as Department)
      const apiResponse = await departmentApi.createDepartment(apiRequest)
      return departmentApi.convertToDepartment(apiResponse)
    } catch (error) {
      console.error('Failed to create department:', error)
      // Fallback to mock data behavior
      const newDepartment: Department = {
        ...department,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.departments.push(newDepartment)
      return newDepartment
    }
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department | null> {
    try {
      const existingDepartment = await this.getDepartment(id)
      if (!existingDepartment) return null

      const updatedDepartment = { ...existingDepartment, ...updates }
      const apiRequest = departmentApi.convertToApiRequest(updatedDepartment)
      const apiResponse = await departmentApi.updateDepartment(id, { ...apiRequest, id })
      return departmentApi.convertToDepartment(apiResponse)
    } catch (error) {
      console.error('Failed to update department:', error)
      // Fallback to mock data behavior
      const index = this.departments.findIndex((dept) => dept.id === id)
      if (index === -1) return null

      this.departments[index] = {
        ...this.departments[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return this.departments[index]
    }
  }

  async deleteDepartment(id: string): Promise<boolean> {
    try {
      await departmentApi.deleteDepartment(id)
      return true
    } catch (error) {
      console.error('Failed to delete department:', error)
      // Fallback to mock data behavior
      const index = this.departments.findIndex((dept) => dept.id === id)
      if (index === -1) return false

      this.departments.splice(index, 1)
      return true
    }
  }

  async getDepartmentEmployees(departmentId: string): Promise<Employee[]> {
    try {
      return await departmentApi.getDepartmentEmployees(departmentId)
    } catch (error) {
      console.error('Failed to fetch department employees:', error)
      // Fallback to filtering mock employees by department name
      const department = this.departments.find(d => d.id === departmentId)
      if (department) {
        return this.employees.filter(emp => emp.department === department.name)
      }
      return []
    }
  }

  async getDepartmentStatistics(): Promise<DepartmentStatistics> {
    try {
      return await departmentApi.getDepartmentStatistics()
    } catch (error) {
      console.error('Failed to fetch department statistics:', error)
      // Fallback to calculated statistics
      const total = this.departments.length
      const totalEmployees = this.departments.reduce((sum, dept) => sum + dept.employeeCount, 0)
      const avgEmployees = total > 0 ? totalEmployees / total : 0
      
      const largest = this.departments.reduce((max, dept) => 
        dept.employeeCount > max.employeeCount ? dept : max, this.departments[0] || { name: '', employeeCount: 0 })

      return {
        totalDepartments: total,
        totalEmployees,
        averageEmployeesPerDepartment: Math.round(avgEmployees),
        largestDepartment: {
          name: largest.name,
          employeeCount: largest.employeeCount,
        },
      }
    }
  }

  searchDepartments(query: string): Department[] {
    const lowercaseQuery = query.toLowerCase()
    return this.departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(lowercaseQuery) ||
        (dept.description && dept.description.toLowerCase().includes(lowercaseQuery))
    )
  }

  // Access level operations
  getAccessLevels(): AccessLevel[] {
    return this.accessLevels
  }

  // Position operations
  async getPositions(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getAllPositionsList()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch positions:', error)
      // Fallback to mock data
      return this.positions
    }
  }

  async getPositionsWithParent(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getPositionsWithParent()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch positions with parent:', error)
      // Fallback to regular positions
      return this.getPositions()
    }
  }

  async getPosition(id: string): Promise<Position | undefined> {
    try {
      const apiPosition = await positionApi.getPositionById(id)
      return positionApi.convertToPosition(apiPosition)
    } catch (error) {
      console.error('Failed to fetch position:', error)
      // Fallback to mock data
      return this.positions.find((pos) => pos.id === id)
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
      return positionApi.convertToPosition(apiResponse)
    } catch (error) {
      console.error('Failed to create position:', error)
      // Fallback to mock data behavior
      const newPosition: Position = {
        ...position,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        childrenCount: 0,
      }
      this.positions.push(newPosition)
      return newPosition
    }
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | null> {
    try {
      const existingPosition = await this.getPosition(id)
      if (!existingPosition) return null

      const updatedPosition = { ...existingPosition, ...updates }
      const apiRequest = positionApi.convertToApiRequest(updatedPosition)
      const apiResponse = await positionApi.updatePosition(id, { ...apiRequest, id })
      return positionApi.convertToPosition(apiResponse)
    } catch (error) {
      console.error('Failed to update position:', error)
      // Fallback to mock data behavior
      const index = this.positions.findIndex((pos) => pos.id === id)
      if (index === -1) return null

      this.positions[index] = {
        ...this.positions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return this.positions[index]
    }
  }

  async deletePosition(id: string): Promise<boolean> {
    try {
      await positionApi.deletePosition(id)
      return true
    } catch (error) {
      console.error('Failed to delete position:', error)
      // Fallback to mock data behavior
      const index = this.positions.findIndex((pos) => pos.id === id)
      if (index === -1) return false

      this.positions.splice(index, 1)
      return true
    }
  }

  async getPositionsByLevel(level: string): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getPositionsByLevel(level)
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch positions by level:', error)
      return this.positions.filter(pos => pos.level === level)
    }
  }

  async getActivePositions(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getAllActivePositions()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch active positions:', error)
      return this.positions.filter(pos => pos.isActive)
    }
  }

  async getRootPositions(): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getRootPositions()
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch root positions:', error)
      return this.positions.filter(pos => !pos.parentId)
    }
  }

  async getChildPositions(parentId: string): Promise<Position[]> {
    try {
      const apiPositions = await positionApi.getChildPositions(parentId)
      return apiPositions.map(pos => positionApi.convertToPosition(pos))
    } catch (error) {
      console.error('Failed to fetch child positions:', error)
      return this.positions.filter(pos => pos.parentId === parentId)
    }
  }

  async bulkDeletePositions(positionIds: string[]): Promise<boolean> {
    try {
      await positionApi.bulkDeletePositions(positionIds)
      return true
    } catch (error) {
      console.error('Failed to bulk delete positions:', error)
      // Fallback to individual deletes
      for (const id of positionIds) {
        await this.deletePosition(id)
      }
      return true
    }
  }

  async getPositionStatistics(): Promise<any> {
    try {
      return await positionApi.getPositionStatistics()
    } catch (error) {
      console.error('Failed to fetch position statistics:', error)
      // Fallback to calculated statistics
      const total = this.positions.length
      const active = this.positions.filter(pos => pos.isActive).length
      const inactive = total - active
      const root = this.positions.filter(pos => !pos.parentId).length
      
      const byLevel: Record<string, number> = {}
      this.positions.forEach(pos => {
        byLevel[pos.levelDisplayName || pos.level] = (byLevel[pos.levelDisplayName || pos.level] || 0) + 1
      })

      return {
        totalPositions: total,
        activePositions: active,
        inactivePositions: inactive,
        rootPositions: root,
        positionsByLevel: byLevel,
      }
    }
  }

  searchPositions(query: string): Position[] {
    const lowercaseQuery = query.toLowerCase()
    return this.positions.filter(
      (pos) =>
        pos.name.toLowerCase().includes(lowercaseQuery) ||
        (pos.description && pos.description.toLowerCase().includes(lowercaseQuery))
    )
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
      return await vehicleApi.createVehicle({
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
        lastMaintenanceDate: vehicle.lastMaintenanceDate,
        nextMaintenanceDate: vehicle.nextMaintenanceDate,
        notes: vehicle.notes,
      })
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

}

export const dataService = new DataService()