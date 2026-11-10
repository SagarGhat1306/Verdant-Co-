import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BASE_URL } from '../utils/constants.js';

const TOKEN_KEY = 'verdant_agent_token';
const AuthContext = createContext(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // No storage (private mode etc.), so the session only lasts until reload.
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [agent, setAgent] = useState(null);
  const [checking, setChecking] = useState(Boolean(readToken()));

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setAgent(null);
  }, []);

  // Sign out on any 401 from a signed-in request (token expired or invalid).
  useEffect(() => {
    const id = axios.interceptors.response.use(undefined, (error) => {
      if (error.response?.status === 401 && error.config?.headers?.Authorization) logout();
      return Promise.reject(error);
    });
    return () => axios.interceptors.response.eject(id);
  }, [logout]);

  // Check a saved token once on load.
  useEffect(() => {
    if (!token || agent) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    axios
      .get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => !cancelled && setAgent(res.data.data.agent))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [token, agent, logout]);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    const data = res.data.data;
    writeToken(data.token);
    setToken(data.token);
    setAgent(data.agent);
    return data.agent;
  }, []);

  const value = useMemo(
    () => ({ token, agent, isAuthenticated: Boolean(token && agent), checking, login, logout }),
    [token, agent, checking, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
