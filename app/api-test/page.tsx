"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, CheckCircle, XCircle } from "lucide-react"
import { employeeApi, EmployeeStatistics } from "@/lib/api/employee-api"
import { useToast } from "@/hooks/use-toast"

export default function ApiTestPage() {
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<"idle" | "success" | "error">("idle")
  const [lastTest, setLastTest] = useState<string>("")
  const { toast } = useToast()

  const testApiConnection = async () => {
    setIsLoading(true)
    setApiStatus("idle")
    
    try {
      // Test basic connection by getting employee count
      const stats = await employeeApi.getEmployeeStatistics()
      setStatistics(stats)
      setApiStatus("success")
      setLastTest(new Date().toLocaleTimeString())
      
      toast({
        title: "Thành công",
        description: "Kết nối API thành công!",
      })
    } catch (error) {
      console.error("API Test Error:", error)
      setApiStatus("error")
      setLastTest(new Date().toLocaleTimeString())
      
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến API backend",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testEmployeeValidation = async () => {
    try {
      const isValid = await employeeApi.validateEmployeeId("EMP001")
      console.log("Employee ID validation result:", isValid)
      
      const exists = await employeeApi.checkEmployeeIdExists("EMP001")
      console.log("Employee ID exists:", exists)
      
      toast({
        title: "Kiểm tra validation",
        description: `Employee ID validation: ${isValid ? "Valid" : "Invalid"}, Exists: ${exists}`,
      })
    } catch (error) {
      console.error("Validation test error:", error)
      toast({
        title: "Lỗi validation",
        description: "Không thể kiểm tra validation",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = () => {
    switch (apiStatus) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Users className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (apiStatus) {
      case "success":
        return "bg-green-100 text-green-800"
      case "error":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Integration Test</h1>
          <p className="text-gray-600">Test frontend API integration with backend services</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-1">
              {apiStatus === "success" ? "Connected" : 
               apiStatus === "error" ? "Error" : "Not Tested"}
            </span>
          </Badge>
          {lastTest && (
            <span className="text-sm text-gray-500">Last test: {lastTest}</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Connection Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              API Connection Test
            </CardTitle>
            <CardDescription>
              Test connection to employee API endpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testApiConnection} 
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Test API Connection
            </Button>
            
            <Button 
              onClick={testEmployeeValidation} 
              variant="outline"
              className="w-full"
            >
              Test Validation Endpoints
            </Button>
          </CardContent>
        </Card>

        {/* Statistics Display */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Statistics</CardTitle>
            <CardDescription>
              Real-time data from backend API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statistics ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Employees:</span>
                  <Badge variant="secondary">{statistics.totalEmployees}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Active:</span>
                  <Badge className="bg-green-100 text-green-800">{statistics.activeEmployees}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Inactive:</span>
                  <Badge className="bg-yellow-100 text-yellow-800">{statistics.inactiveEmployees}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Terminated:</span>
                  <Badge className="bg-red-100 text-red-800">{statistics.terminatedEmployees}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">New This Month:</span>
                  <Badge variant="outline">{statistics.newEmployeesThisMonth}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                {isLoading ? "Loading..." : "No data available. Test API connection first."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available API Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Available API Endpoints</CardTitle>
          <CardDescription>
            Complete list of employee management API endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Basic CRUD Operations</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• GET /api/employees - Get all employees (paginated)</li>
                <li>• GET /api/employees/list - Get all employees (list)</li>
                <li>• GET /api/employees/{id} - Get employee by ID</li>
                <li>• POST /api/employees - Create new employee</li>
                <li>• PUT /api/employees/{id} - Update employee</li>
                <li>• DELETE /api/employees/{id} - Delete employee</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Advanced Operations</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• POST /api/employees/bulk-delete - Bulk delete</li>
                <li>• PUT /api/employees/bulk-update-status - Bulk status update</li>
                <li>• PUT /api/employees/bulk-update-department - Bulk department update</li>
                <li>• POST /api/employees/{id}/upload-image - Upload image</li>
                <li>• GET /api/employees/stats/overview - Get statistics</li>
                <li>• GET /api/employees/exists/* - Validation endpoints</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
