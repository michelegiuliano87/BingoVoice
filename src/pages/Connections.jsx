import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";
import usePersistentTheme from "@/hooks/usePersistentTheme";

export default function Connections() {
  const { isDark } = usePersistentTheme();
  const { isAdmin, hasPermission } = useLicense();
  const canManage = isAdmin || hasPermission(LICENSE_PERMISSIONS.ADMIN_PANEL);
  const [serverInfo, setServerInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [selectedIp, setSelectedIp] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [restartInfo, setRestartInfo] = useState(null);
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sending, setSending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [testingServer, setTestingServer] = useState(false);

  const enrichStatus = (status) => {
    if (!status) return null;
    const ip = status.ip || status.currentIp || null;
    const port = status.port || status.currentPort || null;
    const url = status.url || (ip && port ? `http://${ip}:${port}` : null);
    return { ...status, ip, port, url };
  };

  const normalizeStatus = (status) => {
    const enriched = enrichStatus(status);
    if (!enriched || enriched.error || !enriched.url || !enriched.ip || !enriched.port) {
      return {
        ok: false,
        status: null,
        message: `Server non pronto: ${enriched?.error || "not-ready"}`,
      };
    }
    return { ok: true, status: enriched, message: "Server pronto." };
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      let status = await window.desktopAPI?.ensureLocalServer?.();
      if (!status || status?.error) {
        status = await window.desktopAPI?.getLocalServerStatus?.();
      }
      if (!active) return;
      const normalized = normalizeStatus(status);
      setServerInfo(normalized.status);
      setStatusMessage(normalized.message);
      if (!normalized.ok && status?.error === "not-ready") {
        const restarted = await window.desktopAPI?.restartLocalServer?.();
        const normalizedRestart = normalizeStatus(restarted);
        setServerInfo(normalizedRestart.status);
        setStatusMessage(normalizedRestart.message);
      }
    };
    loadStatus();
    const interval = setInterval(loadStatus, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConnections = async () => {
      const next = await window.desktopAPI?.getLocalServerConnections?.();
      if (!active) return;
      setConnections(Array.isArray(next) ? next : []);
    };
    loadConnections();
    const interval = setInterval(loadConnections, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!serverInfo?.url) {
      setQrDataUrl("");
      return;
    }
    const host = selectedIp || serverInfo.ip;
    const url = host ? `http://${host}:${serverInfo.port}` : serverInfo.url;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [serverInfo, selectedIp]);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.name })),
    [projects],
  );

  const handleSend = async (clientId) => {
    if (!serverInfo?.url) return;
    setSending(true);
    try {
      await window.desktopAPI?.pushCardsToMobile?.({
        projectId: selectedProjectId || null,
        clientId: clientId || null,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendQrToScreen = async () => {
    if (!serverInfo?.url) return;
    const host = selectedIp || serverInfo.ip;
    const url = host ? `http://${host}:${serverInfo.port}` : serverInfo.url;
    if (!qrVisible) {
      await base44.entities.ScreenCommand.create({
        command_type: "show_qr",
        extraction_id: JSON.stringify({ url }),
      });
      setQrVisible(true);
      return;
    }
    await base44.entities.ScreenCommand.create({ command_type: "hide_qr" });
    setQrVisible(false);
  };

  const handleEnsureServer = async () => {
    setRestarting(true);
    setStatusMessage("Riavvio server in corso...");
    setServerInfo(null);
    setRestartInfo(null);
    try {
      let status = (await window.desktopAPI?.restartLocalServer?.()) ||
        (await window.desktopAPI?.ensureLocalServer?.());
      if (!status?.ip || !status?.port) {
        const freshStatus = await window.desktopAPI?.getLocalServerStatus?.();
        if (freshStatus && !freshStatus?.error) {
          status = { ...status, ...freshStatus };
        }
      }
      const normalized = normalizeStatus(status);
      setServerInfo(normalized.status);
      if (!normalized.ok) {
        setRestartInfo(null);
        setStatusMessage(normalized.message);
      } else {
        const restartedAt = status?.restartedAt ? new Date(status.restartedAt).toLocaleTimeString() : null;
        const info = {
          restartedAt,
          previousIp: status?.previousIp || null,
          previousPort: status?.previousPort || null,
          currentIp: status?.currentIp || normalized.status?.ip || null,
          currentPort: status?.currentPort || normalized.status?.port || null,
        };
        setRestartInfo(info);
        const restartedText = restartedAt ? ` Riavviato alle ${restartedAt}.` : "";
        setStatusMessage(`Server pronto.${restartedText}`);
      }
    } finally {
      setRestarting(false);
    }
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    try {
      const result = await window.desktopAPI?.pingLocalServer?.();
      if (result?.ok) {
        toast.success("Server locale raggiungibile.");
      } else {
        toast.error("Server locale non raggiungibile.");
      }
    } catch {
      toast.error("Server locale non raggiungibile.");
    } finally {
      setTestingServer(false);
    }
  };

  const card = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const title = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  if (!canManage) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-50"} p-6`}>
        <div className={`mx-auto max-w-xl rounded-2xl border p-6 ${card}`}>
          <h2 className={`text-lg font-bold ${title}`}>Connessioni</h2>
          <p className={`mt-2 text-sm ${sub}`}>Accesso non disponibile con questa licenza.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-50"} p-6`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`rounded-2xl border p-6 ${card}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={`text-xl font-black ${title}`}>Connessioni Cellulari</h2>
              <p className={`mt-2 text-sm ${sub}`}>
                Scansiona il QR code con il telefono (stessa rete Wi-Fi) per collegarti al pannello mobile.
              </p>
            </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => navigate("/")}>
                  Torna alla Dashboard
                </Button>
              <Button
                onClick={handleEnsureServer}
                disabled={restarting}
                variant="outline"
              >
                {restarting ? "Riavvio..." : "Riavvia Server"}
              </Button>
              <Button
                onClick={handleSendQrToScreen}
                disabled={!serverInfo?.url}
                className={qrVisible ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
              >
                {qrVisible ? "Nascondi QR" : "Invia QR Code a Schermo"}
              </Button>
              <Button
                onClick={handleTestServer}
                disabled={!serverInfo?.url || testingServer}
                variant="secondary"
              >
                {testingServer ? "Test..." : "Test Server"}
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="flex flex-col items-center gap-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR BingoVoice" className="w-56 h-56 rounded-2xl border border-gray-800 bg-black" />
              ) : (
                <div className="w-56 h-56 rounded-2xl border border-dashed border-gray-700 flex items-center justify-center text-xs text-gray-500">
                  QR non disponibile
                </div>
              )}
              <div className={`text-xs ${sub}`}>
                {serverInfo?.url ? serverInfo.url : "Server locale non pronto"}
              </div>
              {serverInfo?.error ? (
                <div className="text-xs text-rose-400">
                  Errore server: {serverInfo.error}
                </div>
              ) : null}
              {statusMessage ? (
                <div className={`text-xs ${serverInfo?.error ? "text-rose-400" : "text-emerald-400"}`}>
                  {statusMessage}
                </div>
              ) : null}
              {restartInfo ? (
                <div className={`text-[11px] ${sub}`}>
                  {restartInfo.previousIp && restartInfo.previousPort
                    ? `Prima: ${restartInfo.previousIp}:${restartInfo.previousPort} • `
                    : ""}
                  {restartInfo.currentIp && restartInfo.currentPort
                    ? `Ora: ${restartInfo.currentIp}:${restartInfo.currentPort}`
                    : "Ora: n/d"}
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              {serverInfo?.ips?.length ? (
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>IP da usare per il QR</label>
                  <select
                    value={selectedIp || serverInfo?.ips?.[0] || ""}
                    onChange={(e) => setSelectedIp(e.target.value)}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                  >
                    {serverInfo.ips.map((ip) => (
                      <option key={ip} value={ip}>{ip}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Progetto da consegnare</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                >
                  <option value="">Tutti i progetti</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleSend(null)}
                  disabled={sending || !connections.length}
                  className="flex-1"
                >
                  Invia cartella casuale a tutti
                </Button>
                <Button
                  onClick={() => handleSend(connections[0]?.id)}
                  disabled={sending || connections.length === 0}
                  variant="secondary"
                  className="flex-1"
                >
                  Invia al primo collegato
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-6 ${card}`}>
          <h3 className={`text-sm font-semibold uppercase tracking-wider ${sub}`}>Dispositivi connessi ({connections.length})</h3>
          {connections.length === 0 ? (
            <p className={`mt-3 text-sm ${sub}`}>Nessun cellulare collegato.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {connections.map((device) => (
                <div key={device.id} className={`rounded-xl border p-4 ${isDark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"}`}>
                  <p className={`text-sm font-semibold ${title}`}>{device.name || "Telefono"}</p>
                  <p className={`text-xs ${sub}`}>{device.ip || "IP non disponibile"}</p>
                  <p className={`text-[11px] ${sub}`}>Ultimo ping: {new Date(device.lastSeen).toLocaleTimeString()}</p>
                  <Button
                    size="sm"
                    onClick={() => handleSend(device.id)}
                    disabled={sending}
                    className="mt-3"
                  >
                    Invia cartella
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
