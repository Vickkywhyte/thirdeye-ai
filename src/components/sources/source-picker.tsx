'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  AUTHORITY_TIERS,
  SOURCE_TYPES,
  type AuthorityTier,
  type SourceType,
} from '@/lib/validation/schemas'

export type Source = {
  id: string
  source_type: SourceType
  source_name: string
  source_url: string | null
  authority_tier: AuthorityTier
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  registry: 'Registry',
  sanctions: 'Sanctions',
  pep: 'PEP',
  media: 'Media',
  llm: 'LLM',
  manual: 'Manual',
}

const TIER_LABELS: Record<AuthorityTier, string> = {
  tier_1: 'Tier 1 — Primary / regulator',
  tier_2: 'Tier 2 — Established secondary',
  tier_3: 'Tier 3 — Other / analyst-attached',
}

const TIER_BADGE_STYLES: Record<AuthorityTier, string> = {
  tier_1: 'bg-risk-low/15 text-risk-low',
  tier_2: 'bg-accent-blue/15 text-accent-blue',
  tier_3: 'bg-muted text-muted-foreground',
}

interface Props {
  id?: string
  value: string | null
  onChange: (next: string | null) => void
  required?: boolean
  disabled?: boolean
}

export function SourcePicker({ id, value, onChange, required, disabled }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const loadSources = useCallback(async () => {
    const res = await fetch('/api/sources?limit=200')
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to load sources')
    }
    const json = await res.json()
    return (json.data?.sources as Source[]) ?? []
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadSources()
      .then((next) => {
        if (controller.signal.aborted) return
        setSources(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load sources')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadSources])

  async function refresh() {
    try {
      const next = await loadSources()
      setSources(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload sources')
    }
  }

  function onSourceCreated(created: Source) {
    setSources((prev) => [created, ...prev.filter((s) => s.id !== created.id)])
    onChange(created.id)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Select
            value={value ?? ''}
            onValueChange={(v) => onChange(v || null)}
            disabled={disabled || loading}
          >
            <SelectTrigger id={id}>
              <SelectValue
                placeholder={loading ? 'Loading sources…' : 'Select evidence source…'}
              />
            </SelectTrigger>
            <SelectContent>
              {sources.length === 0 && !loading && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No sources yet — add one with the + button.
                </div>
              )}
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        TIER_BADGE_STYLES[s.authority_tier]
                      )}
                    >
                      {s.authority_tier.replace('_', ' ')}
                    </span>
                    <span className="truncate">{s.source_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setAddOpen(true)}
          disabled={disabled}
          aria-label="Add source"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {required && !value && (
        <p className="text-xs text-muted-foreground">
          A source is required for provenance.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <AddSourceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={onSourceCreated}
        onRefresh={refresh}
      />
    </div>
  )
}

function AddSourceDialog({
  open,
  onOpenChange,
  onCreated,
  onRefresh,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (s: Source) => void
  onRefresh: () => void | Promise<void>
}) {
  const [sourceType, setSourceType] = useState<SourceType>('manual')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [authorityTier, setAuthorityTier] = useState<AuthorityTier>('tier_3')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setSourceType('manual')
    setSourceName('')
    setSourceUrl('')
    setAuthorityTier('tier_3')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit() {
    if (!sourceName.trim()) {
      setError('Source name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_name: sourceName.trim(),
          source_url: sourceUrl.trim() ? sourceUrl.trim() : null,
          authority_tier: authorityTier,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to add source.')
        return
      }
      onCreated(json.data as Source)
      await onRefresh()
      handleOpenChange(false)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Evidence Source</DialogTitle>
          <DialogDescription>
            Create a provenance record you can cite from decisions, EDD
            assessments, and reviews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="source-type">Type</Label>
            <Select
              value={sourceType}
              onValueChange={(v) => setSourceType(v as SourceType)}
            >
              <SelectTrigger id="source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SOURCE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-name">Name</Label>
            <Input
              id="source-name"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. OFAC SDN list, 2026-11-24 pull"
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-url">
              URL <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-tier">Authority Tier</Label>
            <Select
              value={authorityTier}
              onValueChange={(v) => setAuthorityTier(v as AuthorityTier)}
            >
              <SelectTrigger id="source-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTHORITY_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !sourceName.trim()}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Add Source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
