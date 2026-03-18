import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Star, Music2 } from "lucide-react";

export default function MediaItemForm({ onCreated, projectId, isDark = false }) {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [isBonus, setIsBonus] = useState(false);
  const [isPanarielloBand, setIsPanarielloBand] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name || !imageFile) return;
    setLoading(true);

    const { file_url: image_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
    let audio_url = "";
    if (audioFile) {
      const result = await base44.integrations.Core.UploadFile({ file: audioFile });
      audio_url = result.file_url;
    }

    await base44.entities.MediaItem.create({
      name,
      image_url,
      audio_url,
      extracted: false,
      is_bonus: isBonus,
      is_panariello_band: isPanarielloBand,
      project_id: projectId || null,
    });

    setName("");
    setImageFile(null);
    setAudioFile(null);
    setIsBonus(false);
    setIsPanarielloBand(false);
    if (document.getElementById("image-input")) document.getElementById("image-input").value = "";
    if (document.getElementById("audio-input")) document.getElementById("audio-input").value = "";
    setLoading(false);
    onCreated?.();
  };

  const wrapper = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const label = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "border-gray-700 bg-gray-950 text-white" : "";

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 rounded-2xl border p-5 shadow-sm ${wrapper}`}>
      <h3 className={`text-sm font-semibold uppercase tracking-wider ${label}`}>Aggiungi Media</h3>
      <div>
        <Label className={`text-xs ${label}`}>Nome</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome elemento..." className={`mt-1 ${input}`} />
      </div>
      <div>
        <Label className={`text-xs ${label}`}>Immagine *</Label>
        <Input id="image-input" type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files[0])} className={`mt-1 ${input}`} />
      </div>
      <div>
        <Label className={`text-xs ${label}`}>Audio (opzionale)</Label>
        <Input id="audio-input" type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files[0])} className={`mt-1 ${input}`} />
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setIsBonus(!isBonus);
            if (!isBonus) setIsPanarielloBand(false);
          }}
          className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${
            isBonus
              ? "border-pink-400 bg-pink-50 text-pink-700"
              : isDark
                ? "border-gray-700 bg-gray-950 text-gray-400"
                : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          <Star className={`h-4 w-4 ${isBonus ? "fill-pink-500 text-pink-500" : ""}`} />
          {isBonus ? "Questo e' il BONUS VOICE" : "Segna come Bonus Voice"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsPanarielloBand(!isPanarielloBand);
            if (!isPanarielloBand) setIsBonus(false);
          }}
          className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${
            isPanarielloBand
              ? "border-orange-400 bg-orange-50 text-orange-700"
              : isDark
                ? "border-gray-700 bg-gray-950 text-gray-400"
                : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          <Music2 className={`h-4 w-4 ${isPanarielloBand ? "text-orange-500" : ""}`} />
          {isPanarielloBand ? "Questo e' PANARIELLO BAND" : "Segna come Panariello Band"}
        </button>
      </div>
      <Button type="submit" disabled={loading || !name || !imageFile} className="w-full bg-indigo-600 hover:bg-indigo-700">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {loading ? "Caricamento..." : "Aggiungi"}
      </Button>
    </form>
  );
}
