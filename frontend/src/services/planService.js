import api from './api';

const unwrapData = (response) => response?.data?.data ?? response?.data ?? response;

export const normalizePlan = (item) => {
  if (!item) return null;

  const attributes = item.attributes || item;
  const id = item.id ?? attributes.id ?? attributes.documentId ?? item.documentId;
  const documentId = item.documentId ?? attributes.documentId ?? null;

  return {
    id,
    documentId,
    ...attributes
  };
};

export const listPlans = async () => {
  const response = await api.get('/plans', {
    params: {
      sort: 'updatedAt:desc',
      'pagination[pageSize]': 200
    }
  });

  const data = unwrapData(response);
  const items = Array.isArray(data) ? data : data?.items || data?.results || [];
  return items.map(normalizePlan).filter(Boolean);
};

export const createPlan = async (planData) => {
  const response = await api.post('/plans', { data: planData });
  return normalizePlan(unwrapData(response));
};

export const updatePlan = async (planId, planData) => {
  const response = await api.put(`/plans/${planId}`, { data: planData });
  return normalizePlan(unwrapData(response));
};

export const deletePlan = async (planId) => {
  await api.delete(`/plans/${planId}`);
};
