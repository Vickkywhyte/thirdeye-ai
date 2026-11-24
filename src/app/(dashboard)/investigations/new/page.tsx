import {
  NewInvestigationForm,
  type SubjectMode,
} from '@/components/investigation/new-investigation-form'

export const instant = false

type PageProps = {
  searchParams: Promise<{
    type?: string
    name?: string
    jurisdiction?: string
    registration_number?: string
    parentId?: string
  }>
}

export default async function NewInvestigationPage({ searchParams }: PageProps) {
  const params = await searchParams

  // Prefilled when arriving from a node in the ownership graph.
  const mode: SubjectMode =
    params.type === 'individual' ? 'individual' : 'corporate'

  return (
    <NewInvestigationForm
      initialMode={mode}
      initialName={params.name ?? ''}
      initialJurisdiction={params.jurisdiction ?? ''}
      initialRegistrationNumber={params.registration_number ?? ''}
      parentInvestigationId={params.parentId}
    />
  )
}
