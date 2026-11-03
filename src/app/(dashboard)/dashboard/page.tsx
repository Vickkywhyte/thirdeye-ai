import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DashboardSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard — ThirdEye AI',
}

function DashboardContent() {
  return (
    <EmptyState
      icon={undefined}
      title="Welcome to ThirdEye AI"
      description="Your due diligence command centre. Start by creating an investigation to screen entities against global databases."
      action={
        <Button asChild>
          <Link href="/investigations">Start Investigation</Link>
        </Button>
      }
    />
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your due diligence activity
        </p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
