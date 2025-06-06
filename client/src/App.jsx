import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Settings from './pages/Settings';

// Services
import { authService } from './services/api';

// Context
import { AuthContext } from './contexts/AuthContext';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if user is authenticated on app load
  const { data: userData, isLoading: isVerifying } = useQuery({
    queryKey: ['verify-user'],
    queryFn: authService.verify,
    enabled: !!localStorage.getItem('token'),
    retry: false,
    onSuccess: (data) => {
      setUser(data.user);
      setLoading(false);
    },
    onError: () => {
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    toast.success('Welcome back!');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out successfully');
  };

  const authContextValue = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <div className="min-h-screen bg-gray-50">
        {user ? (
          <div className="flex h-screen">
            {/* Sidebar */}
            <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Navbar */}
              <Navbar setSidebarOpen={setSidebarOpen} />

              {/* Page content */}
              <main className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects/:projectId" element={<ProjectDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default App;