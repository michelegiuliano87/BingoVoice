import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LICENSE_PERMISSIONS, matchesOwnerEmail } from "@/lib/licensing";
import { readProtectedJson } from "@/lib/secureStorage";

const LicenseContext = createContext(null);
const LEGACY_CUSTOMER_KEY = "toretto.licenses.customers";
const LEGACY_LICENSE_KEY = "toretto.licenses.records";
const LEGACY_ACTIVATION_KEY = "toretto.licenses.activation";
const LEGACY_ACTIVATION_LOG_KEY = "toretto.licenses.activation-log";

const emptyPermissions = {
  [LICENSE_PERMISSIONS.ADMIN_PANEL]: false,
  [LICENSE_PERMISSIONS.PROJECTS]: false,
  [LICENSE_PERMISSIONS.CARD_MANAGER]: false,
  [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: false,
  [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: false,
};

export function LicenseProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState({
    ownerEmail: "",
    activeLicense: null,
    storedActivation: null,
    customers: [],
    licenses: [],
    activations: [],
    summary: { customers: 0, licenses: 0, activeLicenses: 0, expiringSoon: 0, activations: 0 },
  });

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      try {
        let nextSnapshot = await window.desktopAPI?.getLicenseSnapshot?.();
        const shouldMigrate =
          nextSnapshot
          && (nextSnapshot.licenses?.length || 0) <= 1
          && ((readProtectedJson(LEGACY_LICENSE_KEY, [], `license:${LEGACY_LICENSE_KEY}`)?.length || 0) > 0);

        if (shouldMigrate) {
          nextSnapshot = await window.desktopAPI.importLegacyLicenseData({
            customers: readProtectedJson(LEGACY_CUSTOMER_KEY, [], `license:${LEGACY_CUSTOMER_KEY}`),
            licenses: readProtectedJson(LEGACY_LICENSE_KEY, [], `license:${LEGACY_LICENSE_KEY}`),
            activations: readProtectedJson(LEGACY_ACTIVATION_LOG_KEY, [], `license:${LEGACY_ACTIVATION_LOG_KEY}`),
            activation: readProtectedJson(LEGACY_ACTIVATION_KEY, null, `license:${LEGACY_ACTIVATION_KEY}`),
          });
        }

        if (mounted && nextSnapshot) {
          setSnapshot(nextSnapshot);
        }
      } catch {
        if (mounted) {
          setSnapshot({
            ownerEmail: "",
            activeLicense: null,
            storedActivation: null,
            customers: [],
            licenses: [],
            activations: [],
            summary: { customers: 0, licenses: 0, activeLicenses: 0, expiringSoon: 0, activations: 0 },
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    sync();

    const unsubscribe = window.desktopAPI?.onLicenseChanged?.((nextSnapshot) => {
      if (mounted && nextSnapshot) {
        setSnapshot(nextSnapshot);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => {
    const activeLicense = snapshot.activeLicense;
    const storedActivation = snapshot.storedActivation;
    const ownerEmail = snapshot.ownerEmail || "";
    const isOwner = matchesOwnerEmail(activeLicense?.email, ownerEmail);
    const permissions = activeLicense?.permissions || emptyPermissions;
    const isAdmin = Boolean(activeLicense?.isAdmin) || isOwner || permissions[LICENSE_PERMISSIONS.ADMIN_PANEL];

    return {
      loading,
      activeLicense,
      storedActivation,
      ownerEmail,
      hasActiveLicense: Boolean(activeLicense),
      isOwner,
      isAdmin,
      permissions,
      hasPermission: (permission) => Boolean(permissions?.[permission]) || isOwner,
      activate: async ({ email, key }) => {
        const nextSnapshot = await window.desktopAPI.activateLicense({ email, key });
        setSnapshot(nextSnapshot);
        return nextSnapshot.activeLicense;
      },
      deactivate: async () => {
        const nextSnapshot = await window.desktopAPI.deactivateLicense();
        setSnapshot(nextSnapshot);
      },
      activateOwnerAccess: async () => {
        const nextSnapshot = await window.desktopAPI.activateOwnerAccess();
        setSnapshot(nextSnapshot);
        return nextSnapshot.activeLicense;
      },
      refreshLicenseSnapshot: async () => {
        const nextSnapshot = await window.desktopAPI.getLicenseSnapshot();
        setSnapshot(nextSnapshot);
        return nextSnapshot;
      },
    };
  }, [loading, snapshot]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const value = useContext(LicenseContext);
  if (!value) {
    throw new Error("useLicense must be used within LicenseProvider");
  }
  return value;
}
