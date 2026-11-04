'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface InvestigationOption {
  id: string
  entity_name: string
  status: string
}

const TEMPLATES = [
  { value: 'standard_dd', label: 'Full Due Diligence' },
  { value: 'enhanced_dd', label: 'Enhanced Due Diligence' },
  { value: 'sanctions_alert', label: 'Screening Summary' },
  { value: 'periodic_review', label: 'Adverse Media Only' },
] as const

function formatDateShort(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function NewReportPage() {
  const router = useRouter()
  const [investigations, setInvestigations] = useState<InvestigationOption[]>([])
  const [selectedInvestigation, setSelectedInvestigation] = useState('')
  const [template, setTemplate] = useState('standard_dd')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/investigations?limit=100&search=${encodeURIComponent(search)}`)
        if (res.ok) {
          const json = await res.json()
          const items = (json.data?.investigations ?? json.data ?? []) as Array<{
            id: string
            entity: { name: string } | null
            status: string
          }>
          setInvestigations(
            items.map((i) => ({
              id: i.id,
              entity_name: i.entity?.name ?? 'Unknown entity',
              status: i.status,
            }))
          )
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [search])

  function handleInvestigationChange(id: string) {
    setSelectedInvestigation(id)
    const inv = investigations.find((i) => i.id === id)
    if (inv && !title) {
      setTitle(`${inv.entity_name} — ${formatDateShort()}`)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedInvestigation || !title) {
      setError('Please select an investigation and provide a title')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigationId: selectedInvestigation,
          template,
          title,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create report')
        return
      }

      router.push('/reports')
    } catch {
      setError('Failed to create report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Report</h1>
        <p className="text-muted-foreground">
          Generate a due diligence report from an investigation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>
            Select an investigation and report template
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Investigation</Label>
              <Input
                placeholder="Search investigations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={selectedInvestigation}
                onValueChange={handleInvestigationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an investigation" />
                </SelectTrigger>
                <SelectContent>
                  {investigations.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.entity_name} ({inv.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Report Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Report Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Acme Corp — Full DD Report"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Report'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
