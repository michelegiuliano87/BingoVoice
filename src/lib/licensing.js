export const LICENSE_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  ARCHIVED: "archived",
};

export const LICENSE_PERMISSIONS = {
  ADMIN_PANEL: "adminPanel",
  PROJECTS: "projects",
  CARD_MANAGER: "cardManager",
  VIDEO_BUTTONS: "videoButtons",
  GENERAL_SETTINGS: "generalSettings",
};

export const DEFAULT_LICENSE_PERMISSIONS = {
  [LICENSE_PERMISSIONS.ADMIN_PANEL]: false,
  [LICENSE_PERMISSIONS.PROJECTS]: false,
  [LICENSE_PERMISSIONS.CARD_MANAGER]: false,
  [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: false,
  [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: false,
};

export const matchesOwnerEmail = (email, ownerEmail) =>
  String(email || "").trim().toLowerCase() === String(ownerEmail || "").trim().toLowerCase();
