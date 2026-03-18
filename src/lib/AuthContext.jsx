import React, { createContext, useContext } from "react";

const AuthContext = createContext({
  user: { id: "local-user", role: "admin" },
  isAuthenticated: true,
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  authError: null,
  appPublicSettings: null,
  logout: () => {},
  navigateToLogin: () => {},
  checkAppState: async () => {},
});

export const AuthProvider = ({ children }) => (
  <AuthContext.Provider
    value={{
      user: { id: "local-user", role: "admin" },
      isAuthenticated: true,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: () => {},
      navigateToLogin: () => {},
      checkAppState: async () => {},
    }}
  >
    {children}
  </AuthContext.Provider>
);

export const useAuth = () => useContext(AuthContext);
