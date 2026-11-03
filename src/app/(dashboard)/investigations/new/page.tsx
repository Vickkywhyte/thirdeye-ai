'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createInvestigationSchema,
  type CreateInvestigationInput,
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

const ENTITY_TYPES = [
  { value: 'company', label: 'Company' },
  { value: 'individual', label: 'Individual' },
  { value: 'trust', label: 'Trust' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
] as const

export default function NewInvestigationPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvestigationInput>({
    resolver: zodResolver(createInvestigationSchema),
    defaultValues: {
      entity_type: 'company',
    },
  })

  async function onSubmit(data: CreateInvestigationInput) {
    setServerError(null)

    const res = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const json = await res.json()
      setServerError(json.error ?? 'Failed to create investigation')
      return
    }

    const json = await res.json()
    const investigationId = json.data.id

    fetch('/api/screening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investigation_id: investigationId,
        types: ['sanctions', 'pep', 'adverse_media', 'registry'],
      }),
    }).catch(() => {})

    router.push(`/investigations/${investigationId}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          New Investigation
        </h1>
        <p className="text-muted-foreground">
          Create a new due diligence investigation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Details</CardTitle>
          <CardDescription>
            Provide information about the entity to investigate
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
              <Label htmlFor="entity_name">Entity Name</Label>
              <Input
                id="entity_name"
                placeholder="Acme Corporation Ltd"
                {...register('entity_name')}
              />
              {errors.entity_name && (
                <p className="text-xs text-destructive">
                  {errors.entity_name.message}
                </p>
              )}
            </div>

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
                  {ENTITY_TYPES.map((t) => (
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

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction (optional)</Label>
              <Input
                id="jurisdiction"
                placeholder="United Kingdom"
                {...register('jurisdiction')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_number">
                Registration Number (optional)
              </Label>
              <Input
                id="registration_number"
                placeholder="12345678"
                {...register('registration_number')}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Investigation'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
