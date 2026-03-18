import { readProtectedJson, writeProtectedJson, removeProtectedItem } from "@/lib/secureStorage";

const STORAGE_PREFIX = "toretto.local";
const ENTITY_NAMES = [
  "Project",
  "MediaItem",
  "Extraction",
  "VideoButton",
  "AppSettings",
  "PlayerCard",
  "ScreenCommand",
];

const getStorageKey = (entityName) => `${STORAGE_PREFIX}.${entityName}`;

const readCollection = async (entityName) => {
  if (typeof window === "undefined") return [];

  if (window.desktopAPI?.readEntityCollection) {
    const stored = await window.desktopAPI.readEntityCollection(entityName);
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }

    const legacy = readProtectedJson(getStorageKey(entityName), [], `entity:${entityName}`);
    if (Array.isArray(legacy) && legacy.length) {
      await window.desktopAPI.writeEntityCollection(entityName, legacy);
      removeProtectedItem(getStorageKey(entityName));
      return legacy;
    }

    return Array.isArray(stored) ? stored : [];
  }

  const parsed = readProtectedJson(getStorageKey(entityName), [], `entity:${entityName}`);
  return Array.isArray(parsed) ? parsed : [];
};

const writeCollection = async (entityName, items) => {
  if (window?.desktopAPI?.writeEntityCollection) {
    await window.desktopAPI.writeEntityCollection(entityName, items);
  } else {
    writeProtectedJson(getStorageKey(entityName), items, `entity:${entityName}`);
  }
  window.dispatchEvent(
    new CustomEvent("bingovoice:data-changed", {
      detail: { entityName, timestamp: Date.now() },
    })
  );
};

const compareValues = (left, right, descending) => {
  if (left == null && right == null) return 0;
  if (left == null) return descending ? 1 : -1;
  if (right == null) return descending ? -1 : 1;

  if (typeof left === "number" && typeof right === "number") {
    return descending ? right - left : left - right;
  }

  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return descending ? rightDate - leftDate : leftDate - rightDate;
  }

  const result = String(left).localeCompare(String(right), "it", {
    numeric: true,
    sensitivity: "base",
  });
  return descending ? result * -1 : result;
};

const sortItems = (items, sortBy) => {
  if (!sortBy) return [...items];
  const descending = sortBy.startsWith("-");
  const field = descending ? sortBy.slice(1) : sortBy;
  return [...items].sort((a, b) => compareValues(a?.[field], b?.[field], descending));
};

const makeEntityApi = (entityName) => ({
  async list(sortBy, limit) {
    const items = sortItems(await readCollection(entityName), sortBy);
    if (typeof limit === "number") {
      return items.slice(0, limit);
    }
    return items;
  },

  async create(payload) {
    const items = await readCollection(entityName);
    const now = new Date().toISOString();
    const created = {
      id: crypto.randomUUID(),
      created_date: now,
      updated_date: now,
      ...payload,
    };
    items.push(created);
    await writeCollection(entityName, items);
    return created;
  },

  async update(id, patch) {
    const items = await readCollection(entityName);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`${entityName} ${id} non trovato`);
    }

    const updated = {
      ...items[index],
      ...patch,
      id,
      updated_date: new Date().toISOString(),
    };
    items[index] = updated;
    await writeCollection(entityName, items);
    return updated;
  },

  async delete(id) {
    const items = await readCollection(entityName);
    const filtered = items.filter((item) => item.id !== id);
    await writeCollection(entityName, filtered);
    return { success: true };
  },
});

const fileToDataUrl = async (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Impossibile leggere il file"));
    reader.readAsDataURL(file);
  });

const uploadFile = async ({ file }) => {
  if (!file) {
    throw new Error("Nessun file selezionato");
  }

  if (window.desktopAPI?.saveMediaFile) {
    const bytes = await file.arrayBuffer();
    const file_url = await window.desktopAPI.saveMediaFile({
      name: file.name,
      bytes: Array.from(new Uint8Array(bytes)),
    });
    return { file_url };
  }

  const file_url = await fileToDataUrl(file);
  return { file_url };
};

export const base44 = {
  entities: Object.fromEntries(
    ENTITY_NAMES.map((entityName) => [entityName, makeEntityApi(entityName)])
  ),
  integrations: {
    Core: {
      UploadFile: uploadFile,
    },
  },
  auth: {
    async me() {
      return { id: "local-user", role: "admin", email: "local@bingovoice.app" };
    },
    logout() {},
    redirectToLogin() {},
  },
};
