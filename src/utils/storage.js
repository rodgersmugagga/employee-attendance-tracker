const API_BASE_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';

export const loginUser = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error('Invalid credentials');
  return response.json();
};

export const registerEmployee = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to register employee');
  }
  return response.json();
};

export const getLogs = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/logs/${userId}`);
  return response.json();
};

export const getAllLogs = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/logs`);
  return response.json();
};

export const exportLogs = () => {
  window.location.href = `${API_BASE_URL}/admin/export`;
};

export const punchIn = async (data) => {
  const response = await fetch(`${API_BASE_URL}/punch-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};

export const punchOut = async (data) => {
  const response = await fetch(`${API_BASE_URL}/punch-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};

export const deleteLog = async (id) => {
  const response = await fetch(`${API_BASE_URL}/logs/${id}`, {
    method: 'DELETE'
  });
  return response.json();
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
  const response = await fetch(`${API_BASE_URL}/memos`);
  return response.json();
};

export const createMemo = async (memoData) => {
  const response = await fetch(`${API_BASE_URL}/memos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memoData)
  });
  return response.json();
};
export const updateFaceDescriptor = async (userId, descriptor) => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: JSON.stringify(Array.from(descriptor)) })
  });
  return response.json();
};
