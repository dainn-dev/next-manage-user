'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Vehicle, Employee } from '@/lib/types';
import { UserRole, canApprove, canManageVehicles } from '@/lib/types';
import { dataService } from '@/lib/data-service';
import { VehicleTable } from '@/components/vehicles/vehicle-table';
import { VehicleForm } from '@/components/vehicles/vehicle-form';
import { BulkOperationsDialog } from '@/components/vehicles/bulk-operations-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, RefreshCw, Trash2, Car, TrendingUp, CheckCircle, Settings, Filter, FileSpreadsheet, RotateCcw, Camera, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportVehiclesToExcel } from '@/lib/utils/excel-export';
import { useAuth } from '@/lib/auth-context';
import { DashboardMetricsSection } from '@/components/dashboard/dashboard-metrics-section';
import { AdminPage, AdminPageHeader } from '@/components/layout/admin-page';

export default function VehiclesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>();
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected' | 'exited' | 'entered'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorbike' | 'truck' | 'bus'>('all');
  const [filterVehicles, setFilterVehicles] = useState<Vehicle[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterLoadError, setFilterLoadError] = useState(false);
  const [filterRetryKey, setFilterRetryKey] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:8080/api/v1/yolo/detect-plate');

  // Mock data for demo
  useEffect(() => {
    const mockVehicles: Vehicle[] = [
      {
        id: '1',
        licensePlate: 'ABC 1234',
        vehicleType: 'car',
        entryTime: new Date().toISOString(),
        exitTime: null,
        status: 'entered',
        confidence: 0.92,
        plateConfidence: 0.85,
        imageUrl: '/placeholder.svg?height=400&width=600'
      },
      {
        id: '2',
        licensePlate: 'XYZ 5678',
        vehicleType: 'truck',
        entryTime: new Date(Date.now() - 3600000).toISOString(),
        exitTime: null,
        status: 'entered',
        confidence: 0.78,
        plateConfidence: 0.75,
        imageUrl: '/placeholder.svg?height=400&width=600'
      }
    ];
    setVehicles(mockVehicles);
    setTotalElements(mockVehicles.length);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive'
      });
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsDialogOpen(true);
  };

  const handleDetect = async () => {
    if (!imageFile) return;

    setIsDetecting(true);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      // Call backend API
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const result = await response.json();

      // Add to vehicles list
      const newVehicle: Vehicle = {
        id: Date.now().toString(),
        licensePlate: result.detections?.[0]?.plateText || `PLATE-${Date.now()}`,
        vehicleType: result.detections?.[0]?.className || 'car',
        entryTime: new Date().toISOString(),
        exitTime: null,
        status: 'entered',
        confidence: result.detections?.[0]?.confidence || 0.85,
        plateConfidence: result.detections?.[0]?.plateConfidence || 0.75,
        imageUrl: previewUrl || '/placeholder.svg?height=400&width=600'
      };

      setVehicles(prev => [newVehicle, ...prev]);
      setIsDialogOpen(false);
      setImageFile(null);
      setPreviewUrl(null);

      toast({
        title: 'Detection complete',
        description: `Detected vehicle: ${newVehicle.licensePlate}`,
      });

    } catch (error) {
      console.error('Detection error:', error);
      toast({
        title: 'Detection failed',
        description: 'Could not process the image. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getVehicleColor = (className: string) => {
    switch (className.toLowerCase()) {
      case 'car': return 'bg-blue-500';
      case 'truck': return 'bg-orange-500';
      case 'motorbike': return 'bg-purple-500';
      case 'bus': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getPlateStatus = (plateConfidence?: number) => {
    if (plateConfidence === undefined) return null;
    if (plateConfidence >= 0.8) return <Badge className="bg-green-500">Detected</Badge>;
    if (plateConfidence >= 0.5) return <Badge className="bg-yellow-500">Low confidence</Badge>;
    return <Badge variant="destructive">Not detected</Badge>;
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vehicles</h2>
          <p className="text-muted-foreground">
            Monitor vehicle entry and exit using AI-powered detection
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Camera className="h-4 w-4" />
            AI Detect
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalElements}</div>
            <p className="text-xs text-muted-foreground">+12 today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">87%</div>
            <Progress value={87} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">License Plates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">+5 today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">YOLO Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">YOLOv11n</div>
            <p className="text-xs text-muted-foreground">Ultralytics 11.0</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">98</div>
            <p className="text-xs text-muted-foreground">+8 today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trucks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Plates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">+5 today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Speed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">45 km/h</div>
            <p className="text-xs text-muted-foreground">+3 km/h today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">14:30</div>
            <p className="text-xs text-muted-foreground">Highest traffic</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">YOLO Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">96.5%</div>
            <Progress value={96.5} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="entered">Entered</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vehicle Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="truck">Truck</SelectItem>
              <SelectItem value="motorbike">Motorbike</SelectItem>
              <SelectItem value="bus">Bus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <VehicleTable vehicles={vehicles} onSelectVehicle={setSelectedVehicle} />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>AI Vehicle Detection</DialogTitle>
            <DialogDescription>
              Upload an image to detect vehicles and license plates using YOLOv11
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="image">Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isDetecting}
              />
            </div>

            {previewUrl && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isDetecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDetect}
              disabled={!imageFile || isDetecting}
              className="gap-2"
            >
              {isDetecting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Detect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}