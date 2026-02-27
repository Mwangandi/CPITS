import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { fetchFrappeProjects } from '../services/frappeAPI.ts';
import { Project } from '../types';

// TODO: fix this error

interface FrappeFilters {
  status?: string;
  financial_year?: string;
  sub_county?: string;
  department?: string;
  ward?: string;
}

export function useFrappeProjects(
  filters?: FrappeFilters,
  limit: number = 50
): UseQueryResult<Project[], Error> {
  return useQuery({
    queryKey: ['frappe-projects', filters, limit],
    queryFn: () => fetchFrappeProjects(filters, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
}