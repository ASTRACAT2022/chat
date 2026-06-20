const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    register: (username: string, email: string, password: string) =>
      request<{ accessToken: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },

  users: {
    getProfile: () => request<any>('/users/profile'),
    saveApiKey: (provider: string, key: string) =>
      request<any>('/users/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key }),
      }),
  },

  providers: {
    getModels: (provider?: string) =>
      request<Record<string, any[]>>(
        `/providers/models${provider ? `?provider=${provider}` : ''}`,
      ),
    getFreeModels: () =>
      request<any[]>('/providers/models/free'),
  },

  chat: {
    createSession: (title?: string, model?: string) =>
      request<any>('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title, model }),
      }),
    listSessions: () => request<any[]>('/chat/sessions'),
    getSession: (id: string) => request<any>(`/chat/sessions/${id}`),
    deleteSession: (id: string) =>
      request<any>(`/chat/sessions/${id}`, { method: 'DELETE' }),
  },

  chain: {
    create: (name: string, steps: any[]) =>
      request<any>('/chain/create', {
        method: 'POST',
        body: JSON.stringify({ name, steps }),
      }),
    list: () => request<any[]>('/chain/list'),
    get: (id: string) => request<any>(`/chain/${id}`),
    execute: (chainId: string, sessionId: string, message: string) =>
      request<{ jobId: string; chainId: string }>('/chain/execute', {
        method: 'POST',
        body: JSON.stringify({ chainId, sessionId, message }),
      }),
    getStatus: (jobId: string) => request<any>(`/chain/status/${jobId}`),
  },

  agent: {
    getSessionFiles: (id: string) => request<{ path: string; content: string }[]>(`/agent/sessions/${id}/files`),
    deleteSession: (id: string) => request<any>(`/agent/sessions/${id}`, { method: 'DELETE' }),
  },
};
