import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MediaItemForm from "@/components/dashboard/MediaItemForm";
import MediaItemList from "@/components/dashboard/MediaItemList";
import { createPageUrl } from "@/utils";
import usePersistentTheme from "@/hooks/usePersistentTheme";
import { ArrowLeft, FolderPlus, ImagePlus, Loader2, Moon, PencilLine, Save, Sparkles, Sun } from "lucide-react";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";

const STORAGE_KEY = "toretto.selectedProjectId";

const emptyForm = {
  name: "",
  description: "",
  image_url: "",
};

export default function Projects() {
  const queryClient = useQueryClient();
  const { isDark, toggleTheme } = usePersistentTheme();
  const { hasPermission } = useLicense();
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [form, setForm] = useState(emptyForm);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const { data: mediaItems = [] } = useQuery({
    queryKey: ["mediaItems"],
    queryFn: () => base44.entities.MediaItem.list("-created_date"),
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const projectMedia = useMemo(
    () => mediaItems.filter((item) => item.project_id === selectedProjectId),
    [mediaItems, selectedProjectId]
  );

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId("");
      setForm(emptyForm);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("");
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setForm(emptyForm);
      return;
    }

    setForm({
      name: selectedProject.name || "",
      description: selectedProject.description || "",
      image_url: selectedProject.image_url || "",
    });
    setThumbnailFile(null);
  }, [selectedProject]);

  const refreshProjects = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["mediaItems"] });
  };

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    localStorage.setItem(STORAGE_KEY, projectId);
  };

  const handleStartNewProject = () => {
    setSelectedProjectId("");
    setForm(emptyForm);
    setThumbnailFile(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const uploadOptionalFile = async (file, currentUrl) => {
    if (!file) return currentUrl || "";
    const result = await base44.integrations.Core.UploadFile({ file });
    return result.file_url;
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const image_url = await uploadOptionalFile(thumbnailFile, "");

    const created = await base44.entities.Project.create({
      name: form.name.trim(),
      description: form.description.trim(),
      image_url,
    });

    setSaving(false);
    refreshProjects();
    handleSelectProject(created.id);
  };

  const handleUpdateProject = async () => {
    if (!selectedProject || !form.name.trim()) return;
    setSaving(true);

    const image_url = await uploadOptionalFile(thumbnailFile, form.image_url);

    await base44.entities.Project.update(selectedProject.id, {
      name: form.name.trim(),
      description: form.description.trim(),
      image_url,
    });

    setSaving(false);
    refreshProjects();
  };

  const handleToggleBonus = async (item) => {
    const bonusItems = projectMedia.filter((media) => media.is_bonus && media.id !== item.id);
    await Promise.all(
      bonusItems.map((media) => base44.entities.MediaItem.update(media.id, { is_bonus: false }))
    );
    await base44.entities.MediaItem.update(item.id, {
      is_bonus: !item.is_bonus,
      is_panariello_band: false,
    });
    refreshProjects();
  };

  const handleTogglePanarielloBand = async (item) => {
    await base44.entities.MediaItem.update(item.id, {
      is_panariello_band: !item.is_panariello_band,
      is_bonus: false,
    });
    refreshProjects();
  };

  const pageBg = isDark ? "bg-gray-950" : "bg-slate-50";
  const header = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200";
  const title = isDark ? "text-white" : "text-slate-900";
  const sub = isDark ? "text-gray-400" : "text-slate-500";
  const panel = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-slate-200";
  const soft = isDark ? "bg-cyan-500/10 text-cyan-300" : "bg-cyan-50 text-cyan-700";
  const mutedBox = isDark ? "border-gray-700 bg-gray-950 text-gray-400" : "border-slate-300 bg-slate-50 text-slate-500";
  const textArea = isDark
    ? "border-gray-700 bg-gray-950 text-white focus:border-cyan-400 focus:ring-cyan-900"
    : "border-slate-200 bg-white text-slate-900 focus:border-cyan-300 focus:ring-cyan-100";
  const projectButton = (selected) =>
    selected
      ? isDark
        ? "border-cyan-500 bg-cyan-500/10 shadow-sm"
        : "border-cyan-300 bg-cyan-50 shadow-sm"
      : isDark
        ? "border-gray-800 bg-gray-900 hover:border-cyan-700 hover:bg-gray-800"
        : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50";

  if (!hasPermission(LICENSE_PERMISSIONS.PROJECTS)) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md rounded-3xl border p-8 text-center shadow-sm ${panel}`}>
          <h1 className={`text-2xl font-black ${title}`}>Modulo Progetti non attivo</h1>
          <p className={`mt-3 text-sm ${sub}`}>
            Questa licenza non ha il permesso per creare o modificare progetti.
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
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-600">BingoVoice</p>
            <h1 className={`mt-1 text-2xl font-black tracking-tight ${title}`}>Progetti</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              Crea un progetto completo con miniatura, audio e contenuti pronti per l&apos;estrazione.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-500" />}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna alla Dashboard
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.open(createPageUrl("ProjectionScreen"), "_blank")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Apri Schermo
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[300px_360px_minmax(0,1.45fr)] xl:items-start">
        <section className={`self-start rounded-3xl border p-4 shadow-sm ${panel}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${sub}`}>Elenco Progetti</p>
              <h2 className={`mt-1 text-lg font-black ${title}`}>Seleziona o crea</h2>
            </div>
            <Button type="button" variant="outline" onClick={handleStartNewProject}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nuovo progetto
            </Button>
          </div>

          <div className={`mt-3 rounded-2xl px-3 py-2 text-xs font-semibold ${soft}`}>
            {projects.length} progetti totali
          </div>

          <div className="mt-5 space-y-3">
            {projects.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-5 text-sm ${mutedBox}`}>
                Nessun progetto creato. Compila il modulo qui accanto per iniziare.
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelectProject(project.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${projectButton(selectedProjectId === project.id)}`}
                >
                  <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl ${isDark ? "bg-gray-800" : "bg-slate-100"}`}>
                    {project.image_url ? (
                      <img src={project.image_url} alt={project.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${sub}`}>
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${title}`}>{project.name}</p>
                    <p className={`mt-1 line-clamp-2 text-xs ${sub}`}>
                      {project.description || "Nessuna descrizione aggiunta."}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-600"}`}>
              {selectedProject ? <PencilLine className="h-5 w-5" /> : <FolderPlus className="h-5 w-5" />}
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${sub}`}>
                {selectedProject ? "Modifica Progetto" : "Nuovo Progetto"}
              </p>
              <h2 className={`mt-1 text-lg font-black ${title}`}>
                {selectedProject ? "Aggiorna progetto selezionato" : "Crea un nuovo progetto"}
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Titolo Progetto</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Es. Serata Napoli 2026"
                className={`mt-2 ${isDark ? "border-gray-700 bg-gray-950 text-white" : ""}`}
              />
            </div>

            <div>
              <Label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Descrizione</Label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Tema, note, informazioni utili per l'evento..."
                className={`mt-2 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 ${textArea}`}
              />
            </div>

            <div>
              <Label className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>Miniatura Quadrata</Label>
              <div className="mt-2 space-y-3">
                <div className={`h-24 w-24 overflow-hidden rounded-2xl border ${isDark ? "border-gray-700 bg-gray-950" : "border-slate-200 bg-slate-100"}`}>
                  {form.image_url ? (
                    <img src={form.image_url} alt={form.name || "Miniatura progetto"} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${sub}`}>
                      <ImagePlus className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  className={`${isDark ? "border-gray-700 bg-gray-950 text-white" : ""} file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-cyan-700`}
                  onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={selectedProject ? handleUpdateProject : handleCreateProject}
              disabled={saving || !form.name.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {selectedProject ? "Salva modifiche progetto" : "Crea progetto"}
            </Button>
          </div>
        </section>

        <section className={`self-start rounded-3xl border p-5 shadow-sm ${panel}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${sub}`}>Aggiungi Media</p>
              <h2 className={`mt-1 text-lg font-black ${title}`}>
                {selectedProject ? `Nuovi contenuti per ${selectedProject.name}` : "Seleziona prima un progetto"}
              </h2>
            </div>
          </div>
          <div className="mt-5">
            {selectedProject ? (
              <MediaItemForm onCreated={refreshProjects} projectId={selectedProjectId} isDark={isDark} />
            ) : (
              <div className={`rounded-2xl border border-dashed p-6 text-sm ${mutedBox}`}>
                Crea o seleziona un progetto dalla colonna sinistra per iniziare ad aggiungere immagini e audio.
              </div>
            )}
          </div>
        </section>

        <section className={`space-y-6 xl:col-start-2 xl:col-end-4 rounded-3xl border p-5 shadow-sm ${panel}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${sub}`}>Media del Progetto</p>
              <h2 className={`mt-1 text-lg font-black ${title}`}>{projectMedia.length} elementi caricati</h2>
            </div>
          </div>
          <div className="mt-5">
            <MediaItemList
              items={projectMedia}
              onDeleted={refreshProjects}
              onToggleBonus={handleToggleBonus}
              onTogglePanarielloBand={handleTogglePanarielloBand}
              isDark={isDark}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
