import type React from "react"
import { Noto_Sans } from "next/font/google"
import "./globals.css"
import { ToasterWrapper } from "@/components/ui/toaster-wrapper"
import { AuthProvider } from "@/lib/auth-context"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { DashboardScopeProvider } from "@/lib/dashboard-scope-context"
import { DashboardDataProvider } from "@/lib/dashboard-data-context"

const notoSans = Noto_Sans({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={notoSans.variable}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
          <AuthProvider>
            <DashboardScopeProvider>
              <DashboardDataProvider>
                <ProtectedLayout>{children}</ProtectedLayout>
              </DashboardDataProvider>
            </DashboardScopeProvider>
          </AuthProvider>
          <ToasterWrapper />
        </ThemeProvider>
      </body>
    </html>
  )
}

export const metadata = {
  title: "ParkVision — Smart Parking 4.0",
  description:
    "Multi-tenant SaaS smart parking: nhận diện biển số, map ô đỗ, relocation alert, AI chatbot. Một dashboard cho mọi bãi xe.",
  generator: "v0.app",
}
