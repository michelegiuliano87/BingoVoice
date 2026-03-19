import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  const [connections, setConnections] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sending, setSending] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      const status = await window.desktopAPI?.getLocalServerStatus?.();
      if (!active) return;
      setServerInfo(status);
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
    QRCode.toDataURL(serverInfo.url, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [serverInfo]);

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
    if (!qrVisible) {
      await base44.entities.ScreenCommand.create({
        command_type: "show_qr",
        extraction_id: JSON.stringify({ url: serverInfo.url }),
      });
      setQrVisible(true);
      return;
    }
    await base44.entities.ScreenCommand.create({ command_type: "hide_qr" });
    setQrVisible(false);
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
            <Button
              onClick={handleSendQrToScreen}
              disabled={!serverInfo?.url}
              className={qrVisible ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {qrVisible ? "Nascondi QR" : "Invia QR Code a Schermo"}
            </Button>
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
            </div>
            <div className="space-y-4">
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
