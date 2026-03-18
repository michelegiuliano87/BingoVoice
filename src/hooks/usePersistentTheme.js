import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "toretto.theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark";
};

export default function usePersistentTheme() {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return {
    isDark,
    setIsDark,
    toggleTheme: () => setIsDark((current) => !current),
  };
}
