const PROTECTED_PREFIX = "enc:v1:";

const canUseLocalStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const encryptValue = (value, namespace) => {
  if (!window.desktopAPI?.encryptStorageValue) {
    return value;
  }

  return window.desktopAPI.encryptStorageValue(value, namespace);
};

const decryptValue = (value, namespace) => {
  if (!window.desktopAPI?.decryptStorageValue) {
    return value;
  }

  return window.desktopAPI.decryptStorageValue(value, namespace);
};

export const isProtectedValue = (value) => String(value || "").startsWith(PROTECTED_PREFIX);

export const readProtectedJson = (key, fallback, namespace = "core") => {
  if (!canUseLocalStorage()) return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const decrypted = decryptValue(raw, namespace);
    return decrypted ? JSON.parse(decrypted) : fallback;
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
};

export const writeProtectedJson = (key, value, namespace = "core") => {
  if (!canUseLocalStorage()) return;

  const payload = JSON.stringify(value);
  const protectedValue = encryptValue(payload, namespace);
  window.localStorage.setItem(key, protectedValue);
};

export const removeProtectedItem = (key) => {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(key);
};

export const PROTECTED_STORAGE_PREFIX = PROTECTED_PREFIX;
