import httpClient from './httpClient';

export const searchUsers = async (query) => {
  const { data } = await httpClient.get('/api/users/search', { params: { query } });
  return data;
};

export const currentUser = async () => {
  const { data } = await httpClient.get('/api/users/me');
  return data;
};
