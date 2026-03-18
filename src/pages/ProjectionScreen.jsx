import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import BingoBoard from "../components/projection/BingoBoard";
import VideoOverlay from "../components/projection/VideoOverlay";
import LatestExtraction from "../components/projection/LatestExtraction";
import LuckyWheel from "../components/projection/LuckyWheel";
import CardCheckOverlay from "../components/projection/CardCheckOverlay";

// Audio su window: sopravvivono a HMR, re-render, GC del browser
if (!window._bgMusicAudio) {
  window._bgMusicAudio = new Audio();
  window._bgMusicAudio.loop = true;
  window._bgMusicAudio.volume = 0.5;
}


export default function ProjectionScreen() {
  const queryClient = useQueryClient();
  const [videoUrl, setVideoUrl] = useState(null);
  const [showingExtraction, setShowingExtraction] = useState(null);
  const [latestId, setLatestId] = useState(null);
  const [pendingBonusExtraction, setPendingBonusExtraction] = useState(null);
  const [wheelData, setWheelData] = useState(null); // { images, target, next_extraction_id }
  const [cardCheckData, setCardCheckData] = useState(null);
  const processedCommandsRef = useRef(new Set());
  const musicManualRef = useRef(true); // true = musica fermata manualmente (non autoplay)

  const { data: extractions = [] } = useQuery({
    queryKey: ["extractions"],
    queryFn: () => base44.entities.Extraction.list("order_number"),
    refetchInterval: 2000,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    refetchInterval: 2000,
  });

  const bonusAudioUrl = appSettings[0]?.bonus_audio_url || null;
  const bgMusicUrl = appSettings[0]?.background_music_url || null;
  const wheelAudioUrl = appSettings[0]?.wheel_audio_url || null;
  const waitingVideoUrl = appSettings[0]?.waiting_video_url || null;

  // Load music when URL is available - NON resettare se già caricata (evita interruzioni)
  useEffect(() => {
    if (!bgMusicUrl) return;
    const bg = window._bgMusicAudio;
    if (bg.src === bgMusicUrl) return;
    bg.src = bgMusicUrl;
  }, [bgMusicUrl]);

  // Pausa musica durante video; la ripresa è gestita esplicitamente (non qui)
  useEffect(() => {
    if (videoUrl) {
      window._bgMusicAudio.pause();
    }
  }, [videoUrl]);

  useEffect(() => {
    const pollCommands = async () => {
      const commands = await base44.entities.ScreenCommand.list("-created_date", 5);
      for (const cmd of commands) {
        if (processedCommandsRef.current.has(cmd.id)) continue;
        processedCommandsRef.current.add(cmd.id);

        if (cmd.command_type === "music_play") {
          musicManualRef.current = false;
          const bg = window._bgMusicAudio;
          if (!bg.src && bgMusicUrl) bg.src = bgMusicUrl;
          bg.play().catch(() => {});
        } else if (cmd.command_type === "music_pause") {
          musicManualRef.current = true;
          window._bgMusicAudio.pause();
        } else if (cmd.command_type === "music_stop") {
          musicManualRef.current = true;
          window._bgMusicAudio.pause();
          window._bgMusicAudio.currentTime = 0;
        } else if (cmd.command_type === "music_volume" && cmd.value != null) {
          window._bgMusicAudio.volume = Math.min(1, Math.max(0, cmd.value));
        } else if (cmd.command_type === "play_video" && cmd.video_url) {
          setVideoUrl(cmd.video_url);
        } else if (cmd.command_type === "show_extraction" && cmd.extraction_id) {
          // Prova a parsare come JSON (card_check payload)
          try {
            const parsed = JSON.parse(cmd.extraction_id);
            if (parsed.type === "card_check") {
              setCardCheckData(parsed);
            } else {
              // Bonus o altro payload JSON con dati estrazione diretti
              setShowingExtraction(parsed);
              if (parsed.id) setLatestId(parsed.id);
            }
          } catch {
            // È un ID reale di estrazione
            queryClient.invalidateQueries({ queryKey: ["extractions"] });
            const allExtractions = await base44.entities.Extraction.list("order_number");
            const ext = allExtractions.find((e) => e.id === cmd.extraction_id);
            if (ext) {
              setShowingExtraction(ext);
              setLatestId(ext.id);
            }
          }
        } else if (cmd.command_type === "spin_wheel" && cmd.extraction_id) {
          try {
            const data = JSON.parse(cmd.extraction_id);
            window._bgMusicAudio.pause();
            setShowingExtraction(null);
            setVideoUrl(null);
            setWheelData(data);
          } catch (e) {}
        } else if (cmd.command_type === "show_bonus" && cmd.extraction_id) {
          try {
            const bonusData = JSON.parse(cmd.extraction_id);
            if (bonusData.bonus_video_url) {
              setVideoUrl(bonusData.bonus_video_url);
              setPendingBonusExtraction(bonusData);
            } else {
              setShowingExtraction(bonusData);
            }
          } catch {}
        } else if (cmd.command_type === "clear_video") {
          setVideoUrl(null);
        }

        await base44.entities.ScreenCommand.delete(cmd.id);
      }
    };

    const interval = setInterval(pollCommands, 1500);
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950">



      {extractions.length === 0 && (
        <div className="fixed inset-0 z-10">
          <video
            src={waitingVideoUrl || "https://i.imgur.com/TXcTyF1.mp4"}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
            <p
              className="text-white font-black uppercase tracking-widest text-3xl md:text-5xl drop-shadow-2xl animate-pulse"
              style={{ textShadow: "0 0 30px rgba(255,200,0,1), 0 2px 8px rgba(0,0,0,0.8)" }}
            >
              IN ATTESA DI ESTRAZIONE...
            </p>
          </div>
        </div>
      )}

      {extractions.length > 0 && (
        <BingoBoard extractions={extractions} latestId={latestId} />
      )}

      <div className="fixed top-3 right-4 z-20 flex items-center gap-2 pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-500 text-xs font-medium uppercase tracking-wider">Live</span>
      </div>

      {wheelData && (
        <LuckyWheel
          images={wheelData.images}
          target={wheelData.target}
          audioUrl={wheelAudioUrl}
          onComplete={async () => {
            const wd = wheelData;
            setWheelData(null);
            if (wd.next_extraction_id) {
              const allExtractions = await base44.entities.Extraction.list("order_number");
              const ext = allExtractions.find((e) => e.id === wd.next_extraction_id);
              if (ext) {
                if (wd.is_panariello_band && wd.panariello_band_video_url) {
                  setVideoUrl(wd.panariello_band_video_url);
                  setPendingBonusExtraction(ext);
                } else {
                  setShowingExtraction(ext);
                  setLatestId(ext.id);
                }
              }
            } else {
              // Nessuna estrazione da mostrare: riprendi subito la bgMusic
              if (!musicManualRef.current) window._bgMusicAudio.play().catch(() => {});
            }
          }}
        />
      )}

      <CardCheckOverlay data={cardCheckData} onClose={() => setCardCheckData(null)} />
      <LatestExtraction
        extraction={showingExtraction}
        bonusAudioUrl={bonusAudioUrl}
        onComplete={() => setShowingExtraction(null)}
      />
      <VideoOverlay videoUrl={videoUrl} onEnded={() => {
        setVideoUrl(null);
        if (pendingBonusExtraction) {
          const ext = pendingBonusExtraction;
          setShowingExtraction(ext);
          setLatestId(ext.id);
          setPendingBonusExtraction(null);
          } else {
          if (!musicManualRef.current) window._bgMusicAudio.play().catch(() => {});
        }
      }} />
    </div>
  );
}
