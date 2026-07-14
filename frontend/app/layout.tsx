import type React from "react"
import { Fira_Sans, Fira_Code } from "next/font/google"
import "./globals.css"
import { ToasterWrapper } from "@/components/ui/toaster-wrapper"
import { AuthProvider } from "@/lib/auth-context"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { DashboardScopeProvider } from "@/lib/dashboard-scope-context"
import { DashboardDataProvider } from "@/lib/dashboard-data-context"

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
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
