import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    } else {
      // Tạo user guest mặc định nếu không có
      const guestUser = {
        id: 'guest_' + Date.now(),
        fullName: 'Khách',
        isGuest: true
      };
      localStorage.setItem('user', JSON.stringify(guestUser));
      setCurrentUser(guestUser);
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { username, password });
    const { token, user } = res.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    setCurrentUser(user);
    return user;
  };

  const loginAdmin = async (username, password) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/loginadmin`, { username, password });
    const { token, user } = res.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    setCurrentUser(user);
    return user;
  };

  const register = async (userData) => {
    const newUser = {
      ...userData,
      isAdmin: userData.username === 'admin' 
    };
    
    await axios.post(`${BACKEND_URL}/api/auth/register`, newUser);
  };

  const logout = () => {
    // Xóa tất cả dữ liệu trong localStorage TRƯỚC KHI dispatch event
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart'); 
    localStorage.removeItem('cartItems');
    localStorage.removeItem('shopping-cart');
    
    // Dispatch event để thông báo cho CartContext reset
    window.dispatchEvent(new CustomEvent('user-logout'));
    window.dispatchEvent(new CustomEvent('clear-cart'));
    
    // Reset state
    setCurrentUser(null);
    
    // Tạo user guest mới SAU KHI đã xóa hết
    setTimeout(() => {
      const guestUser = {
        id: 'guest_' + Date.now(),
        fullName: 'Khách',
        isGuest: true
      };
      localStorage.setItem('user', JSON.stringify(guestUser));
      setCurrentUser(guestUser);
    }, 100);
  };

  const continueAsGuest = () => {
    const guestUser = {
      id: 'guest_' + Date.now(),
      fullName: 'Khách',
      isGuest: true
    };
    localStorage.setItem('user', JSON.stringify(guestUser));
    setCurrentUser(guestUser);
  };

  const value = {
    currentUser,
    login,
    loginAdmin,
    register,
    logout,
    continueAsGuest,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}