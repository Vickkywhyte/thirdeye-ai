'use client'

import { useEffect, useState } from 'react'
import { formatDateTime, relativeTime, formatDate } from '@/lib/utils/formatting'

type Variant = 'datetime' | 'relative' | 'date'

export function ClientDate({
  date,
  variant = 'datetime',
  pattern,
}: {
  date: string | Date
  variant?: Variant
  pattern?: string
}) {
  const [display, setDisplay] = useState<string>('')

  useEffect(() => {
    switch (variant) {
      case 'relative':
        setDisplay(relativeTime(date))
        break
      case 'date':
        setDisplay(formatDate(date, pattern))
        break
      default:
        setDisplay(formatDateTime(date))
    }
  }, [date, variant, pattern])

  if (!display) return null

  return <>{display}</>
}
