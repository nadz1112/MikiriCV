import { useCandidateFeatureStore } from './candidateStore';
import { useCandidateStore } from '../../../store/useCandidateStore';
import { useMatchingFeatureStore } from '../../matching/store/matchingStore';

export function removeDeletedCandidate(id: string) {
  useCandidateFeatureStore.getState().removeCandidateId(id);
  useCandidateStore.setState((state) => ({
    candidates: state.candidates.filter((candidate) => candidate.id !== id),
    selectedCandidates: state.selectedCandidates.filter((candidateId) => candidateId !== id),
  }));
  useMatchingFeatureStore.setState((state) => ({
    selectedCandidateIds: state.selectedCandidateIds.filter((candidateId) => candidateId !== id),
  }));
}
