const API_BASE_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const errorData = await response.json();
      message = errorData.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json();
};

export const loginUser = async (email, password) => {
  return fetchJson(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
};

export const registerEmployee = async (userData) => {
  return fetchJson(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
};

export const getLogs = async (userId, limit = 30) => {
  return fetchJson(`${API_BASE_URL}/logs/${userId}?limit=${limit}`);
};

export const getAllLogs = async (limit = 100) => {
  return fetchJson(`${API_BASE_URL}/admin/logs?limit=${limit}&includePhotos=1`);
};

export const exportLogs = () => {
  window.location.href = `${API_BASE_URL}/admin/export`;
};

export const punchIn = async (data) => {
  return fetchJson(`${API_BASE_URL}/punch-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const punchOut = async (data) => {
  return fetchJson(`${API_BASE_URL}/punch-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteLog = async (id) => {
  return fetchJson(`${API_BASE_URL}/logs/${id}`, {
    method: 'DELETE'
  });
};

export const STORAGE_KEYS = {
  CURRENT_USER: 'blue_ox_current_user'
};

export const getStoredUser = () => {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return data ? JSON.parse(data) : null;
};

export const setStoredUser = (user) => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};

export const clearStoredUser = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const getMemos = async () => {
  return fetchJson(`${API_BASE_URL}/memos`);
};

export const createMemo = async (memoData) => {
  return fetchJson(`${API_BASE_URL}/memos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memoData)
  });
};
export const updateFaceDescriptor = async (userId, descriptor) => {
  return fetchJson(`${API_BASE_URL}/users/${userId}/face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: JSON.stringify(Array.from(descriptor)) })
  });
};
