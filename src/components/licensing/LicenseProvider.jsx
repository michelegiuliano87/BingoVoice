import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  activateLicense,
  deactivateLicense,
  getActiveLicense,
  getLicensePermissions,
  getStoredActivation,
  issueOwnerLicense,
  LICENSE_PERMISSIONS,
  OWNER_EMAIL,
  isOwnerEmail,
} from "@/lib/licensing";

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [activeLicense, setActiveLicense] = useState(() => getActiveLicense());
  const [storedActivation, setStoredActivation] = useState(() => getStoredActivation());

  useEffect(() => {
    const sync = () => {
      setActiveLicense(getActiveLicense());
      setStoredActivation(getStoredActivation());
    };

    window.addEventListener("storage", sync);
    window.addEventListener("toretto:license-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("toretto:license-changed", sync);
    };
  }, []);

  useEffect(() => {
    if (window.desktopAPI?.setLicenseState) {
      window.desktopAPI.setLicenseState({
        hasActiveLicense: Boolean(activeLicense),
        email: activeLicense?.email || "",
      });
    }
  }, [activeLicense]);

  const value = useMemo(
    () => {
      const permissions = getLicensePermissions(activeLicense);
      const isOwner = isOwnerEmail(activeLicense?.email);
      const isAdmin = Boolean(activeLicense?.isAdmin) || isOwner || permissions[LICENSE_PERMISSIONS.ADMIN_PANEL];

      return {
        activeLicense,
        storedActivation,
        hasActiveLicense: Boolean(activeLicense),
        ownerEmail: OWNER_EMAIL,
        isOwner,
        isAdmin,
        permissions,
        hasPermission: (permission) => Boolean(permissions?.[permission]) || isOwner,
        activate: ({ email, key }) => {
          const activation = activateLicense({ email, key });
          setStoredActivation(activation);
          setActiveLicense(getActiveLicense());
          return activation;
        },
        deactivate: () => {
          deactivateLicense();
          setStoredActivation(null);
          setActiveLicense(null);
        },
        activateOwnerAccess: () => {
          const key = issueOwnerLicense();
          const activation = activateLicense({ email: OWNER_EMAIL, key });
          setStoredActivation(activation);
          setActiveLicense(getActiveLicense());
          return activation;
        },
      };
    },
    [activeLicense, storedActivation]
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const value = useContext(LicenseContext);
  if (!value) {
    throw new Error("useLicense must be used within LicenseProvider");
  }
  return value;
}
