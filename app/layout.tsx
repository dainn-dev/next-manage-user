import type React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { ToasterWrapper } from "@/components/ui/toaster-wrapper"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-white">{children}</main>
        </div>
        <ToasterWrapper />
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
