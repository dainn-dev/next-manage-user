import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { QueryProvider } from '@/components/query-provider';
import { AuthProvider } from '@/lib/auth-context';
import { DashboardScopeProvider } from '@/lib/dashboard-scope-context';
import { DashboardDataProvider } from '@/lib/dashboard-data-context';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vehicle Management System',
  description: 'AI-powered vehicle detection and management system',
  keywords: 'vehicle, parking, license plate, detection, yolo, ai',
  openGraph: {
    title: 'Vehicle Management System',
    description: 'Real-time vehicle monitoring with AI detection',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <DashboardScopeProvider>
                <DashboardDataProvider>
                  <div className="relative flex min-h-screen flex-col">
                    <Header />
                    <main className="flex-1">
                      {children}
                    </main>
                  </div>
                  <Toaster />
                </DashboardDataProvider>
              </DashboardScopeProvider>
            </QueryProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}