'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  Camera,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from '@/hooks/use-toast';

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-4">
          <Link href="/vehicles" className="flex items-center gap-2 font-semibold">
            <Car className="h-6 w-6" />
            <span className="hidden md:inline">Vehicle Management</span>
          </Link>

          <nav className="hidden md:flex gap-6">
            <Link
              href="/vehicles"
              className={`text-sm font-medium ${isActive('/vehicles') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
              Vehicles
            </Link>
            <Link
              href="/dashboard"
              className={`text-sm font-medium ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
              Dashboard
            </Link>
            <Link
              href="/parking"
              className={`text-sm font-medium ${isActive('/parking') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
              Parking
            </Link>
            <Link
              href="/gate"
              className={`text-sm font-medium ${isActive('/gate') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
              Gate
            </Link>
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              3
            </span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {user?.name?.[0] || 'A'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium">{user?.name || 'Operator'}</div>
                  <div className="text-xs text-muted-foreground">{user?.role || 'operator'}</div>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Moon className="mr-2 h-4 w-4" />
                Dark Mode
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}