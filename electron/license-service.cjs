const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const OWNER_EMAIL = "michele.giuliano.87@hotmail.com";
const LICENSE_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  ARCHIVED: "archived",
};

const LICENSE_PERMISSIONS = {
  ADMIN_PANEL: "adminPanel",
  PROJECTS: "projects",
  CARD_MANAGER: "cardManager",
  VIDEO_BUTTONS: "videoButtons",
  GENERAL_SETTINGS: "generalSettings",
};

const DEFAULT_LICENSE_PERMISSIONS = {
  [LICENSE_PERMISSIONS.ADMIN_PANEL]: false,
  [LICENSE_PERMISSIONS.PROJECTS]: false,
  [LICENSE_PERMISSIONS.CARD_MANAGER]: false,
  [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: false,
  [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: false,
};

const LICENSE_SECRET_SALT = "toretto-license-salt-v4";
const STORE_SECRET = "toretto-license-store-v1";
const STORE_PREFIX = "licstore:v1:";
const DEFAULT_PLAN = "standard";
const DEFAULT_MAX_DEVICES = 1;

function getStorePath(app) {
  return path.join(app.getPath("userData"), "licenses-store.json");
}

function deriveStoreKey(namespace = "core") {
  return crypto.scryptSync(
    `${STORE_SECRET}|${os.hostname()}|${os.userInfo().username}|${os.platform()}|${os.arch()}`,
    `bingovoice|${namespace}`,
    32,
  );
}

function encryptStore(payload, namespace = "core") {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveStoreKey(namespace), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${STORE_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
}

function decryptStore(raw, namespace = "core") {
  const text = String(raw || "");
  if (!text.startsWith(STORE_PREFIX)) {
    return JSON.parse(text);
  }

  const payload = Buffer.from(text.slice(STORE_PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveStoreKey(namespace), iv);
  decipher.setAuthTag(authTag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizePermissions(permissions = {}, isAdmin = false) {
  return {
    ...DEFAULT_LICENSE_PERMISSIONS,
    ...permissions,
    ...(isAdmin ? { [LICENSE_PERMISSIONS.ADMIN_PANEL]: true } : {}),
  };
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("hex").toUpperCase();
}

function decodePayload(encoded) {
  return JSON.parse(Buffer.from(encoded, "hex").toString("utf8"));
}

function signPayload(payload) {
  return hashString(`${JSON.stringify(payload)}|${LICENSE_SECRET_SALT}`);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortByDateDesc(items, field) {
  return [...items].sort((left, right) => Date.parse(right?.[field] || 0) - Date.parse(left?.[field] || 0));
}

function formatLicenseBody(value) {
  return value.match(/.{1,4}/g)?.join("-") || value;
}

function isOwnerEmail(email) {
  return normalizeEmail(email) === OWNER_EMAIL;
}

function parseLicenseStatus(record) {
  if (!record) return LICENSE_STATUS.REVOKED;
  if (record.status === LICENSE_STATUS.REVOKED) return LICENSE_STATUS.REVOKED;
  if (record.status === LICENSE_STATUS.SUSPENDED) return LICENSE_STATUS.SUSPENDED;
  if (record.status === LICENSE_STATUS.ARCHIVED) return LICENSE_STATUS.ARCHIVED;
  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) return "expired";
  return LICENSE_STATUS.ACTIVE;
}

function getDeviceLabel() {
  return `${os.hostname()} - ${os.platform()} ${os.arch()}`;
}

function createDefaultStore() {
  return {
    version: 1,
    deviceId: crypto.randomUUID(),
    customers: [],
    licenses: [],
    activations: [],
    activation: null,
  };
}

async function readStore(app) {
  try {
    const raw = await fs.readFile(getStorePath(app), "utf8");
    const parsed = decryptStore(raw, "licenses");
    return {
      ...createDefaultStore(),
      ...parsed,
      customers: ensureArray(parsed.customers),
      licenses: ensureArray(parsed.licenses),
      activations: ensureArray(parsed.activations),
    };
  } catch {
    return createDefaultStore();
  }
}

async function writeStore(app, store) {
  await fs.writeFile(getStorePath(app), encryptStore(store, "licenses"), "utf8");
}

function buildPayload({
  customerId,
  email,
  plan = DEFAULT_PLAN,
  expiresAt = null,
  isAdmin = false,
  maxDevices = DEFAULT_MAX_DEVICES,
  label = "",
  permissions = DEFAULT_LICENSE_PERMISSIONS,
}) {
  return {
    v: 4,
    customerId,
    email: normalizeEmail(email),
    plan,
    expiresAt,
    isAdmin,
    maxDevices,
    label: normalizeString(label),
    permissions: normalizePermissions(permissions, isAdmin),
    nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase(),
  };
}

function buildLicenseKey(input) {
  const payload = buildPayload(input);
  const encoded = encodePayload(payload);
  const signature = signPayload(payload);
  return `BV-${formatLicenseBody(encoded)}-${signature}`;
}

function parseLicenseKey(key) {
  const sanitized = String(key || "").trim().toUpperCase();
  if (!sanitized.startsWith("BV-")) {
    throw new Error("Formato licenza non valido");
  }

  const lastDash = sanitized.lastIndexOf("-");
  if (lastDash <= 2) {
    throw new Error("Struttura licenza non valida");
  }

  const encoded = sanitized.slice(3, lastDash).replace(/-/g, "");
  const signature = sanitized.slice(lastDash + 1);
  const payload = decodePayload(encoded);
  const expectedSignature = signPayload(payload);
  if (signature !== expectedSignature) {
    throw new Error("Firma licenza non valida");
  }
  return payload;
}

function findCustomerByEmail(store, email) {
  return store.customers.find((customer) => customer.email === normalizeEmail(email));
}

function findLicenseRecordByKey(store, key) {
  return store.licenses.find((record) => record.key === String(key || "").trim().toUpperCase());
}

function getLicensePermissions(license) {
  return normalizePermissions(license?.permissions, license?.isAdmin || isOwnerEmail(license?.email));
}

function sanitizeActiveLicense(store) {
  const activation = store.activation;
  if (!activation?.email || !activation?.key) return null;

  try {
    const payload = parseLicenseKey(activation.key);
    const record = findLicenseRecordByKey(store, activation.key);
    if (!record) return null;
    const deviceId = activation.deviceId || store.deviceId;
    if (!ensureArray(record.activatedDeviceIds).includes(deviceId)) return null;

    const status = parseLicenseStatus(record);
    if (status !== LICENSE_STATUS.ACTIVE) return null;

    return {
      ...activation,
      ...payload,
      record,
      deviceId,
      status,
      customerName: record.customerName,
      permissions: normalizePermissions(record.permissions ?? payload.permissions, record.isAdmin),
    };
  } catch {
    return null;
  }
}

function getSummary(store) {
  return {
    customers: store.customers.length,
    licenses: store.licenses.length,
    activeLicenses: store.licenses.filter((record) => parseLicenseStatus(record) === LICENSE_STATUS.ACTIVE).length,
    expiringSoon: store.licenses.filter((record) => {
      if (!record.expiresAt) return false;
      const diff = Date.parse(record.expiresAt) - Date.now();
      return diff > 0 && diff <= 15 * 24 * 60 * 60 * 1000;
    }).length,
    activations: store.activations.length,
  };
}

function getSnapshot(store) {
  return {
    ownerEmail: OWNER_EMAIL,
    activeLicense: sanitizeActiveLicense(store),
    storedActivation: store.activation,
    customers: sortByDateDesc(store.customers, "createdAt"),
    licenses: sortByDateDesc(store.licenses, "createdAt"),
    activations: sortByDateDesc(store.activations, "activatedAt"),
    summary: getSummary(store),
  };
}

function ensureOwnerSetup(store) {
  let ownerCustomer = findCustomerByEmail(store, OWNER_EMAIL);
  if (!ownerCustomer) {
    ownerCustomer = {
      id: crypto.randomUUID(),
      name: "Michele Giuliano",
      email: OWNER_EMAIL,
      company: "BingoVoice Owner",
      notes: "Profilo proprietario prioritario",
      priority: "owner",
      createdAt: new Date().toISOString(),
    };
    store.customers.unshift(ownerCustomer);
  }

  const existingOwner = store.licenses.find((record) => record.email === OWNER_EMAIL && record.plan === "owner");
  if (!existingOwner) {
    const key = buildLicenseKey({
      customerId: ownerCustomer.id,
      email: OWNER_EMAIL,
      plan: "owner",
      expiresAt: null,
      isAdmin: true,
      maxDevices: 10,
      label: "Owner",
      permissions: {
        [LICENSE_PERMISSIONS.ADMIN_PANEL]: true,
        [LICENSE_PERMISSIONS.PROJECTS]: true,
        [LICENSE_PERMISSIONS.CARD_MANAGER]: true,
        [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: true,
        [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: true,
      },
    });

    store.licenses.unshift({
      id: crypto.randomUUID(),
      customerId: ownerCustomer.id,
      customerName: ownerCustomer.name,
      email: OWNER_EMAIL,
      key,
      plan: "owner",
      status: LICENSE_STATUS.ACTIVE,
      isAdmin: true,
      label: "Owner",
      notes: "Licenza proprietaria permanente",
      startsAt: new Date().toISOString(),
      expiresAt: null,
      maxDevices: 10,
      permissions: {
        [LICENSE_PERMISSIONS.ADMIN_PANEL]: true,
        [LICENSE_PERMISSIONS.PROJECTS]: true,
        [LICENSE_PERMISSIONS.CARD_MANAGER]: true,
        [LICENSE_PERMISSIONS.VIDEO_BUTTONS]: true,
        [LICENSE_PERMISSIONS.GENERAL_SETTINGS]: true,
      },
      paymentStatus: "internal",
      createdAt: new Date().toISOString(),
      createdBy: OWNER_EMAIL,
      activatedDeviceIds: [],
      lastActivatedAt: null,
      renewalHistory: [],
    });
  }
}

function validateLicense(store, { email, key }) {
  const payload = parseLicenseKey(key);
  const normalizedEmail = normalizeEmail(email);
  if (payload.email !== normalizedEmail) {
    throw new Error("La licenza non corrisponde a questa email");
  }

  const record = findLicenseRecordByKey(store, key);
  if (!record) {
    throw new Error("Licenza non registrata nel gestionale");
  }

  const status = parseLicenseStatus(record);
  if (status === LICENSE_STATUS.SUSPENDED) throw new Error("Licenza sospesa");
  if (status === LICENSE_STATUS.REVOKED) throw new Error("Licenza revocata");
  if (status === LICENSE_STATUS.ARCHIVED) throw new Error("Licenza archiviata");
  if (status === "expired") throw new Error("La licenza e' scaduta");

  return { payload, record };
}

function replaceById(items, record) {
  return [record, ...items.filter((item) => item.id !== record.id)];
}

function appendActivationLog(store, entry) {
  store.activations = [entry, ...store.activations];
}

async function updateCachedLicenseState(app, writer, store) {
  const activeLicense = sanitizeActiveLicense(store);
  await writer({
    hasActiveLicense: Boolean(activeLicense),
    email: activeLicense?.email || "",
    updatedAt: new Date().toISOString(),
  });
}

function createService(app, onChange, writeCachedLicenseState) {
  async function loadStore() {
    const store = await readStore(app);
    ensureOwnerSetup(store);
    return store;
  }

  async function saveAndBroadcast(store) {
    await writeStore(app, store);
    await updateCachedLicenseState(app, writeCachedLicenseState, store);
    onChange(getSnapshot(store));
  }

  return {
    OWNER_EMAIL,
    LICENSE_STATUS,
    LICENSE_PERMISSIONS,
    DEFAULT_LICENSE_PERMISSIONS,
    async getSnapshot() {
      const store = await loadStore();
      await writeStore(app, store);
      return getSnapshot(store);
    },
    async activateLicense({ email, key }) {
      const store = await loadStore();
      const { payload, record } = validateLicense(store, { email, key });
      const deviceId = store.deviceId || crypto.randomUUID();
      store.deviceId = deviceId;
      const activatedDevices = ensureArray(record.activatedDeviceIds);
      const alreadyBound = activatedDevices.includes(deviceId);

      if (!alreadyBound && activatedDevices.length >= (record.maxDevices || payload.maxDevices || DEFAULT_MAX_DEVICES)) {
        throw new Error("Numero massimo di dispositivi raggiunto per questa licenza");
      }

      const updatedRecord = {
        ...record,
        activatedDeviceIds: alreadyBound ? activatedDevices : [...activatedDevices, deviceId],
        lastActivatedAt: new Date().toISOString(),
        lastDeviceLabel: getDeviceLabel(),
      };
      store.licenses = replaceById(store.licenses, updatedRecord);

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

      store.activation = activation;
      appendActivationLog(store, {
        id: crypto.randomUUID(),
        licenseId: updatedRecord.id,
        customerId: updatedRecord.customerId,
        email: updatedRecord.email,
        deviceId,
        deviceLabel: getDeviceLabel(),
        activatedAt: activation.activatedAt,
        type: alreadyBound ? "revalidation" : "activation",
      });

      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async activateOwnerAccess() {
      const store = await loadStore();
      ensureOwnerSetup(store);
      const owner = store.licenses.find((record) => record.email === OWNER_EMAIL && record.plan === "owner");
      if (!owner) {
        throw new Error("Licenza proprietario non disponibile");
      }
      await saveAndBroadcast(store);
      return this.activateLicense({ email: OWNER_EMAIL, key: owner.key });
    },
    async deactivateLicense() {
      const store = await loadStore();
      store.activation = null;
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async createCustomer(payload) {
      const store = await loadStore();
      const customer = {
        id: crypto.randomUUID(),
        name: normalizeString(payload.name),
        email: normalizeEmail(payload.email),
        company: normalizeString(payload.company),
        phone: normalizeString(payload.phone),
        notes: normalizeString(payload.notes),
        priority: payload.priority || "standard",
        createdAt: new Date().toISOString(),
      };
      store.customers = [customer, ...store.customers.filter((item) => item.email !== customer.email)];
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async updateCustomer(id, patch) {
      const store = await loadStore();
      store.customers = store.customers.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer));
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async createLicenseRecord(payload) {
      const store = await loadStore();
      const normalizedEmail = normalizeEmail(payload.email);
      let customer = payload.customerId
        ? store.customers.find((item) => item.id === payload.customerId)
        : findCustomerByEmail(store, normalizedEmail);

      if (!customer) {
        customer = {
          id: crypto.randomUUID(),
          name: payload.customerName || normalizedEmail,
          email: normalizedEmail,
          company: normalizeString(payload.company),
          phone: normalizeString(payload.phone),
          notes: normalizeString(payload.notes),
          priority: isOwnerEmail(normalizedEmail) ? "owner" : "standard",
          createdAt: new Date().toISOString(),
        };
        store.customers.unshift(customer);
      }

      const key = buildLicenseKey({
        customerId: customer.id,
        email: normalizedEmail,
        plan: payload.plan,
        expiresAt: payload.expiresAt,
        isAdmin: payload.isAdmin,
        maxDevices: payload.maxDevices,
        label: payload.label,
        permissions: payload.permissions,
      });

      const record = {
        id: crypto.randomUUID(),
        customerId: customer.id,
        customerName: customer.name,
        email: normalizedEmail,
        key,
        plan: payload.plan || DEFAULT_PLAN,
        status: LICENSE_STATUS.ACTIVE,
        isAdmin: Boolean(payload.isAdmin),
        label: normalizeString(payload.label),
        notes: normalizeString(payload.notes),
        startsAt: payload.startsAt || new Date().toISOString(),
        expiresAt: payload.expiresAt || null,
        maxDevices: Math.max(1, Number(payload.maxDevices) || DEFAULT_MAX_DEVICES),
        permissions: normalizePermissions(payload.permissions, payload.isAdmin),
        paymentStatus: payload.paymentStatus || "paid",
        createdAt: new Date().toISOString(),
        createdBy: OWNER_EMAIL,
        activatedDeviceIds: [],
        lastActivatedAt: null,
        renewalHistory: [],
      };

      store.licenses = replaceById(store.licenses, record);
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async updateLicenseRecord(id, patch) {
      const store = await loadStore();
      const current = store.licenses.find((record) => record.id === id);
      if (!current) return getSnapshot(store);
      const updated = {
        ...current,
        ...patch,
        permissions: normalizePermissions(patch.permissions ?? current.permissions, patch.isAdmin ?? current.isAdmin),
      };
      store.licenses = replaceById(store.licenses, updated);
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async renewLicenseRecord({ id, extraDays, newPlan, maxDevices, notes = "" }) {
      const store = await loadStore();
      const current = store.licenses.find((record) => record.id === id);
      if (!current) return getSnapshot(store);
      const baseDate =
        current.expiresAt && Date.parse(current.expiresAt) > Date.now() ? new Date(current.expiresAt) : new Date();
      const expiresAt = extraDays ? new Date(baseDate.getTime() + extraDays * 86400000).toISOString() : null;
      const updated = {
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
      };
      store.licenses = replaceById(store.licenses, updated);
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async releaseDeviceFromLicense({ licenseId, deviceId }) {
      const store = await loadStore();
      const record = store.licenses.find((item) => item.id === licenseId);
      if (!record) return getSnapshot(store);
      const updated = {
        ...record,
        activatedDeviceIds: ensureArray(record.activatedDeviceIds).filter((item) => item !== deviceId),
      };
      store.licenses = replaceById(store.licenses, updated);
      appendActivationLog(store, {
        id: crypto.randomUUID(),
        licenseId,
        customerId: updated.customerId,
        email: updated.email,
        deviceId,
        deviceLabel: "Device removed",
        activatedAt: new Date().toISOString(),
        type: "device_release",
      });
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    async importLegacyData(payload) {
      const store = await loadStore();
      const legacyCustomers = ensureArray(payload?.customers);
      const legacyLicenses = ensureArray(payload?.licenses);
      const legacyActivations = ensureArray(payload?.activations);
      const legacyActivation = payload?.activation || null;

      for (const customer of legacyCustomers) {
        if (!store.customers.some((item) => item.id === customer.id || item.email === customer.email)) {
          store.customers.push(customer);
        }
      }

      for (const license of legacyLicenses) {
        if (!store.licenses.some((item) => item.id === license.id || item.key === license.key)) {
          store.licenses.push(license);
        }
      }

      for (const activation of legacyActivations) {
        if (!store.activations.some((item) => item.id === activation.id)) {
          store.activations.push(activation);
        }
      }

      if (!store.activation && legacyActivation) {
        store.activation = legacyActivation;
      }

      ensureOwnerSetup(store);
      await saveAndBroadcast(store);
      return getSnapshot(store);
    },
    getLicensePermissions,
    isOwnerEmail,
  };
}

module.exports = {
  createService,
  OWNER_EMAIL,
  LICENSE_STATUS,
  LICENSE_PERMISSIONS,
  DEFAULT_LICENSE_PERMISSIONS,
};
