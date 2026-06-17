import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { getStoredUser, clearStoredUser } from './utils/storage';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
    setIsInitialized(true);
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    clearStoredUser();
    setCurrentUser(null);
  };

  if (!isInitialized) return null;

  return (
    <div className="App">
      {!currentUser ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
