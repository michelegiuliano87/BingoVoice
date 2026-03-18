export {};

declare global {
  interface LicenseSnapshot {
    ownerEmail: string;
    activeLicense: any;
    storedActivation: any;
    summary?: any;
    customers?: any[];
    licenses?: any[];
    activations?: any[];
  }

  interface Window {
    desktopAPI?: {
      saveMediaFile: (payload: { name: string; bytes: number[] }) => Promise<string>;
      getLicenseSnapshot: () => Promise<LicenseSnapshot>;
      activateLicense: (payload: { email: string; key: string }) => Promise<LicenseSnapshot>;
      activateOwnerAccess: () => Promise<LicenseSnapshot>;
      deactivateLicense: () => Promise<LicenseSnapshot>;
      createLicenseCustomer: (payload: any) => Promise<LicenseSnapshot>;
      updateLicenseCustomer: (id: string, patch: Record<string, unknown>) => Promise<LicenseSnapshot>;
      createLicenseRecord: (payload: any) => Promise<LicenseSnapshot>;
      updateLicenseRecord: (id: string, patch: Record<string, unknown>) => Promise<LicenseSnapshot>;
      renewLicenseRecord: (payload: any) => Promise<LicenseSnapshot>;
      releaseLicenseDevice: (payload: { licenseId: string; deviceId: string }) => Promise<LicenseSnapshot>;
      importLegacyLicenseData: (payload: any) => Promise<LicenseSnapshot>;
      saveProjectPackage: (payload: { suggestedName: string; packageData?: any; bytes?: Uint8Array }) => Promise<{ canceled: boolean; filePath?: string }>;
      openProjectPackage: () => Promise<{ canceled: boolean; filePath?: string; packageData?: any; bytes?: Uint8Array }>;
      onLicenseChanged: (callback: (payload: LicenseSnapshot) => void) => () => void;
    };
    _bgMusicAudio?: HTMLAudioElement;
  }
}
