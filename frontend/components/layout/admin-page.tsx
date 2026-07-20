import { Fragment, type ComponentPropsWithoutRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type AdminPageSize = "narrow" | "default" | "wide" | "full"

const pageSizes: Record<AdminPageSize, string> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[104rem]",
  full: "max-w-none",
}

export interface AdminPageProps extends ComponentPropsWithoutRef<"div"> {
  size?: AdminPageSize
}

export function AdminPage({
  children,
  className,
  size = "wide",
  ...props
}: AdminPageProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-full w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-5 sm:py-6 md:gap-6 xl:px-6 xl:py-7",
        "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
        pageSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface AdminPageHeaderAction {
  /** A stable key when the actions are generated from data. */
  key: string
  content: ReactNode
}

export interface AdminPageHeaderMetaProps extends ComponentPropsWithoutRef<"div"> {
  label: ReactNode
  value: ReactNode
}

/** A compact, consistent read-only value for a page-header action row. */
export function AdminPageHeaderMeta({
  className,
  label,
  value,
  ...props
}: AdminPageHeaderMetaProps) {
  return (
    <div
      className={cn(
        "flex min-h-11 min-w-36 flex-col justify-center rounded-[var(--radius-input)] border border-border bg-muted/60 px-3 text-sm shadow-xs",
        className,
      )}
      {...props}
    >
      <span className="text-xs font-medium leading-4 text-muted-foreground">{label}</span>
      <span className="mt-0.5 text-sm font-semibold leading-5 text-foreground">{value}</span>
    </div>
  )
}

/**
 * The shared page heading for admin views. Prefer `actionList` for a list of
 * independent controls; `actions` remains available for composed layouts.
 */
export interface AdminPageHeaderProps
  extends Omit<ComponentPropsWithoutRef<"header">, "children" | "title"> {
  /** Independent controls rendered in the responsive page action row. */
  actionList?: readonly AdminPageHeaderAction[]
  actions?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function AdminPageHeader({
  actionList,
  actions,
  className,
  description,
  eyebrow,
  title,
  ...props
}: AdminPageHeaderProps) {
  const hasActions = Boolean(actions) || Boolean(actionList?.length)

  return (
    <header
      className={cn(
        "grid min-w-0 gap-4 rounded-[var(--radius-sheet)] border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)] sm:gap-5 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-balance font-[family:var(--font-display)] text-[1.375rem] font-bold leading-7 tracking-[-0.025em] text-foreground sm:text-[1.75rem] sm:leading-8 sm:tracking-[-0.035em]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-pretty text-sm leading-5 text-muted-foreground sm:mt-2 sm:text-[0.9375rem] sm:leading-6">
            {description}
          </p>
        )}
      </div>
      {hasActions && (
        <div
          className="admin-action-row grid min-w-0 grid-cols-1 gap-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-end [&_[data-slot=button]]:!min-h-11 [&_[data-slot=button]]:!min-w-11 [&_[data-slot=button]]:!rounded-[var(--radius-input)] [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:w-auto md:[&_[data-slot=button]]:!min-h-10 md:[&_[data-slot=button]]:!min-w-10"
          aria-label="Thao tác trang"
          role="group"
        >
          {actions}
          {actionList?.map((action) => (
            <Fragment key={action.key}>{action.content}</Fragment>
          ))}
        </div>
      )}
    </header>
  )
}

interface AdminSectionHeaderProps {
  action?: ReactNode
  className?: string
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function AdminSectionHeader({
  action,
  className,
  description,
  eyebrow,
  title,
}: AdminSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-[1rem] font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            {description}
          </p>
        )}
      </div>
      {action && <div className="admin-action-row grid min-w-0 grid-cols-1 gap-2 sm:flex sm:shrink-0 sm:justify-end [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:w-auto">{action}</div>}
    </div>
  )
}

interface AdminToolbarProps {
  children: ReactNode
  className?: string
}

export function AdminToolbar({ children, className }: AdminToolbarProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/75 bg-card/85 p-3 shadow-[var(--shadow-card)] sm:flex sm:flex-wrap sm:items-end [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:w-auto [&_[data-slot=input]]:w-full [&_[data-slot=select-trigger]]:w-full sm:[&_[data-slot=select-trigger]]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface AdminEmptyStateProps {
  action?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
}

export function AdminEmptyState({
  action,
  className,
  description,
  icon,
  title,
}: AdminEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/75 p-6 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="admin-action-row grid w-full max-w-sm grid-cols-1 gap-2 sm:w-auto sm:max-w-none sm:flex [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:w-auto">{action}</div>}
    </div>
  )
}

export const PageContainer = AdminPage
export const PageHeader = AdminPageHeader
