import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Monitor, Loader2, Trash2, Sun, Moon, LayoutGrid, Shield, FolderOpen, Briefcase, PackageOpen, Smartphone } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { useLicense } from "@/components/licensing/LicenseProvider";
import usePersistentTheme from "@/hooks/usePersistentTheme";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";
import packageJson from "../../package.json";

import MediaItemList from "../components/dashboard/MediaItemList";
import VideoButtonManager from "../components/dashboard/VideoButtonManager";
import ExtractionHistory from "../components/dashboard/ExtractionHistory";
import BonusAudioUploader from "../components/dashboard/BonusAudioUploader";
import ProjectSelector from "../components/dashboard/ProjectSelector";
import DashboardCardChecker from "../components/dashboard/DashboardCardChecker";

const STORAGE_KEY = "toretto.selectedProjectId";
const SPIN_DURATION_MS = 3500;
const EXTRACTION_COMMIT_DELAY_MS = 150;

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { activeLicense, isAdmin, deactivate, hasPermission } = useLicense();
  const { isDark, toggleTheme } = usePersistentTheme();
  const [extracting, setExtracting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
  const [currentBonusItem, setCurrentBonusItem] = useState(null);
  const [lastExtractionAudioUrl, setLastExtractionAudioUrl] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const { data: mediaItems = [] } = useQuery({
    queryKey: ["mediaItems"],
    queryFn: () => base44.entities.MediaItem.list("-created_date"),
  });

  const { data: extractions = [] } = useQuery({
    queryKey: ["extractions"],
    queryFn: () => base44.entities.Extraction.list("order_number"),
  });

  const { data: videoButtons = [] } = useQuery({
    queryKey: ["videoButtons"],
    queryFn: () => base44.entities.VideoButton.list("-created_date"),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mediaItems"] });
    queryClient.invalidateQueries({ queryKey: ["extractions"] });
    queryClient.invalidateQueries({ queryKey: ["videoButtons"] });
    queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const filteredItems = selectedProjectId
    ? mediaItems.filter((item) => item.project_id === selectedProjectId)
    : mediaItems;

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(STORAGE_KEY, selectedProjectId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setCurrentBonusItem(null);
      return;
    }
    const bonusFlagged = filteredItems.find((item) => item.is_bonus);
    if (bonusFlagged) {
      setCurrentBonusItem(bonusFlagged);
      return;
    }

    const currentStillValid = currentBonusItem && filteredItems.some((item) => item.id === currentBonusItem.id);
    if (currentStillValid) {
      return;
    }

    setCurrentBonusItem(filteredItems[Math.floor(Math.random() * filteredItems.length)]);
  }, [filteredItems, currentBonusItem]);

  const handleToggleBonus = async (item) => {
    const newBonusState = !item.is_bonus;
    const bonusItems = filteredItems.filter((media) => media.is_bonus && media.id !== item.id);
    await Promise.all(
      bonusItems.map((media) => base44.entities.MediaItem.update(media.id, { is_bonus: false }))
    );
    await base44.entities.MediaItem.update(item.id, {
      is_bonus: newBonusState,
      is_panariello_band: false,
    });
    refreshAll();
  };

  const handleTogglePanarielloBand = async (item) => {
    await base44.entities.MediaItem.update(item.id, {
      is_panariello_band: !item.is_panariello_band,
      is_bonus: false,
    });
    refreshAll();
  };

  const handleExtract = async () => {
    const available = filteredItems.filter((item) => !item.extracted);
    if (available.length === 0) return;

    setExtracting(true);
    const selected = available[Math.floor(Math.random() * available.length)];
    setLastExtractionAudioUrl(selected.audio_url || "");
    const orderNumber = extractions.length + 1;

    const bonusFlagged = filteredItems.find((item) => item.is_bonus) || null;
    const resolvedBonusItem = bonusFlagged
      || (currentBonusItem && filteredItems.some((item) => item.id === currentBonusItem.id)
        ? currentBonusItem
        : available[Math.floor(Math.random() * available.length)]);

    if (!bonusFlagged && (!currentBonusItem || currentBonusItem.id !== resolvedBonusItem.id)) {
      setCurrentBonusItem(resolvedBonusItem);
    }

    const isBonus = resolvedBonusItem?.id === selected.id;
    const isPanarielloBand = selected.is_panariello_band || false;

    if (bonusFlagged) {
      setCurrentBonusItem(bonusFlagged);
    }

    const panarielloBtn = videoButtons.find((button) => button.label?.toUpperCase().includes("PANARIELLO"));
    const panarielloBandVideoUrl = panarielloBtn?.video_url || appSettings[0]?.panariello_band_video_url || "";
    const wheelImages = filteredItems
      .filter((item) => !item.extracted)
      .map((item) => ({ image_url: item.image_url, label: item.name }));

    await base44.entities.ScreenCommand.create({
      command_type: "spin_wheel",
      extraction_id: JSON.stringify({
        images: wheelImages,
        target: { image_url: selected.image_url, label: selected.name },
        next_extraction: {
          media_item_id: selected.id,
          media_name: selected.name,
          image_url: selected.image_url,
          audio_url: selected.audio_url || "",
          order_number: orderNumber,
          is_bonus: isBonus,
        },
        is_panariello_band: isPanarielloBand,
        panariello_band_video_url: panarielloBandVideoUrl,
      }),
    });

    setTimeout(async () => {
      try {
        await base44.entities.MediaItem.update(selected.id, { extracted: true });
        await base44.entities.Extraction.create({
          media_item_id: selected.id,
          media_name: selected.name,
          image_url: selected.image_url,
          audio_url: selected.audio_url || "",
          order_number: orderNumber,
          is_bonus: isBonus,
        });
        refreshAll();
      } finally {
        setExtracting(false);
      }
    }, SPIN_DURATION_MS + EXTRACTION_COMMIT_DELAY_MS);
  };

  const handlePlayVideo = async (videoUrl) => {
    await base44.entities.ScreenCommand.create({
      command_type: "play_video",
      video_url: videoUrl,
    });
  };

  const handleClearAll = async () => {
    for (const extraction of extractions) {
      await base44.entities.Extraction.delete(extraction.id);
    }
    const items = await base44.entities.MediaItem.list();
    for (const item of items) {
      if (item.extracted) {
        await base44.entities.MediaItem.update(item.id, { extracted: false });
      }
    }
    refreshAll();
  };

  const handleShowBonus = async () => {
    const bonus = filteredItems.find((item) => item.is_bonus) || currentBonusItem;
    if (!bonus) return;

    const bonusVideoUrl = appSettings[0]?.bonus_video_url || "";
    await base44.entities.ScreenCommand.create({
      command_type: "show_bonus",
      extraction_id: JSON.stringify({
        id: "bonus-preview",
        media_name: bonus.name,
        image_url: bonus.image_url,
        audio_url: "",
        is_bonus: true,
        order_number: "★",
        bonus_video_url: bonusVideoUrl,
        skip_intro: true,
      }),
    });
  };

  const handleReplayExtractionAudio = async () => {
    if (!lastExtractionAudioUrl) return;
    await base44.entities.ScreenCommand.create({
      command_type: "replay_extraction_audio",
      audio_url: lastExtractionAudioUrl,
    });
  };

  const handlePlayRepeatAudio = async () => {
    const repeatUrl = appSettings[0]?.repeat_audio_url || "";
    if (!repeatUrl) return;
    await base44.entities.ScreenCommand.create({
      command_type: "play_repeat_audio",
      audio_url: repeatUrl,
    });
  };

  const availableCount = filteredItems.filter((item) => !item.extracted).length;
  const totalCount = filteredItems.length;
  const activeProjectName = projects.find((project) => project.id === selectedProjectId)?.name;
  const canOpenAdminPanel = hasPermission(LICENSE_PERMISSIONS.ADMIN_PANEL);
  const canOpenProjects = hasPermission(LICENSE_PERMISSIONS.PROJECTS);
  const canOpenCardManager = hasPermission(LICENSE_PERMISSIONS.CARD_MANAGER);
  const canManageVideoButtons = hasPermission(LICENSE_PERMISSIONS.VIDEO_BUTTONS);
  const canManageGeneralSettings = hasPermission(LICENSE_PERMISSIONS.GENERAL_SETTINGS);
  const showManagementCards = isAdmin || canOpenAdminPanel || canOpenProjects || canOpenCardManager;

  const openProjection = () => {
    window.open(createPageUrl("ProjectionScreen"), "_blank");
  };

  const bg = isDark ? "bg-gray-950" : "bg-gray-50";
  const header = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const title = isDark ? "text-white" : "text-gray-900";
  const subtitle = isDark ? "text-gray-400" : "text-gray-500";
  const card = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const cardTitle = isDark ? "text-gray-300" : "text-gray-500";

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className={`${header} sticky top-0 z-10 border-b`}>
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-xl font-black tracking-tight ${title}`}>BingoVoice Dashboard</h1>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-cyan-500/10 text-cyan-300" : "bg-cyan-50 text-cyan-700"}`}>
                v{packageJson.version}
              </span>
            </div>
            <p className={`mt-0.5 text-xs ${subtitle}`}>Gestione estrazione, progetti e schermo pubblico</p>
            <p className={`mt-1 text-[11px] ${subtitle}`}>
              Licenza attiva: {activeLicense?.email || "non disponibile"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={deactivate}>
              Disattiva Licenza
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={isDark ? "text-yellow-400 hover:text-yellow-300" : "text-gray-500 hover:text-gray-700"}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={openProjection} className="gap-2">
              <Monitor className="h-4 w-4" />
              Apri Schermo
            </Button>
            <Button
              onClick={handleClearAll}
              disabled={extractions.length === 0}
              className="gap-2 rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Azzera
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        {showManagementCards ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <Link to="/" className="block">
              <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                <div className="flex items-center gap-3">
                  <LayoutGrid className="h-5 w-5 text-cyan-500" />
                  <div>
                    <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Dashboard</p>
                    <p className={`text-xs ${subtitle}`}>Vai alla schermata principale di gestione.</p>
                  </div>
                </div>
              </div>
            </Link>
            {canOpenAdminPanel ? (
              <Link to="/AdminPanel" className="block">
                <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Pannello Admin</p>
                      <p className={`text-xs ${subtitle}`}>Vai direttamente alla pagina admin dedicata.</p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
            {canOpenProjects ? (
              <Link to="/Projects" className="block">
                <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-cyan-500" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Progetti</p>
                      <p className={`text-xs ${subtitle}`}>Gestisci progetti, miniature e media dedicati.</p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
            {canOpenProjects ? (
              <Link to="/ImportExportProject" className="block">
                <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                  <div className="flex items-center gap-3">
                    <PackageOpen className="h-5 w-5 text-violet-500" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Importa/Esporta</p>
                      <p className={`text-xs ${subtitle}`}>Crea o installa pacchetti progetto per i clienti.</p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
            {canOpenCardManager ? (
              <Link to="/CardManager" className="block">
                <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Carica Cartelle</p>
                      <p className={`text-xs ${subtitle}`}>Vai direttamente alla pagina cartelle.</p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
            {isAdmin ? (
              <Link to="/Connections" className="block">
                <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${card}`}>
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-cyan-500" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-wider ${title}`}>Connessioni</p>
                      <p className={`text-xs ${subtitle}`}>Collega telefoni via QR e invia cartelle.</p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_300px]">
          <div className="space-y-4">
            <ProjectSelector
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
              isDark={isDark}
            />
            <div className={`rounded-2xl border p-4 shadow-sm ${card}`}>
              <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${cardTitle}`}>Cronologia Estrazioni</h3>
              <ExtractionHistory extractions={extractions} onCleared={refreshAll} isDark={isDark} />
            </div>
          </div>

          <div className="space-y-4">
            <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 shadow-sm ${card}`}>
              <button
                onClick={handleExtract}
                disabled={extracting || availableCount === 0}
                className="w-full max-w-sm rounded-3xl py-10 text-4xl font-black uppercase tracking-widest text-white shadow-2xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: extracting || availableCount === 0
                    ? "#6366f1"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6, #4f46e5)",
                  boxShadow: "0 8px 40px rgba(99, 102, 241, 0.5)",
                }}
              >
                {extracting ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    ...
                  </span>
                ) : (
                  "ESTRAI"
                )}
              </button>
              <div className="flex w-full max-w-sm gap-2">
                <Button
                  onClick={handleReplayExtractionAudio}
                  disabled={!lastExtractionAudioUrl || extracting}
                  className="flex-1 rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest"
                  variant={isDark ? "secondary" : "outline"}
                >
                  Ripeti Audio Estrazione
                </Button>
                <Button
                  onClick={handlePlayRepeatAudio}
                  disabled={extracting || !appSettings[0]?.repeat_audio_url}
                  className="flex-1 rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest"
                  variant={isDark ? "secondary" : "outline"}
                >
                  Audio: Ripeto
                </Button>
              </div>
              <p className={`text-sm font-medium ${subtitle}`}>
                {availableCount} / {totalCount} disponibili
                {activeProjectName ? <span className="ml-2 text-indigo-500">- {activeProjectName}</span> : null}
              </p>
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${card}`}>
              <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${cardTitle}`}>Controlla Cartella</h3>
              <DashboardCardChecker
                mediaItems={filteredItems}
                extractions={extractions}
                isDark={isDark}
                selectedProjectId={selectedProjectId}
              />
            </div>

            {canManageGeneralSettings ? (
              <BonusAudioUploader settings={appSettings[0]} onUpdated={refreshAll} isDark={isDark} />
            ) : null}

            <div className={`rounded-2xl border p-5 shadow-sm ${card}`}>
              <h3 className={`mb-4 text-xs font-semibold uppercase tracking-wider ${cardTitle}`}>
                Elementi Media ({filteredItems.length})
              </h3>
              <MediaItemList
                items={filteredItems}
                onDeleted={refreshAll}
                onToggleBonus={handleToggleBonus}
                onTogglePanarielloBand={handleTogglePanarielloBand}
                isDark={isDark}
              />
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleShowBonus}
              className="w-full rounded-2xl py-5 text-lg font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #ff6fd8, #ff4f4f, #ffd700)",
                boxShadow: "0 4px 24px rgba(255, 100, 200, 0.4)",
              }}
            >
              Mostra Bonus Voice
            </button>
            {canManageVideoButtons ? (
              <VideoButtonManager
                buttons={videoButtons}
                onUpdated={refreshAll}
                onPlayVideo={handlePlayVideo}
                isDark={isDark}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
