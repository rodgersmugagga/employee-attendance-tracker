import React, { useState, useEffect, Suspense, lazy } from 'react';
import Login from './components/Login';
import { getStoredUser, clearStoredUser } from './utils/storage';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy-load heavy pages so the initial JS bundle stays small
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setTheme] = useState('theme-day');

  useEffect(() => {
    const user = getStoredUser();
    if (user) setCurrentUser(user);
    setIsInitialized(true);

    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) setTheme('theme-morning');
    else if (hour >= 11 && hour < 17) setTheme('theme-day');
    else setTheme('theme-evening');
  }, []);

  const handleLoginSuccess = (user) => setCurrentUser(user);
  const handleLogout = () => { clearStoredUser(); setCurrentUser(null); };

  if (!isInitialized) return null;

  return (
    <div className={`App ${theme}`} style={{ minHeight: '100vh' }}>
      {/* Suspense fallback shows a minimal spinner while lazy chunks load */}
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="spinner" />
        </div>
      }>
        <AnimatePresence mode="wait">
          {!currentUser ? (
            <motion.div key="login"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <Login onLoginSuccess={handleLoginSuccess} />
            </motion.div>
          ) : currentUser.role === 'admin' ? (
            <motion.div key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AdminDashboard user={currentUser} onLogout={handleLogout} />
            </motion.div>
          ) : (
            <motion.div key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Dashboard user={currentUser} onLogout={handleLogout} />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default App;
