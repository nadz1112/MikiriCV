import { httpClient as api } from '../shared/api/httpClient';
import { ApiResponse, DashboardStats } from '../types';

export const dashboardApi = {
  getStats: async () => {
    const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return res.data.data;
  },
};
