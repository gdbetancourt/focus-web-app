import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'staff' or 'external'
  const [permissions, setPermissions] = useState(null); // User permissions
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    checkAuth();
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, [token]);

  const checkAuth = async () => {
    // Skip auth check for public routes
    const publicPaths = ['/quiz/', '/blog', '/eventos', '/evento/', '/legal', '/muro', '/public', '/countdown/'];
    const currentPath = window.location.pathname;
    if (publicPaths.some(path => currentPath.startsWith(path))) {
      setLoading(false);
      return;
    }
    
    // Add timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.log("Auth check timed out, redirecting to login");
      setLoading(false);
    }, 5000); // 5 second timeout
    
    try {
      // First check JWT token (legacy system - higher priority for backwards compatibility)
      const existingToken = localStorage.getItem("token");
      if (existingToken) {
        try {
          axios.defaults.headers.common["Authorization"] = `Bearer ${existingToken}`;
          const response = await axios.get(`${API}/auth/me`);
          setUser(response.data);
          setToken(existingToken);
          clearTimeout(authTimeout);
          setLoading(false);
          return;
        } catch (error) {
          console.log("JWT token invalid, checking Google session...");
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
        }
      }
      
      // Then check session (via cookie) - unified endpoint for all users
      try {
        const response = await axios.get(`${API}/auth/check`, {
          withCredentials: true,
          timeout: 3000 // 3 second timeout for this specific request
        });
        
        if (response.data?.authenticated && response.data?.user) {
          setUser(response.data.user);
          setUserType(response.data.user_type || 'staff'); // Store user type
          setPermissions(response.data.permissions || null); // Store permissions
          clearTimeout(authTimeout);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.log("No Google session found or timeout");
      }
    } catch (error) {
      console.error("Auth check error:", error);
    }
    
    clearTimeout(authTimeout);
    setLoading(false);
  };

  // Legacy JWT login (kept for backwards compatibility)
  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem("token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    
    return userData;
  };

  // Legacy JWT register (kept for backwards compatibility)
  const register = async (email, password, name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem("token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    
    return userData;
  };

  // Set user from Google OAuth callback
  const setGoogleUser = (userData) => {
    setUser(userData);
    setLoading(false);
  };

  const logout = async () => {
    // Clear JWT token
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    
    // Clear session cookie
    try {
      await axios.post(`${API}/auth/logout`, {}, {
        withCredentials: true
      });
    } catch (error) {
      console.log("Error clearing session:", error);
    }
    
    setUser(null);
    setUserType(null);
    setPermissions(null);
    
    // Redirect to public page after logout
    window.location.href = "/public";
  };

  // Helper function to check permissions
  const can = (resource, action) => {
    if (!permissions) return userType === 'staff'; // Default: staff can do everything
    return permissions[resource]?.[action] === true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userType,
      permissions,
      token, 
      loading, 
      login, 
      register, 
      logout,
      setGoogleUser,
      setUserType,
      checkAuth,
      can
    }}>
      {children}
    </AuthContext.Provider>
  );
};
