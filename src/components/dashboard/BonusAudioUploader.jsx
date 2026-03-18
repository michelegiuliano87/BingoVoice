import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, Volume2, Video, Music, Trash2, Play, Pause, Square } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function BonusAudioUploader({ settings, onUpdated, isDark }) {
  const [audioFile, setAudioFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [wheelAudioFile, setWheelAudioFile] = useState(null);
  const [loadingWheelAudio, setLoadingWheelAudio] = useState(false);
  const [panarielloVideoFile, setPanarielloVideoFile] = useState(null);
  const [loadingPanarielloVideo, setLoadingPanarielloVideo] = useState(false);
  const [waitingVideoFile, setWaitingVideoFile] = useState(null);
  const [loadingWaitingVideo, setLoadingWaitingVideo] = useState(false);
  const [volume, setVolume] = useState(80);

  const sendMusicCommand = async (type) => {
    await base44.entities.ScreenCommand.create({ command_type: type });
  };

  const sendVolume = async (val) => {
    await base44.entities.ScreenCommand.create({ command_type: "music_volume", value: val / 100 });
  };

  const upload = async (file, field, setLoading, inputId, setFile) => {
    if (!file) return;
    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (settings?.id) {
      await base44.entities.AppSettings.update(settings.id, { [field]: file_url });
    } else {
      await base44.entities.AppSettings.create({ [field]: file_url });
    }
    setFile(null);
    document.getElementById(inputId).value = "";
    setLoading(false);
    onUpdated?.();
  };

  const remove = async (field) => {
    if (!settings?.id) return;
    await base44.entities.AppSettings.update(settings.id, { [field]: "" });
    onUpdated?.();
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const label = isDark ? "text-gray-300" : "text-gray-500";
  const subtext = isDark ? "text-gray-400" : "text-gray-400";

  return (
    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${card}`}>
      <h3 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${label}`}>
        ⚙️ Impostazioni Generali
      </h3>

      {/* Background Music */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Music className="w-3 h-3 text-green-500" /> Musica di Sottofondo
        </p>
        {settings?.background_music_url ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <audio controls src={settings.background_music_url} className="flex-1 h-8" />
              <Button variant="ghost" size="icon" onClick={() => remove("background_music_url")} className="text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => sendMusicCommand("music_play")} className="flex-1 bg-green-600 hover:bg-green-700 gap-1">
                <Play className="w-3 h-3" /> Play
              </Button>
              <Button size="sm" onClick={() => sendMusicCommand("music_pause")} className="flex-1 bg-yellow-500 hover:bg-yellow-600 gap-1 text-white">
                <Pause className="w-3 h-3" /> Pausa
              </Button>
              <Button size="sm" onClick={() => sendMusicCommand("music_stop")} className="flex-1 bg-red-600 hover:bg-red-700 gap-1">
                <Square className="w-3 h-3" /> Stop
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-gray-400 shrink-0" />
              <Slider
                min={0} max={100} step={1}
                value={[volume]}
                onValueChange={(v) => setVolume(v[0])}
                onValueCommit={(v) => sendVolume(v[0])}
                className="flex-1"
              />
              <span className={`text-xs w-8 text-right ${label}`}>{volume}%</span>
            </div>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessuna musica di sottofondo</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="bg-music-input" type="file" accept="audio/*" onChange={(e) => setMusicFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(musicFile, "background_music_url", setLoadingMusic, "bg-music-input", setMusicFile)}
            disabled={loadingMusic || !musicFile} size="sm" className="bg-green-600 hover:bg-green-700 gap-1 shrink-0">
            {loadingMusic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>

      {/* Audio Bonus */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Volume2 className="w-3 h-3 text-pink-500" /> Audio (schermata Bonus)
        </p>
        {settings?.bonus_audio_url ? (
          <div className="flex items-center gap-2">
            <audio controls src={settings.bonus_audio_url} className="flex-1 h-8" />
            <Button variant="ghost" size="icon" onClick={() => remove("bonus_audio_url")} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessun audio impostato</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="bonus-audio-input" type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(audioFile, "bonus_audio_url", setLoadingAudio, "bonus-audio-input", setAudioFile)}
            disabled={loadingAudio || !audioFile} size="sm" className="bg-pink-600 hover:bg-pink-700 gap-1 shrink-0">
            {loadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>

      {/* Audio Lucky Wheel */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Volume2 className="w-3 h-3 text-yellow-500" /> Audio Lucky Wheel (durante l'estrazione)
        </p>
        {settings?.wheel_audio_url ? (
          <div className="flex items-center gap-2">
            <audio controls src={settings.wheel_audio_url} className="flex-1 h-8" />
            <Button variant="ghost" size="icon" onClick={() => remove("wheel_audio_url")} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessun audio impostato</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="wheel-audio-input" type="file" accept="audio/*" onChange={(e) => setWheelAudioFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(wheelAudioFile, "wheel_audio_url", setLoadingWheelAudio, "wheel-audio-input", setWheelAudioFile)}
            disabled={loadingWheelAudio || !wheelAudioFile} size="sm" className="bg-yellow-500 hover:bg-yellow-600 gap-1 shrink-0 text-white">
            {loadingWheelAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>

      {/* Video Panariello Band */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Video className="w-3 h-3 text-orange-500" /> Video Panariello Band
        </p>
        {settings?.panariello_band_video_url ? (
          <div className="flex items-center gap-2">
            <video src={settings.panariello_band_video_url} className="h-12 rounded" controls />
            <Button variant="ghost" size="icon" onClick={() => remove("panariello_band_video_url")} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessun video impostato</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="panariello-video-input" type="file" accept="video/*" onChange={(e) => setPanarielloVideoFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(panarielloVideoFile, "panariello_band_video_url", setLoadingPanarielloVideo, "panariello-video-input", setPanarielloVideoFile)}
            disabled={loadingPanarielloVideo || !panarielloVideoFile} size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1 shrink-0 text-white">
            {loadingPanarielloVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>

      {/* Video Attesa (loop schermata proiezione) */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Video className="w-3 h-3 text-blue-500" /> Video Attesa (loop schermata proiezione)
        </p>
        {settings?.waiting_video_url ? (
          <div className="flex items-center gap-2">
            <video src={settings.waiting_video_url} className="h-12 rounded" controls />
            <Button variant="ghost" size="icon" onClick={() => remove("waiting_video_url")} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessun video impostato</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="waiting-video-input" type="file" accept="video/*" onChange={(e) => setWaitingVideoFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(waitingVideoFile, "waiting_video_url", setLoadingWaitingVideo, "waiting-video-input", setWaitingVideoFile)}
            disabled={loadingWaitingVideo || !waitingVideoFile} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1 shrink-0">
            {loadingWaitingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>

      {/* Video Jingle */}
      <div className="space-y-2">
        <p className={`text-xs font-semibold flex items-center gap-1 ${label}`}>
          <Video className="w-3 h-3 text-indigo-500" /> Video Jingle (prima del reveal)
        </p>
        {settings?.bonus_video_url ? (
          <div className="flex items-center gap-2">
            <video src={settings.bonus_video_url} className="h-12 rounded" controls />
            <Button variant="ghost" size="icon" onClick={() => remove("bonus_video_url")} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className={`text-xs ${subtext}`}>Nessun video impostato</p>
        )}
        <div className="flex gap-2 items-end">
          <Input id="bonus-video-input" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} className="flex-1" />
          <Button onClick={() => upload(videoFile, "bonus_video_url", setLoadingVideo, "bonus-video-input", setVideoFile)}
            disabled={loadingVideo || !videoFile} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1 shrink-0">
            {loadingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}