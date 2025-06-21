import { useQuery } from '@tanstack/react-query'

export const useConfig = () => {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await fetch('/api/config')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch config')
      }
      return response.json()
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}