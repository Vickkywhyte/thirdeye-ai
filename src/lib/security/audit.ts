import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

export interface AuditEvent {
  userId: string
  orgId: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export const AUDIT_ACTIONS = {
  INVESTIGATION_CREATED: 'investigation.created',
  INVESTIGATION_DELETED: 'investigation.deleted',
  INVESTIGATION_UPDATED: 'investigation.updated',
  SCREENING_TRIGGERED: 'screening.triggered',
  REPORT_GENERATED: 'report.generated',
  REPORT_DELETED: 'report.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  API_KEY_CREATED: 'api_key.created',
  ENTITY_CREATED: 'entity.created',
  ENTITY_UPDATED: 'entity.updated',
  ENTITY_DELETED: 'entity.deleted',
} as const

export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  event: AuditEvent
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      user_id: event.userId,
      org_id: event.orgId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      data: (event.metadata ?? {}) as Json,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
    })
  } catch {
    // Audit log failure must never crash the main request
  }
}
