import useSWR from 'swr'
import type { GraphData } from '@/lib/graph/types'

interface GraphResult {
  graphData: GraphData
  maxDepth: number
  totalNodes: number
  totalEdges: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch graph data')
  const json = await res.json()
  return json.data as GraphResult
}

export function useGraphData(investigationId: string) {
  const { data, error, isLoading, mutate } = useSWR<GraphResult>(
    `/api/investigations/${investigationId}/graph`,
    fetcher
  )

  return {
    graphData: data?.graphData,
    maxDepth: data?.maxDepth ?? 0,
    totalNodes: data?.totalNodes ?? 0,
    totalEdges: data?.totalEdges ?? 0,
    isLoading,
    error,
    mutate,
  }
}
