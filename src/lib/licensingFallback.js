import { readProtectedJson, removeProtectedItem, writeProtectedJson } from "@/lib/secureStorage";
import {
  DEFAULT_LICENSE_PERMISSIONS,
  LICENSE_PERMISSIONS,
  LICENSE_STATUS,
  matchesOwnerEmail,
} from "@/lib/licensing";

const OWNER_EMAIL = "michele.giuliano.87@hotmail.com";
const LICENSE_STORAGE_KEY = "toretto.licenses.records";
const CUSTOMER_STORAGE_KEY = "toretto.licenses.customers";
const ACTIVATION_STORAGE_KEY = "toretto.licenses.activation";
const ACTIVATION_LOG_STORAGE_KEY = "toretto.licenses.activation-log";
const DEVICE_STORAGE_KEY = "toretto.device.id";
const SECRET_SALT = "toretto-license-salt-v3";
const DEFAULT_PLAN = "standard";
const DEFAULT_MAX_DEVICES = 1;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeString = (value) => String(value || "").trim();
const normalizePermissions = (permissions = {}, isAdmin = false) => ({
  ...DEFAULT_LICENSE_PERMISSIONS,
  ...permissions,
  ...(isAdmin ? { [LICENSE_PERMISSIONS.ADMIN_PANEL]: true } : {}),
});

const hashString = (value) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
};

const encodePayload = (payload) =>
  Array.from(new TextEncoder().encode(JSON.stringify(payload)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

const decodePayload = (encoded) => {
  const bytes = new Uint8Array(
    encoded.match(/.{1,2}/g)?.map((chunk) => Number.parseInt(chunk, 16)) || [],
  );
  return JSON.parse(new TextDecoder().decode(bytes));
};

const signPayload = (payload) => hashString(`${JSON.stringify(payload)}|${SECRET_SALT}`);

const getStoredJson = (key, fallback) => readProtectedJson(key, fallback, `license:${key}`);

const setStoredJson = (key, value) => {
  writeProtectedJson(key, value, `license:${key}`);
  window.dispatchEvent(new CustomEvent("toretto:license-changed"));
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const sortByDateDesc = (items, field) =>
  [...items].sort((left, right) => Date.parse(right?.[field] || 0) - Date.parse(left?.[field] || 0));
const formatLicenseBody = (value) => value.match(/.{1,4}/g)?.join("-") || value;

const buildPayload = ({
  customerId,
  email,
  plan = DEFAULT_PLAN,
  expiresAt = null,
  isAdmin = false,
  maxDevices = DEFAULT_MAX_DEVICES,
  label = "",
  permissions = DEFAULT_LICENSE_PERMISSIONS,
}) => ({
  v: 3,
  customerId,
  email: normalizeEmail(email),
  plan,
  expiresAt,
  isAdmin,
  maxDevices,
  label: normalizeString(label),
  permissions: normalizePermissions(permissions, isAdmin),
  nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase(),
});

const parseLicenseStatus = (record) => {
  if (!record) return LICENSE_STATUS.REVOKED;
  if (record.status === LICENSE_STATUS.REVOKED) return LICENSE_STATUS.REVOKED;
  if (record.status === LICENSE_STATUS.SUSPENDED) return LICENSE_STATUS.SUSPENDED;
  if (record.status === LICENSE_STATUS.ARCHIVED) return LICENSE_STATUS.ARCHIVED;
  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) return "expired";
  return LICENSE_STATUS.ACTIVE;
};

const getDeviceId = () => {
  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
};

const getDeviceLabel = () => {
  const platform = navigator.platform || "Desktop";
  const language = navigator.language || "it-IT";
  return `${platform} - ${language}`;
};

const listCustomers = () => sortByDateDesc(getStoredJson(CUSTOMER_STORAGE_KEY, []), "createdAt");
const saveCustomers = (customers) => setStoredJson(CUSTOMER_STORAGE_KEY, customers);
const listLicenseRecords = () => sortByDateDesc(getStoredJson(LICENSE_STORAGE_KEY, []), "createdAt");
const saveLicenseRecords = (records) => setStoredJson(LICENSE_STORAGE_KEY, records);
const listActivationLogs = () => sortByDateDesc(getStoredJson(ACTIVATION_LOG_STORAGE_KEY, []), "activatedAt");
const saveActivationLogs = (logs) => setStoredJson(ACTIVATION_LOG_STORAGE_KEY, logs);
const getStoredActivation = () => getStoredJson(ACTIVATION_STORAGE_KEY, null);

const createCustomer = ({ name, email, company = "", phone = "", notes = "", priority = "standard" }) => {
  const customer = {
    id: crypto.randomUUID(),
    name: normalizeString(name),
    email: normalizeEmail(email),
    company: normalizeString(company),
    phone: normalizeString(phone),
    notes: normalizeString(notes),
    priority,
    createdAt: new Date().toISOString(),
  };
  saveCustomers([customer, ...listCustomers().filter((item) => item.email !== customer.email)]);
  return customer;
};

const updateCustomer = (id, patch) => {
  saveCustomers(listCustomers().map((customer) => (customer.id === id ? { ...customer, ...patch } : customer)));
};

const findCustomerByEmail = (email) => listCustomers().find((customer) => customer.email === normalizeEmail(email));

const buildLicenseKey = (input) => {
  const payload = buildPayload(input);
  const encoded = encodePayload(payload);
  const signature = signPayload(payload);
  return `BV-${formatLicenseBody(encoded)}-${signature}`;
};

const parseLicenseKey = (key) => {
  const sanitized = String(key || "").trim().toUpperCase();
  if (!sanitized.startsWith("BV-")) throw new Error("Formato licenza non valido");
  const lastDash = sanitized.lastIndexOf("-");
  if (lastDash <= 2) throw new Error("Struttura licenza non valida");
  const encoded = sanitized.slice(3, lastDash).replace(/-/g, "");
  const signature = sanitized.slice(lastDash + 1);
  const payload = decodePayload(encoded);
  if (signature !== signPayload(payload)) throw new Error("Firma licenza non valida");
  return payload;
};

const findLicenseRecordByKey = (key) =>
  listLicenseRecords().find((record) => record.key === String(key || "").trim().toUpperCase());

const appendActivationLog = (entry) => saveActivationLogs([entry, ...listActivationLogs()]);
const upsertLicenseRecord = (record) => {
  const records = listLicenseRecords();
  const next = [record, ...records.filter((item) => item.id !== record.id)];
  saveLicenseRecords(next);
  return record;
};

const createAndStoreLicenseRecord = ({
  customerId,
  customerName = "",
  email,
  company = "",
  phone = "",
  expiresAt = null,
  startsAt = new Date().toISOString(),
  plan = DEFAULT_PLAN,
  isAdmin = false,
  label = "",
  notes = "",
  maxDevices = DEFAULT_MAX_DEVICES,
  paymentStatus = "paid",
  permissions = DEFAULT_LICENSE_PERMISSIONS,
}) => {
  const normalizedEmail = normalizeEmail(email);
  let customer = customerId ? listCustomers().find((item) => item.id === customerId) : findCustomerByEmail(normalizedEmail);
  if (!customer) {
    customer = createCustomer({
      name: customerName || normalizedEmail,
      email: normalizedEmail,
      company,
      phone,
      notes,
      priority: matchesOwnerEmail(normalizedEmail, OWNER_EMAIL) ? "owner" : "standard",
    });
  }

  const key = buildLicenseKey({
    customerId: customer.id,
    email: normalizedEmail,
    plan,
    expiresAt,
    isAdmin,
    maxDevices,
    label,
    permissions,
  });

  return upsertLicenseRecord({
    id: crypto.randomUUID(),
    customerId: customer.id,
    customerName: customer.name,
    email: normalizedEmail,
    key,
    plan,
    status: LICENSE_STATUS.ACTIVE,
    isAdmin,
    label: normalizeString(label),
    notes: normalizeString(notes),
    startsAt,
    expiresAt,
    maxDevices: Math.max(1, Number(maxDevices) || DEFAULT_MAX_DEVICES),
    permissions: normalizePermissions(permissions, isAdmin),
    paymentStatus,
    createdAt: new Date().toISOString(),
    createdBy: OWNER_EMAIL,
    activatedDeviceIds: [],
    lastActivatedAt: null,
    renewalHistory: [],
  });
};

const updateLicenseRecord = (id, patch) => {
  const current = listLicenseRecords().find((record) => record.id === id);
  if (!current) return null;
  return upsertLicenseRecord({
    ...current,
    ...patch,
    permissions: normalizePermissions(patch.permissions ?? current.permissions, patch.isAdmin ?? current.isAdmin),
  });
};

const renewLicenseRecord = ({ id, extraDays, newPlan, maxDevices, notes = "" }) => {
  const current = listLicenseRecords().find((record) => record.id === id);
  if (!current) return null;
  const baseDate =
    current.expiresAt && Date.parse(current.expiresAt) > Date.now() ? new Date(current.expiresAt) : new Date();
  const expiresAt = extraDays ? new Date(baseDate.getTime() + extraDays * 86400000).toISOString() : null;
  return upsertLicenseRecord({
    ...current,
    expiresAt,
    plan: newPlan || current.plan,
    maxDevices: Math.max(1, Number(maxDevices) || current.maxDevices || DEFAULT_MAX_DEVICES),
    status: LICENSE_STATUS.ACTIVE,
    permissions: normalizePermissions(current.permissions, current.isAdmin),
    renewalHistory: [
      {
        id: crypto.randomUUID(),
        renewedAt: new Date().toISOString(),
        previousExpiresAt: current.expiresAt,
        nextExpiresAt: expiresAt,
        notes: normalizeString(notes),
      },
      ...ensureArray(current.renewalHistory),
    ],
  });
};

const validateLicense = ({ email, key }) => {
  const payload = parseLicenseKey(key);
  const normalizedEmail = normalizeEmail(email);
  if (payload.email !== normalizedEmail) throw new Error("La licenza non corrisponde a questa email");
  const record = findLicenseRecordByKey(key);
  if (!record) throw new Error("Licenza non registrata nel gestionale");
  const status = parseLicenseStatus(record);
  if (status === LICENSE_STATUS.SUSPENDED) throw new Error("Licenza sospesa");
  if (status === LICENSE_STATUS.REVOKED) throw new Error("Licenza revocata");
  if (status === LICENSE_STATUS.ARCHIVED) throw new Error("Licenza archiviata");
  if (status === "expired") throw new Error("La licenza e' scaduta");
  return { payload, record };
};

const activateLicense = ({ email, key }) => {
  const { payload, record } = validateLicense({ email, key });
  const deviceId = getDeviceId();
  const activatedDevices = ensureArray(record.activatedDeviceIds);
  const alreadyBound = activatedDevices.includes(deviceId);

  if (!alreadyBound && activatedDevices.length >= (record.maxDevices || payload.maxDevices || DEFAULT_MAX_DEVICES)) {
    throw new Error("Numero massimo di dispositivi raggiunto per questa licenza");
  }

  const updatedRecord = upsertLicenseRecord({
    ...record,
    activatedDeviceIds: alreadyBound ? activatedDevices : [...activatedDevices, deviceId],
    lastActivatedAt: new Date().toISOString(),
    lastDeviceLabel: getDeviceLabel(),
  });

  const activation = {
    licenseId: updatedRecord.id,
    customerId: updatedRecord.customerId,
    email: updatedRecord.email,
    key: updatedRecord.key,
    activatedAt: new Date().toISOString(),
    deviceId,
    deviceLabel: getDeviceLabel(),
    isAdmin: Boolean(updatedRecord.isAdmin),
    permissions: normalizePermissions(updatedRecord.permissions, updatedRecord.isAdmin),
    plan: updatedRecord.plan,
    expiresAt: updatedRecord.expiresAt,
    status: updatedRecord.status,
  };

  setStoredJson(ACTIVATION_STORAGE_KEY, activation);
  appendActivationLog({
    id: crypto.randomUUID(),
    licenseId: updatedRecord.id,
    customerId: updatedRecord.customerId,
    email: updatedRecord.email,
    deviceId,
    deviceLabel: getDeviceLabel(),
    activatedAt: activation.activatedAt,
    type: alreadyBound ? "revalidation" : "activation",
  });

  return activation;
};

const deactivateLicense = () => {
  removeProtectedItem(ACTIVATION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("toretto:license-changed"));
};

const releaseDeviceFromLicense = ({ licenseId, deviceId }) => {
  const record = listLicenseRecords().find((item) => item.id === licenseId);
  if (!record) return null;
  const updated = upsertLicenseRecord({
    ...record,
    activatedDeviceIds: ensureArray(record.activatedDeviceIds).filter((item) => item !== deviceId),
  });
  appendActivationLog({
    id: crypto.randomUUID(),
    licenseId,
    customerId: updated.customerId,
    email: updated.email,
    deviceId,
    deviceLabel: "Device removed",
    activatedAt: new Date().toISOString(),
    type: "device_release",
  });
  return updated;
};

const getActiveLicense = () => {
  const activation = getStoredActivation();
  if (!activation?.email || !activation?.key) return null;
  try {
    const { payload, record } = validateLicense(activation);
    const deviceId = activation.deviceId || getDeviceId();
    if (!ensureArray(record.activatedDeviceIds).includes(deviceId)) throw new Error("Questo dispositivo non e' piu autorizzato");
    return {
      ...activation,
      ...payload,
      record,
      deviceId,
      customerName: record.customerName,
      status: parseLicenseStatus(record),
      permissions: normalizePermissions(record.permissions ?? payload.permissions, record.isAdmin),
    };
  } catch {
    return null;
  }
};

const getLicenseDashboardSummary = () => {
  const licenses = listLicenseRecords();
  const customers = listCustomers();
  const activations = listActivationLogs();
  return {
    customers: customers.length,
    licenses: licenses.length,
    activeLicenses: licenses.filter((record) => parseLicenseStatus(record) === LICENSE_STATUS.ACTIVE).length,
    expiringSoon: licenses.filter((record) => {
      if (!record.expiresAt) return false;
      const diff = Date.parse(record.expiresAt) - Date.now();
      return diff > 0 && diff <= 15 * 24 * 60 * 60 * 1000;
    }).length,
    activations: activations.length,
  };
};

const ensureOwnerSetup = () => {
  let ownerCustomer = findCustomerByEmail(OWNER_EMAIL);
  if (!ownerCustomer) {
    ownerCustomer = createCustomer({
      name: "Michele Giuliano",
      email: OWNER_EMAIL,
      company: "BingoVoice Owner",
      notes: "Profilo proprietario prioritario",
      priority: "owner",
    });
  }

  const ownerRecord = listLicenseRecords().find((record) => record.email === OWNER_EMAIL && record.plan === "owner");
  if (!ownerRecord) {
    createAndStoreLicenseRecord({
      customerId: ownerCustomer.id,
      customerName: ownerCustomer.name,
      email: OWNER_EMAIL,
      expiresAt: null,
      plan: "owner",
      isAdmin: true,
      label: "Owner",
      notes: "Licenza proprietaria permanente",
      maxDevices: 10,
      permissions: {
        [LICENSE_PERMISSIONS.ADMIN_PANEL]: true,
        [LICENSE_PERMISSIONS.PROJECTS]: true,
        [LICENSE_PERMISSIONS.CARD_MANAGER]: true,
        [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: true,
        [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: true,
      },
      paymentStatus: "internal",
    });
  }
};

ensureOwnerSetup();

export const licensingFallback = {
  OWNER_EMAIL,
  listCustomers,
  listLicenseRecords,
  listActivationLogs,
  getStoredActivation,
  getActiveLicense,
  getLicenseDashboardSummary,
  createCustomer,
  updateCustomer,
  createAndStoreLicenseRecord,
  updateLicenseRecord,
  renewLicenseRecord,
  activateLicense,
  deactivateLicense,
  releaseDeviceFromLicense,
  activateOwnerAccess: () => {
    const ownerRecord = listLicenseRecords().find((record) => record.email === OWNER_EMAIL && record.plan === "owner");
    if (!ownerRecord) throw new Error("Licenza proprietario non disponibile");
    return activateLicense({ email: OWNER_EMAIL, key: ownerRecord.key });
  },
};
