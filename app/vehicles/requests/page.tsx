"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RefreshCw, Check, X, ClipboardList, Clock, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { canApprove } from "@/lib/types"
import { accessRequestApi, type AccessRequest, type AccessRequestStatus } from "@/lib/api/access-request-api"

export default function VehicleRequestsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const userCanApprove = canApprove(user?.role)

  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [userCanApprove])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const data = userCanApprove
        ? await accessRequestApi.getAllRequests()
        : await accessRequestApi.getMyRequests()
      setRequests(data)
    } catch (err) {
      console.error('Error loading requests:', err)
      toast({
        variant: "destructive",
        title: "Lỗi tải dữ liệu",
        description: "Không thể tải danh sách yêu cầu. Vui lòng thử lại.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request: AccessRequest) => {
    setActionLoading(true)
    try {
      const updated = await accessRequestApi.approveRequest(request.id)
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
      toast({
        title: "Đã duyệt",
        description: `Yêu cầu của ${request.requesterName} đã được chấp thuận.`,
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể duyệt yêu cầu.",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const openRejectDialog = (request: AccessRequest) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) return
    setActionLoading(true)
    try {
      const updated = await accessRequestApi.rejectRequest(selectedRequest.id, rejectionReason.trim())
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
      toast({
        title: "Đã từ chối",
        description: `Yêu cầu của ${selectedRequest.requesterName} đã bị từ chối.`,
      })
      setRejectDialogOpen(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể từ chối yêu cầu.",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async (request: AccessRequest) => {
    setActionLoading(true)
    try {
      const updated = await accessRequestApi.cancelRequest(request.id)
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
      toast({
        title: "Đã hủy",
        description: "Yêu cầu đã được hủy.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể hủy yêu cầu.",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: AccessRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Chờ duyệt</Badge>
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Đã duyệt</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800">Từ chối</Badge>
      case 'CANCELLED':
        return <Badge variant="outline" className="text-gray-600">Đã hủy</Badge>
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('vi-VN')
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải yêu cầu...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Yêu cầu ra vào</h1>
          <p className="text-muted-foreground text-lg">
            {userCanApprove
              ? "Quản lý và xét duyệt các yêu cầu ra vào phương tiện"
              : "Danh sách yêu cầu ra vào của bạn"}
          </p>
        </div>
        <Button onClick={loadRequests} variant="outline" className="shadow-sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ duyệt</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Từ chối</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Danh sách yêu cầu</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Biển số xe</TableHead>
                {userCanApprove && <TableHead>Người yêu cầu</TableHead>}
                <TableHead>Ngày yêu cầu</TableHead>
                <TableHead>Hiệu lực từ</TableHead>
                <TableHead>Hiệu lực đến</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
                {userCanApprove && <TableHead>Người duyệt</TableHead>}
                <TableHead className="w-40">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={userCanApprove ? 9 : 7} className="text-center py-8 text-muted-foreground">
                    Không có yêu cầu nào
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono font-semibold">{request.vehicleLicensePlate || '—'}</TableCell>
                    {userCanApprove && <TableCell>{request.requesterName || '—'}</TableCell>}
                    <TableCell className="text-sm">{formatDate(request.createdAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(request.validFrom)}</TableCell>
                    <TableCell className="text-sm">{formatDate(request.validTo)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={request.requestReason}>
                      {request.requestReason}
                    </TableCell>
                    <TableCell>
                      <div>
                        {getStatusBadge(request.status)}
                        {request.status === 'REJECTED' && request.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1">{request.rejectionReason}</p>
                        )}
                      </div>
                    </TableCell>
                    {userCanApprove && <TableCell className="text-sm">{request.approverName || '—'}</TableCell>}
                    <TableCell>
                      {userCanApprove && request.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request)}
                            disabled={actionLoading}
                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(request)}
                            disabled={actionLoading}
                            className="h-7 px-2"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                      {!userCanApprove && request.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(request)}
                          disabled={actionLoading}
                          className="h-7 px-2"
                        >
                          Hủy
                        </Button>
                      )}
                      {request.status !== 'PENDING' && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Từ chối yêu cầu của <strong>{selectedRequest?.requesterName}</strong> cho xe{" "}
              <strong>{selectedRequest?.vehicleLicensePlate}</strong>.
            </p>
            <div>
              <Label htmlFor="rejectionReason">Lý do từ chối *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading}
            >
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
