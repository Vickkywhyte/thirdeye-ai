import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/monitoring/logger'
import type { OwnershipRelation } from '@/lib/screening/types'

const logger = createLogger('ownership-ingest')

/** Marks rows this ingestion owns, so a re-run can replace only its own edges. */
export const OWNERSHIP_SOURCE = 'UK Companies House'

/**
 * PSCs become beneficial_owner edges and officers become nominee edges, which
 * the graph renders as BENEFICIAL_OWNER and DIRECTOR respectively
 * (see LINK_TYPE_TO_RELATIONSHIP).
 */
function linkTypeFor(
  relation: OwnershipRelation
): 'beneficial_owner' | 'nominee' {
  return relation.kind === 'psc' ? 'beneficial_owner' : 'nominee'
}

/**
 * Turn registry relationships into graph edges for an investigation's subject
 * entity. The subject is the child (owned/controlled); each person or
 * corporate holder is the parent.
 *
 * Idempotent: re-running replaces only the edges previously written by this
 * source for this subject, so repeated screening runs don't duplicate the graph.
 */
export async function ingestOwnership(
  investigationId: string,
  relations: OwnershipRelation[]
): Promise<{ entitiesCreated: number; linksCreated: number }> {
  if (relations.length === 0) {
    return { entitiesCreated: 0, linksCreated: 0 }
  }

  const supabase = createAdminClient()

  const { data: investigation, error: invErr } = await supabase
    .from('investigations')
    .select('id, org_id, entity_id')
    .eq('id', investigationId)
    .single()

  if (invErr || !investigation) {
    logger.error('Cannot ingest ownership: investigation not found', {
      investigationId,
      error: invErr?.message ?? null,
    })
    return { entitiesCreated: 0, linksCreated: 0 }
  }

  const orgId = investigation.org_id
  const subjectId = investigation.entity_id

  // Replace this source's previous edges for the subject.
  const { error: clearErr } = await supabase
    .from('ownership_links')
    .delete()
    .eq('child_entity_id', subjectId)
    .eq('org_id', orgId)
    .eq('source', OWNERSHIP_SOURCE)

  if (clearErr) {
    logger.error('Failed clearing previous ownership links', {
      investigationId,
      error: clearErr.message,
    })
  }

  // Reuse existing entities in the org so repeat runs don't fork duplicates.
  const names = Array.from(new Set(relations.map((r) => r.name)))
  const { data: existing } = await supabase
    .from('entities')
    .select('id, name')
    .eq('org_id', orgId)
    .in('name', names)

  const entityIdByName = new Map<string, string>()
  for (const row of existing ?? []) {
    entityIdByName.set(row.name.toLowerCase(), row.id)
  }

  let entitiesCreated = 0

  for (const relation of relations) {
    if (entityIdByName.has(relation.name.toLowerCase())) continue

    const { data: created, error: entityErr } = await supabase
      .from('entities')
      .insert({
        org_id: orgId,
        name: relation.name,
        type: relation.entityType,
        jurisdiction: relation.countryOfResidence ?? relation.nationality ?? null,
        metadata: {
          source: OWNERSHIP_SOURCE,
          role: relation.role ?? null,
          nationality: relation.nationality ?? null,
          ...(relation.metadata ?? {}),
        },
      })
      .select('id')
      .single()

    if (entityErr || !created) {
      logger.error('Failed creating ownership entity', {
        name: relation.name,
        error: entityErr?.message ?? null,
      })
      continue
    }

    entityIdByName.set(relation.name.toLowerCase(), created.id)
    entitiesCreated += 1
  }

  const linkRows = relations
    .map((relation) => {
      const parentId = entityIdByName.get(relation.name.toLowerCase())
      // no_self_reference: a company can be its own officer in bad data.
      if (!parentId || parentId === subjectId) return null
      return {
        parent_entity_id: parentId,
        child_entity_id: subjectId,
        org_id: orgId,
        ownership_pct: relation.ownershipPct ?? null,
        link_type: linkTypeFor(relation),
        is_verified: true,
        source: OWNERSHIP_SOURCE,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (linkRows.length === 0) {
    return { entitiesCreated, linksCreated: 0 }
  }

  const { error: linkErr, data: insertedLinks } = await supabase
    .from('ownership_links')
    .insert(linkRows)
    .select('id')

  if (linkErr) {
    logger.error('Failed inserting ownership links', {
      investigationId,
      attempted: linkRows.length,
      error: linkErr.message,
    })
    return { entitiesCreated, linksCreated: 0 }
  }

  const linksCreated = insertedLinks?.length ?? 0
  logger.info('Ownership graph ingested', {
    investigationId,
    entitiesCreated,
    linksCreated,
  })

  return { entitiesCreated, linksCreated }
}
