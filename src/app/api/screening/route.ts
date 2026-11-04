import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { screeningSchema } from '@/lib/validation/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { runScreening } from '@/lib/screening/orchestrator'
import {
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { screeningRateLimiter } from '@/lib/security/rate-limiter'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'
import type { ScreeningTypeValue } from '@/lib/screening/types'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed, remaining } = screeningRateLimiter(`${ip}:screening`)
    if (!allowed) {
      return apiError('Too many requests. Please try again later.', 429)
    }

    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'screening:run')) return apiForbidden()

    const body = await request.json()
    const parsed = screeningSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400)
    }

    const { investigation_id, types } = parsed.data
    const supabase = createAdminClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', investigation_id)
      .single()

    if (invError || !investigation) {
      return apiError('Investigation not found', 404)
    }

    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', investigation.entity_id)
      .single()

    if (entityError || !entity) {
      return apiError('Entity not found', 404)
    }

    const screeningTypes = types as ScreeningTypeValue[]

    for (const type of screeningTypes) {
      await supabase.from('screening_results').upsert(
        {
          investigation_id,
          type: type as 'sanctions' | 'pep' | 'adverse_media' | 'registry',
          status: 'pending' as const,
          hit_count: 0,
          raw_data: {},
          error_message: null,
          started_at: null,
          completed_at: null,
        },
        { onConflict: 'investigation_id,type' }
      )
    }

    const screeningPromise = runScreening(investigation_id, screeningTypes, {
      name: entity.name,
      type: entity.type,
      jurisdiction: entity.jurisdiction,
      registration_number: entity.registration_number,
    })

    screeningPromise.catch(() => {})

    await logAuditEvent(supabase, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.SCREENING_TRIGGERED,
      resourceType: 'investigation',
      resourceId: investigation_id,
      metadata: { types: screeningTypes },
    })

    return NextResponse.json(
      { message: 'Screening started', investigation_id, types: screeningTypes },
      { status: 202 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
