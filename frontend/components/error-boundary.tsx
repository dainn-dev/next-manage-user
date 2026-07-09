"use client"

import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
}

/**
 * React Error Boundary for pages that load data via DataService.
 *
 * Catches uncaught errors thrown during rendering (e.g. when a page tries to
 * render before its data has loaded, or when a re-thrown API error escapes the
 * page's own try/catch). In production, DataService re-throws API errors
 * instead of silently returning mock data, so an unhandled failure surfaces
 * here as a "cannot load data" UI with a retry button instead of stale mock
 * data being rendered to the user.
 *
 * Note: Error boundaries do NOT catch errors from async event handlers or
 * effects directly — those are expected to be handled by each page's own
 * try/catch + toast. This boundary is the safety net for anything that escapes.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleRetry = (): void => {
    this.props.onReset?.()
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }))
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      return (
        <div className="p-8 bg-background min-h-screen">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="space-y-1">
                <p className="text-red-600 font-medium text-lg">
                  Không tải được dữ liệu
                </p>
                <p className="text-muted-foreground text-sm">
                  Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.
                </p>
              </div>
              <Button
                onClick={this.handleRetry}
                variant="outline"
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Thử lại
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Re-mount children on retry so their data-loading effects re-run.
    return (
      <React.Fragment key={this.state.retryCount}>
        {this.props.children}
      </React.Fragment>
    )
  }
}
