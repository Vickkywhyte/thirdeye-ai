import { FileText, Search, ShieldAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  investigations: {
    icon: Search,
    title: 'No investigations yet',
    description:
      'Create your first investigation to start screening entities for risk.',
  },
  reports: {
    icon: FileText,
    title: 'No reports generated',
    description:
      'Reports will appear here once investigations are completed.',
  },
  screening: {
    icon: ShieldAlert,
    title: 'No screening results',
    description:
      'Run a screening against sanctions, PEP, and adverse media databases.',
  },
} as const

type EmptyStateVariant = keyof typeof VARIANTS

interface EmptyStateProps {
  variant?: EmptyStateVariant
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  variant,
  icon: IconOverride,
  title: titleOverride,
  description: descriptionOverride,
  action,
  className,
}: EmptyStateProps) {
  const preset = variant ? VARIANTS[variant] : null
  const Icon = IconOverride ?? preset?.icon ?? Search
  const title = titleOverride ?? preset?.title ?? 'Nothing here yet'
  const description = descriptionOverride ?? preset?.description

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
