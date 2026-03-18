import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FolderArchive, Loader2, Moon, PackageOpen, Sparkles, Sun, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import usePersistentTheme from "@/hooks/usePersistentTheme";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";
import { buildProjectPackage, importProjectPackage } from "@/lib/projectPackage";

export default function ImportExportProject() {
  const queryClient = useQueryClient();
  const { isDark, toggleTheme } = usePersistentTheme();
  const { hasPermission } = useLicense();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const { data: mediaItems = [] } = useQuery({
    queryKey: ["mediaItems"],
    queryFn: () => base44.entities.MediaItem.list("-created_date"),
  });

  const { data: playerCards = [] } = useQuery({
    queryKey: ["playerCards"],
    queryFn: () => base44.entities.PlayerCard.list("card_number"),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: videoButtons = [] } = useQuery({
    queryKey: ["videoButtons"],
    queryFn: () => base44.entities.VideoButton.list("-created_date"),
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const projectMedia = useMemo(
    () => mediaItems.filter((item) => item.project_id === selectedProjectId),
    [mediaItems, selectedProjectId],
  );

  const projectCards = useMemo(
    () => playerCards.filter((card) => card.project_id === selectedProjectId),
    [playerCards, selectedProjectId],
  );

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["mediaItems"] });
    queryClient.invalidateQueries({ queryKey: ["playerCards"] });
    queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    queryClient.invalidateQueries({ queryKey: ["videoButtons"] });
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    setBusyAction("export");
    setFeedback("");

    try {
      if (!window?.desktopAPI?.saveProjectPackage) {
        setFeedback("Funzione di esportazione non disponibile in questa modalita. Apri il programma desktop.");
        return;
      }
      const packageData = await buildProjectPackage({
        project: selectedProject,
        mediaItems: projectMedia,
        playerCards: projectCards,
        appSettings: appSettings[0] || null,
        videoButtons,
      });

      const result = await window.desktopAPI.saveProjectPackage({
        suggestedName: `${selectedProject.name.replace(/[\\/:*?"<>|]+/g, "-") || "progetto"}.bvpack`,
        packageData,
      });

      if (!result?.canceled) {
        setFeedback(`Progetto esportato in: ${result.filePath}`);
      }
    } catch (error) {
      setFeedback(error.message || "Esportazione non riuscita");
    } finally {
      setBusyAction("");
    }
  };

  const handleImport = async () => {
    setBusyAction("import");
    setFeedback("");

    try {
      if (!window?.desktopAPI?.openProjectPackage) {
        setFeedback("Funzione di importazione non disponibile in questa modalita. Apri il programma desktop.");
        return;
      }
      const result = await window.desktopAPI.openProjectPackage();
      if (result?.canceled || !result.packageData) {
        setBusyAction("");
        return;
      }

      const createdProject = await importProjectPackage(result.packageData);
      refreshAll();
      setSelectedProjectId(createdProject.id);
      setFeedback(`Progetto importato con successo: ${createdProject.name}`);
    } catch (error) {
      setFeedback(error.message || "Importazione non riuscita");
    } finally {
      setBusyAction("");
    }
  };

  const pageBg = isDark ? "bg-gray-950" : "bg-slate-50";
  const header = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200";
  const panel = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200";
  const title = isDark ? "text-white" : "text-slate-900";
  const sub = isDark ? "text-gray-400" : "text-slate-500";
  const empty = isDark ? "border-gray-700 bg-gray-950 text-gray-400" : "border-slate-200 bg-slate-50 text-slate-500";

  if (!hasPermission(LICENSE_PERMISSIONS.PROJECTS)) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md rounded-3xl border p-8 text-center shadow-sm ${panel}`}>
          <h1 className={`text-2xl font-black ${title}`}>Importa/Esporta non attivo</h1>
          <p className={`mt-3 text-sm ${sub}`}>
            Questa licenza non ha il permesso per creare o trasferire pacchetti progetto.
          </p>
          <Button asChild className="mt-6">
            <Link to="/Dashboard">Torna alla Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className={`border-b ${header}`}>
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-600">BingoVoice</p>
            <h1 className={`mt-1 text-2xl font-black tracking-tight ${title}`}>Importa/Esporta Progetto</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              Crea un pacchetto cliente completo oppure importa un progetto gia pronto senza condividere il codice sorgente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-500" />}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/Projects">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna ai Progetti
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? "bg-cyan-500/10 text-cyan-300" : "bg-cyan-50 text-cyan-600"}`}>
              <FolderArchive className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${sub}`}>Pacchetto Cliente</p>
              <h2 className={`mt-1 text-lg font-black ${title}`}>Seleziona il progetto</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {projects.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-5 text-sm ${empty}`}>
                Nessun progetto disponibile da esportare.
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    selectedProjectId === project.id
                      ? isDark
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-cyan-300 bg-cyan-50"
                      : isDark
                        ? "border-gray-800 bg-gray-950 hover:border-cyan-700"
                        : "border-slate-200 bg-white hover:border-cyan-200"
                  }`}
                >
                  <div className={`h-16 w-16 overflow-hidden rounded-2xl ${isDark ? "bg-gray-800" : "bg-slate-100"}`}>
                    {project.image_url ? (
                      <img src={project.image_url} alt={project.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-bold ${title}`}>{project.name}</p>
                    <p className={`mt-1 text-xs ${sub}`}>
                      {mediaItems.filter((item) => item.project_id === project.id).length} media
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-950" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <PackageOpen className="h-5 w-5 text-cyan-500" />
                <div>
                  <h2 className={`text-lg font-black ${title}`}>Esporta progetto</h2>
                  <p className={`text-sm ${sub}`}>Include progetto, media, cartelle, pulsanti video e impostazioni generali.</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <p className={sub}>Progetto selezionato: <span className={title}>{selectedProject?.name || "nessuno"}</span></p>
                <p className={sub}>Media inclusi: <span className={title}>{projectMedia.length}</span></p>
                <p className={sub}>Cartelle incluse: <span className={title}>{projectCards.length}</span></p>
                <p className={sub}>Pulsanti video inclusi: <span className={title}>{videoButtons.length}</span></p>
              </div>
              <Button onClick={handleExport} disabled={!selectedProject || busyAction !== ""} className="mt-6 w-full bg-cyan-600 hover:bg-cyan-700">
                {busyAction === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Esporta .bvpack
              </Button>
            </div>

            <div className={`rounded-2xl border p-5 ${isDark ? "border-gray-800 bg-gray-950" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-violet-500" />
                <div>
                  <h2 className={`text-lg font-black ${title}`}>Importa progetto</h2>
                  <p className={`text-sm ${sub}`}>Installa un pacchetto cliente completo sul PC di destinazione.</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <p className={sub}>Formato supportato: <span className={title}>.bvpack</span></p>
                <p className={sub}>L&apos;import crea un nuovo progetto e ricostruisce file e collegamenti necessari.</p>
              </div>
              <Button onClick={handleImport} disabled={busyAction !== ""} className="mt-6 w-full bg-violet-600 hover:bg-violet-700">
                {busyAction === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importa pacchetto
              </Button>
            </div>
          </div>

          {feedback ? (
            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-gray-800 bg-gray-950 text-gray-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              {feedback}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
