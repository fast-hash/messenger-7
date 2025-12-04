import httpClient from './httpClient';

export const getMessages = async (chatId) => {
  const { data } = await httpClient.get('/api/messages', {
    params: { chatId },
  });
  return data;
};

export const sendMessage = async (payload) => {
  const { data } = await httpClient.post('/api/messages', payload);
  return data;
};
