import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Image, Music, CheckCircle2, Star, Music2, Pencil, Loader2, X, Upload } from "lucide-react";

function EditModal({ item, onClose, onUpdated, isDark }) {
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [name, setName] = useState(item.name);
  const [loadingName, setLoadingName] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name === item.name) return;
    setLoadingName(true);
    await base44.entities.MediaItem.update(item.id, { name: name.trim() });
    setLoadingName(false);
    onUpdated?.();
  };

  const uploadImage = async () => {
    if (!imageFile) return;
    setLoadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
    await base44.entities.MediaItem.update(item.id, { image_url: file_url });
    setLoadingImage(false);
    setImageFile(null);
    onUpdated?.();
  };

  const uploadAudio = async () => {
    if (!audioFile) return;
    setLoadingAudio(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile });
    await base44.entities.MediaItem.update(item.id, { audio_url: file_url });
    setLoadingAudio(false);
    setAudioFile(null);
    onUpdated?.();
  };

  const modal = isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "border-gray-700 bg-gray-950 text-white" : "border";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-2xl p-6 shadow-xl ${modal}`} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Modifica: {item.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <p className={`text-xs font-semibold ${sub}`}>Titolo</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${input}`}
              />
              <Button size="sm" onClick={saveName} disabled={loadingName || !name.trim() || name === item.name} className="shrink-0 gap-1">
                {loadingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-xl border object-cover" />
            <div className="flex-1 space-y-1">
              <p className={`flex items-center gap-1 text-xs font-semibold ${sub}`}>
                <Image className="h-3 w-3" /> Sostituisci foto
              </p>
              <div className="flex gap-2">
                <input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files[0])} className="min-w-0 flex-1 text-xs" />
                <Button size="sm" onClick={uploadImage} disabled={loadingImage || !imageFile} className="shrink-0 gap-1">
                  {loadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className={`flex items-center gap-1 text-xs font-semibold ${sub}`}>
              <Music className="h-3 w-3" /> Sostituisci audio
            </p>
            {item.audio_url ? <audio controls src={item.audio_url} className="h-8 w-full" /> : null}
            <div className="flex gap-2">
              <input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files[0])} className="min-w-0 flex-1 text-xs" />
              <Button size="sm" onClick={uploadAudio} disabled={loadingAudio || !audioFile} className="shrink-0 gap-1">
                {loadingAudio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>

        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>Chiudi</Button>
      </div>
    </div>
  );
}

export default function MediaItemList({ items, onDeleted, onToggleBonus, onTogglePanarielloBand, isDark = false }) {
  const [editingItem, setEditingItem] = useState(null);

  const handleDelete = async (id) => {
    await base44.entities.MediaItem.delete(id);
    onDeleted?.();
  };

  if (!items.length) {
    return (
      <div className={`py-12 text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        <Image className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Nessun elemento aggiunto</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md ${isDark ? "border-gray-800 bg-gray-950" : "border-gray-100 bg-white"}`}>
            <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{item.name}</p>
              <div className="mt-1 flex gap-2">
                {item.audio_url ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Music className="h-3 w-3" /> Audio
                  </Badge>
                ) : null}
                {item.is_bonus ? (
                  <Badge className="gap-1 border-pink-200 bg-pink-100 text-xs text-pink-700">
                    <Star className="h-3 w-3 fill-pink-500" /> Bonus Voice
                  </Badge>
                ) : null}
                {item.is_panariello_band ? (
                  <Badge className="gap-1 border-orange-200 bg-orange-100 text-xs text-orange-700">
                    <Music2 className="h-3 w-3" /> Panariello Band
                  </Badge>
                ) : null}
                {item.extracted ? (
                  <Badge className="gap-1 border-green-200 bg-green-100 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Estratto
                  </Badge>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => onTogglePanarielloBand?.(item)}
              title="Segna come Panariello Band"
              className={`rounded-lg p-1.5 transition-all ${item.is_panariello_band ? "text-orange-500" : "text-gray-300 hover:text-orange-300"}`}
            >
              <Music2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleBonus?.(item)}
              title="Segna come Bonus Voice"
              className={`rounded-lg p-1.5 transition-all ${item.is_bonus ? "text-pink-500" : "text-gray-300 hover:text-pink-300"}`}
            >
              <Star className={`h-4 w-4 ${item.is_bonus ? "fill-pink-500" : ""}`} />
            </button>
            <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)} className="text-gray-400 hover:text-blue-500">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {editingItem ? (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={() => {
            onDeleted?.();
            setEditingItem(null);
          }}
          isDark={isDark}
        />
      ) : null}
    </>
  );
}
