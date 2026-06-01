import { useQuery } from '@tanstack/react-query'
import { getSummary } from '../api/summary'

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => getSummary().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
