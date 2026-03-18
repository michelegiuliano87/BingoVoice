import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Copy,
  KeyRound,
  Laptop,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createAndStoreLicenseRecord,
  DEFAULT_LICENSE_PERMISSIONS,
  createCustomer,
  getLicenseDashboardSummary,
  LICENSE_STATUS,
  LICENSE_PERMISSIONS,
  listActivationLogs,
  listCustomers,
  listLicenseRecords,
  OWNER_EMAIL,
  releaseDeviceFromLicense,
  renewLicenseRecord,
  updateCustomer,
  updateLicenseRecord,
} from "@/lib/licensing";

const DEFAULT_DAYS = 365;
const emptyPermissions = () => ({ ...DEFAULT_LICENSE_PERMISSIONS });

const formatDate = (value) => {
  if (!value) return "Perpetua";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Perpetua" : date.toLocaleDateString("it-IT");
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("it-IT");
};

const statusLabel = (status) => {
  switch (status) {
    case LICENSE_STATUS.ACTIVE:
      return "Attiva";
    case LICENSE_STATUS.SUSPENDED:
      return "Sospesa";
    case LICENSE_STATUS.REVOKED:
      return "Revocata";
    case LICENSE_STATUS.ARCHIVED:
      return "Archiviata";
    case "expired":
      return "Scaduta";
    default:
      return status;
  }
};

const statusClass = (status, isDark) => {
  if (status === LICENSE_STATUS.ACTIVE) {
    return isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700";
  }
  if (status === LICENSE_STATUS.SUSPENDED) {
    return isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700";
  }
  if (status === LICENSE_STATUS.REVOKED || status === "expired") {
    return isDark ? "bg-rose-500/20 text-rose-300" : "bg-rose-100 text-rose-700";
  }
  return isDark ? "bg-slate-500/20 text-slate-300" : "bg-slate-100 text-slate-700";
};

export default function AdminLicensePanel({ isDark }) {
  const [email, setEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [plan, setPlan] = useState("standard");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [maxDevices, setMaxDevices] = useState("1");
  const [latestKey, setLatestKey] = useState("");
  const [feedback, setFeedback] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [renewDays, setRenewDays] = useState("365");
  const [permissions, setPermissions] = useState(emptyPermissions);

  useEffect(() => {
    const sync = () => setRefreshToken((value) => value + 1);
    window.addEventListener("toretto:license-changed", sync);
    return () => window.removeEventListener("toretto:license-changed", sync);
  }, []);

  const summary = useMemo(() => getLicenseDashboardSummary(), [refreshToken]);
  const customers = useMemo(() => listCustomers(), [refreshToken]);
  const licenses = useMemo(() => listLicenseRecords(), [refreshToken]);
  const activations = useMemo(() => listActivationLogs(), [refreshToken]);

  const bg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const box = isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50";
  const input = isDark
    ? "border-gray-600 bg-gray-900 text-white"
    : "border-gray-200 bg-white text-gray-900";

  const forceRefresh = () => setRefreshToken((value) => value + 1);

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("Copiato negli appunti.");
    } catch {
      setFeedback("Copia non riuscita.");
    }
  };

  const handleCreateLicense = (e) => {
    e.preventDefault();
    const normalizedDays = Number.parseInt(days, 10);
    const expiresAt =
      Number.isFinite(normalizedDays) && normalizedDays > 0
        ? new Date(Date.now() + normalizedDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const record = createAndStoreLicenseRecord({
      customerName,
      email,
      company,
      phone,
      expiresAt,
      plan,
      isAdmin: makeAdmin,
      label,
      notes,
      maxDevices: Number.parseInt(maxDevices, 10) || 1,
      permissions,
    });

    setLatestKey(record.key);
    setFeedback(`Licenza creata per ${record.email}`);
    setEmail("");
    setCustomerName("");
    setCompany("");
    setPhone("");
    setDays(String(DEFAULT_DAYS));
    setPlan("standard");
    setLabel("");
    setNotes("");
    setMakeAdmin(false);
    setMaxDevices("1");
    setPermissions(emptyPermissions());
    forceRefresh();
  };

  const handlePermissionToggle = (permission) => {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  };

  const handleCreateCustomer = () => {
    if (!email || !customerName) return;
    createCustomer({
      name: customerName,
      email,
      company,
      phone,
      notes,
      priority: "standard",
    });
    setFeedback(`Cliente creato: ${customerName}`);
    forceRefresh();
  };

  const handleLicenseStatus = (record, status) => {
    updateLicenseRecord(record.id, { status });
    setFeedback(`Licenza ${statusLabel(status).toLowerCase()} per ${record.email}`);
    forceRefresh();
  };

  const handleRenew = (record) => {
    renewLicenseRecord({
      id: record.id,
      extraDays: Number.parseInt(renewDays, 10) || 365,
    });
    setFeedback(`Licenza rinnovata per ${record.email}`);
    forceRefresh();
  };

  const handleReleaseDevice = (record, deviceId) => {
    releaseDeviceFromLicense({ licenseId: record.id, deviceId });
    setFeedback("Dispositivo liberato.");
    forceRefresh();
  };

  const handleCustomerPriority = (customer, priority) => {
    updateCustomer(customer.id, { priority });
    setFeedback(`Priorita aggiornata per ${customer.email}`);
    forceRefresh();
  };

  const handleRecordPermissionToggle = (record, permission) => {
    updateLicenseRecord(record.id, {
      permissions: {
        ...emptyPermissions(),
        ...(record.permissions || {}),
        [permission]: !(record.permissions || {})[permission],
      },
    });
    setFeedback(`Permessi aggiornati per ${record.email}`);
    forceRefresh();
  };

  const permissionOptions = [
    { key: LICENSE_PERMISSIONS.ADMIN_PANEL, label: "Pannello Admin" },
    { key: LICENSE_PERMISSIONS.PROJECTS, label: "Crea/Modifica Progetti" },
    { key: LICENSE_PERMISSIONS.CARD_MANAGER, label: "Carica Cartelle" },
    { key: LICENSE_PERMISSIONS.VIDEO_BUTTONS, label: "Pulsanti Video" },
    { key: LICENSE_PERMISSIONS.GENERAL_SETTINGS, label: "Impostazioni Generali" },
  ];

  return (
    <div className={`rounded-2xl border shadow-sm ${bg}`}>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <h3 className={`text-sm font-semibold uppercase tracking-wider ${text}`}>Admin Licenze Pro</h3>
        </div>
        <p className={`mt-2 text-xs ${sub}`}>
          Gestionale completo licenze BingoVoice. Owner prioritario: {OWNER_EMAIL}
        </p>
      </div>

      <div className="p-5">
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="create">Nuova</TabsTrigger>
            <TabsTrigger value="customers">Clienti</TabsTrigger>
            <TabsTrigger value="licenses">Licenze</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {[
                { label: "Clienti", value: summary.customers, icon: UserRound },
                { label: "Licenze", value: summary.licenses, icon: KeyRound },
                { label: "Attive", value: summary.activeLicenses, icon: ShieldCheck },
                { label: "In scadenza", value: summary.expiringSoon, icon: ShieldAlert },
                { label: "Attivazioni", value: summary.activations, icon: Laptop },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${box}`}>
                  <item.icon className="h-4 w-4 text-cyan-500" />
                  <p className={`mt-3 text-2xl font-black ${text}`}>{item.value}</p>
                  <p className={`text-xs uppercase tracking-wider ${sub}`}>{item.label}</p>
                </div>
              ))}
            </div>

            {latestKey ? (
              <div className={`rounded-2xl border p-4 ${box}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Ultima licenza generata</p>
                  <button type="button" onClick={() => copyToClipboard(latestKey)} className="text-sm font-semibold text-cyan-500">
                    <Copy className="mr-1 inline h-3 w-3" />
                    Copia
                  </button>
                </div>
                <textarea readOnly value={latestKey} rows={4} className={`mt-2 w-full rounded-xl border px-3 py-3 text-xs ${input}`} />
              </div>
            ) : null}

            <div className={`rounded-2xl border p-4 ${box}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${text}`}>Ultime attivazioni</p>
                <button type="button" onClick={forceRefresh} className={`text-xs font-semibold ${sub}`}>
                  <RefreshCw className="mr-1 inline h-3 w-3" />
                  Aggiorna
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {activations.slice(0, 5).map((item) => (
                  <div key={item.id} className={`rounded-xl border px-3 py-3 ${input}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{item.email}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.type === "device_release" ? "bg-rose-100 text-rose-700" : "bg-cyan-100 text-cyan-700"}`}>
                        {item.type}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${sub}`}>{item.deviceLabel}</p>
                    <p className={`text-xs ${sub}`}>{formatDateTime(item.activatedAt)}</p>
                  </div>
                ))}
              </div>
            </div>

            {feedback ? <p className={`text-sm ${sub}`}>{feedback}</p> : null}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <form onSubmit={handleCreateLicense} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Nome cliente</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Email cliente</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Azienda</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Telefono</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Piano</label>
                  <select value={plan} onChange={(e) => setPlan(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`}>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="reseller">Reseller</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Durata giorni</label>
                  <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Max dispositivi</label>
                  <input type="number" min="1" value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div className="flex items-end">
                  <label className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm ${input}`}>
                    <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
                    Accesso ADMIN
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Etichetta</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Note interne</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${box}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Moduli attivi sulla licenza</p>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {permissionOptions.map((permission) => (
                    <label key={permission.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${input}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(permissions[permission.key])}
                        onChange={() => handlePermissionToggle(permission.key)}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handleCreateCustomer} className="flex-1 rounded-xl border border-cyan-500/30 px-4 py-3 text-sm font-bold text-cyan-500">
                  Crea solo cliente
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black uppercase tracking-wider text-gray-900 transition hover:bg-amber-400">
                  Crea licenza
                </button>
              </div>
            </form>

            {feedback ? <p className={`text-sm ${sub}`}>{feedback}</p> : null}
          </TabsContent>

          <TabsContent value="customers" className="space-y-3">
            {customers.map((customer) => (
              <div key={customer.id} className={`rounded-2xl border p-4 ${box}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${text}`}>{customer.name}</p>
                    <p className={`text-xs ${sub}`}>{customer.email}</p>
                    {customer.company ? <p className={`text-xs ${sub}`}>{customer.company}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleCustomerPriority(customer, "vip")} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-semibold text-cyan-500">
                      VIP
                    </button>
                    <button type="button" onClick={() => handleCustomerPriority(customer, "standard")} className="rounded-lg border border-gray-500/20 px-3 py-2 text-xs font-semibold text-gray-400">
                      Standard
                    </button>
                  </div>
                </div>
                <p className={`mt-2 text-xs ${sub}`}>Priorita: {customer.priority || "standard"} · Creato il {formatDate(customer.createdAt)}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="licenses" className="space-y-3">
            <div className="flex items-center gap-3">
              <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Rinnovo rapido giorni</label>
              <input type="number" min="1" value={renewDays} onChange={(e) => setRenewDays(e.target.value)} className={`w-32 rounded-xl border px-3 py-2 text-sm ${input}`} />
            </div>

            {licenses.map((record) => (
              <div key={record.id} className={`rounded-2xl border p-4 ${box}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-cyan-500" />
                      <p className={`text-sm font-semibold ${text}`}>{record.email}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusClass(record.status, isDark)}`}>
                        {statusLabel(record.status)}
                      </span>
                    </div>
                    <p className={`text-xs ${sub}`}>
                      {record.customerName} · {record.plan} · {record.isAdmin ? "ADMIN" : "USER"} · Max {record.maxDevices} device
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {permissionOptions.map((permission) => (
                        <button
                          key={permission.key}
                          type="button"
                          onClick={() => handleRecordPermissionToggle(record, permission.key)}
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                            record.permissions?.[permission.key]
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {permission.label}
                        </button>
                      ))}
                    </div>
                    <p className={`text-xs ${sub}`}>Scadenza: {formatDate(record.expiresAt)} · Ultima attivazione: {formatDateTime(record.lastActivatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => copyToClipboard(record.key)} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-semibold text-cyan-500">
                      <Copy className="mr-1 inline h-3 w-3" />
                      Copia
                    </button>
                    <button type="button" onClick={() => handleRenew(record)} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-500">
                      <RefreshCw className="mr-1 inline h-3 w-3" />
                      Rinnova
                    </button>
                    <button type="button" onClick={() => handleLicenseStatus(record, LICENSE_STATUS.SUSPENDED)} className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-500">
                      Sospendi
                    </button>
                    <button type="button" onClick={() => handleLicenseStatus(record, LICENSE_STATUS.REVOKED)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-500">
                      Revoca
                    </button>
                    <button type="button" onClick={() => handleLicenseStatus(record, LICENSE_STATUS.ACTIVE)} className="rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-500">
                      Riattiva
                    </button>
                  </div>
                </div>

                <div className={`mt-3 rounded-xl border px-3 py-3 text-xs ${input}`}>
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <BadgeCheck className="h-3 w-3 text-amber-500" />
                    Dispositivi autorizzati ({record.activatedDeviceIds?.length || 0}/{record.maxDevices})
                  </div>
                  {record.activatedDeviceIds?.length ? (
                    <div className="space-y-2">
                      {record.activatedDeviceIds.map((deviceId) => (
                        <div key={deviceId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                          <span className="break-all">{deviceId}</span>
                          <button type="button" onClick={() => handleReleaseDevice(record, deviceId)} className="text-rose-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={sub}>Nessun dispositivo attivato.</p>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
