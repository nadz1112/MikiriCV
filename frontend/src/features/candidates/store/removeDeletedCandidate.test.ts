import { expect, it } from 'vitest';
import { useCandidateFeatureStore } from './candidateStore';
import { useCandidateStore } from '../../../store/useCandidateStore';
import { useMatchingFeatureStore } from '../../matching/store/matchingStore';
import { api } from '../../../services/api';

it('a successful delete clears the CV from every selection store', async () => {
  useCandidateFeatureStore.setState({ selectedCandidateIds: ['deleted', 'keep'] });
  useCandidateStore.setState({ selectedCandidates: ['deleted', 'keep'] });
  useMatchingFeatureStore.setState({ selectedCandidateIds: ['deleted', 'keep'] });
  await api.delete('/candidates/deleted', { adapter: async (config) => ({ config, data: { success: true }, status: 200, statusText: 'OK', headers: {} }) });
  expect(useCandidateFeatureStore.getState().selectedCandidateIds).toEqual(['keep']);
  expect(useCandidateStore.getState().selectedCandidates).toEqual(['keep']);
  expect(useMatchingFeatureStore.getState().selectedCandidateIds).toEqual(['keep']);
});
