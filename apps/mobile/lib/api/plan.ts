import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { Plan } from '@focus/shared-types';

export interface PlanInfo {
  plan: Plan;
  isPro: boolean;
  proExpiresAt: string | null;
  usage: {
    activeTasks: number;
    limit: number | null;
  };
}

export const planInfoKey = ['plan'] as const;

export function usePlanInfo() {
  return useQuery({
    queryKey: planInfoKey,
    queryFn: async () => {
      const { data } = await apiClient.get<PlanInfo>('/plan');
      return data;
    },
        // Обновляем раз в 5 минут — план меняется редко
    staleTime: 5 * 60 * 1000,
  });
}
