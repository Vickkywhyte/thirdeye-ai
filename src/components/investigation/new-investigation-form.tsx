'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, User } from 'lucide-react'
import {
  createInvestigationSchema,
  COUNTERPARTY_TYPES,
  type CreateInvestigationInput,
  type CounterpartyType,
} from '@/lib/validation/schemas'
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
import { cn } from '@/lib/utils'

export type SubjectMode = 'corporate' | 'individual'

/** Individual is handled by the mode toggle, so it isn't offered here. */
const CORPORATE_ENTITY_TYPES = [
  { value: 'company', label: 'Company' },
  { value: 'trust', label: 'Trust' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
] as const

const COUNTERPARTY_TYPE_LABELS: Record<CounterpartyType, string> = {
  merchant: 'Merchant',
  partner: 'Partner',
  psp: 'PSP',
  vendor: 'Vendor',
  respondent_institution: 'Respondent Institution',
  other: 'Other',
}
const NO_COUNTERPARTY_VALUE = '__none__'

const SCREENING_BY_MODE: Record<SubjectMode, string[]> = {
  // Companies House is company-only, so an individual skips the registry check.
  individual: ['sanctions', 'pep', 'adverse_media'],
  corporate: ['sanctions', 'pep', 'adverse_media', 'registry'],
}

export function NewInvestigationForm({
  initialMode = 'corporate',
  initialName = '',
  initialJurisdiction = '',
  initialRegistrationNumber = '',
  parentInvestigationId,
}: {
  initialMode?: SubjectMode
  initialName?: string
  initialJurisdiction?: string
  initialRegistrationNumber?: string
  parentInvestigationId?: string
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [mode, setMode] = useState<SubjectMode>(initialMode)
  const [counterpartyType, setCounterpartyType] =
    useState<CounterpartyType | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvestigationInput>({
    resolver: zodResolver(createInvestigationSchema),
    defaultValues: {
      entity_name: initialName,
      entity_type: initialMode === 'individual' ? 'individual' : 'company',
      jurisdiction: initialJurisdiction,
      registration_number: initialRegistrationNumber,
    },
  })

  function selectMode(next: SubjectMode) {
    setMode(next)
    setValue('entity_type', next === 'individual' ? 'individual' : 'company')
    if (next === 'individual') {
      // A natural person has no registration number.
      setValue('registration_number', '')
    }
  }

  async function onSubmit(data: CreateInvestigationInput) {
    setServerError(null)

    const payload: CreateInvestigationInput =
      mode === 'individual'
        ? {
            ...data,
            entity_type: 'individual',
            registration_number: undefined,
            parent_investigation_id: parentInvestigationId,
            counterparty_type: counterpartyType,
          }
        : {
            ...data,
            parent_investigation_id: parentInvestigationId,
            counterparty_type: counterpartyType,
          }

    const res = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setServerError(json?.error ?? 'Failed to create investigation')
      return
    }

    const json = await res.json()
    const investigationId = json.data.id

    fetch('/api/screening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investigation_id: investigationId,
        types: SCREENING_BY_MODE[mode],
      }),
    }).catch(() => {})

    router.push(`/investigations/${investigationId}`)
  }

  const isIndividual = mode === 'individual'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Investigation</h1>
        <p className="text-muted-foreground">
          Create a new due diligence investigation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isIndividual ? 'Individual Details' : 'Entity Details'}</CardTitle>
          <CardDescription>
            {isIndividual
              ? 'Screen a natural person against sanctions, PEP and adverse media sources'
              : 'Provide information about the entity to investigate'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Subject Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectMode('corporate')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors',
                    !isIndividual
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  Corporate Entity
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('individual')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors',
                    isIndividual
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <User className="h-4 w-4" />
                  Individual
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_name">
                {isIndividual ? 'Full Name' : 'Entity Name'}
              </Label>
              <Input
                id="entity_name"
                placeholder={isIndividual ? 'Jane Smith' : 'Acme Corporation Ltd'}
                {...register('entity_name')}
              />
              {errors.entity_name && (
                <p className="text-xs text-destructive">
                  {errors.entity_name.message}
                </p>
              )}
            </div>

            {!isIndividual && (
              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type</Label>
                <Select
                  defaultValue="company"
                  onValueChange={(v) =>
                    setValue(
                      'entity_type',
                      v as CreateInvestigationInput['entity_type']
                    )
                  }
                >
                  <SelectTrigger id="entity_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CORPORATE_ENTITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.entity_type && (
                  <p className="text-xs text-destructive">
                    {errors.entity_type.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">
                {isIndividual
                  ? 'Nationality / Country (optional)'
                  : 'Jurisdiction (optional)'}
              </Label>
              <Input
                id="jurisdiction"
                placeholder="United Kingdom"
                {...register('jurisdiction')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counterparty_type">
                Counterparty Type (optional)
              </Label>
              <Select
                value={counterpartyType ?? NO_COUNTERPARTY_VALUE}
                onValueChange={(v) =>
                  setCounterpartyType(
                    v === NO_COUNTERPARTY_VALUE ? null : (v as CounterpartyType)
                  )
                }
              >
                <SelectTrigger id="counterparty_type">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COUNTERPARTY_VALUE}>
                    Not specified
                  </SelectItem>
                  {COUNTERPARTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {COUNTERPARTY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Classifies the business relationship. Used for reporting and
                policy routing.
              </p>
            </div>

            {!isIndividual && (
              <div className="space-y-2">
                <Label htmlFor="registration_number">
                  Registration Number (optional)
                </Label>
                <Input
                  id="registration_number"
                  placeholder="09446231"
                  {...register('registration_number')}
                />
                <p className="text-xs text-muted-foreground">
                  Resolves the company directly, bypassing name search.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Creating...'
                : isIndividual
                  ? 'Screen Individual'
                  : 'Create Investigation'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
