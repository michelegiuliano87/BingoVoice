import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Play, Video, Pencil, X } from "lucide-react";

const COLORS = [
  { label: "Rosso", value: "bg-red-600 hover:bg-red-700" },
  { label: "Arancio", value: "bg-orange-500 hover:bg-orange-600" },
  { label: "Giallo", value: "bg-yellow-500 hover:bg-yellow-600" },
  { label: "Verde", value: "bg-green-600 hover:bg-green-700" },
  { label: "Smeraldo", value: "bg-emerald-500 hover:bg-emerald-600" },
  { label: "Teal", value: "bg-teal-500 hover:bg-teal-600" },
  { label: "Ciano", value: "bg-cyan-500 hover:bg-cyan-600" },
  { label: "Blu", value: "bg-blue-600 hover:bg-blue-700" },
  { label: "Indigo", value: "bg-indigo-600 hover:bg-indigo-700" },
  { label: "Viola", value: "bg-purple-600 hover:bg-purple-700" },
  { label: "Fucsia", value: "bg-fuchsia-500 hover:bg-fuchsia-600" },
  { label: "Rosa", value: "bg-pink-600 hover:bg-pink-700" },
  { label: "Grigio", value: "bg-gray-600 hover:bg-gray-700" },
  { label: "Nero", value: "bg-gray-900 hover:bg-black" },
];

export default function VideoButtonManager({ buttons, onUpdated, onPlayVideo }) {
  const [label, setLabel] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editVideoFile, setEditVideoFile] = useState(null);
  const [editColor, setEditColor] = useState(COLORS[0].value);
  const [editLoading, setEditLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!label || !videoFile) return;
    setLoading(true);
    const { file_url: video_url } = await base44.integrations.Core.UploadFile({ file: videoFile });
    await base44.entities.VideoButton.create({ label, video_url, color: selectedColor });
    setLabel("");
    setVideoFile(null);
    if (document.getElementById("video-input")) document.getElementById("video-input").value = "";
    setLoading(false);
    onUpdated?.();
  };

  const handleDelete = async (id) => {
    await base44.entities.VideoButton.delete(id);
    onUpdated?.();
  };

  const startEdit = (btn) => {
    setEditingId(btn.id);
    setEditLabel(btn.label);
    setEditColor(btn.color || COLORS[0].value);
    setEditVideoFile(null);
  };

  const handleSaveEdit = async () => {
    setEditLoading(true);
    const updates = { label: editLabel, color: editColor };
    if (editVideoFile) {
      const { file_url: video_url } = await base44.integrations.Core.UploadFile({ file: editVideoFile });
      updates.video_url = video_url;
    }
    await base44.entities.VideoButton.update(editingId, updates);
    setEditingId(null);
    setEditLoading(false);
    onUpdated?.();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-3 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aggiungi Pulsante Video</h3>
        <div>
          <Label className="text-xs text-gray-500">Etichetta</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome pulsante..." className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Video</Label>
          <Input id="video-input" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Colore</Label>
          <div className="flex gap-2 mt-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`w-8 h-8 rounded-full ${c.value.split(" ")[0]} ${selectedColor === c.value ? "ring-2 ring-offset-2 ring-indigo-500" : ""}`}
              />
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading || !label || !videoFile} className="w-full bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          {loading ? "Caricamento..." : "Aggiungi"}
        </Button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pulsanti Video</h3>
        {buttons.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nessun pulsante video</p>
          </div>
        )}
        {buttons.map((btn) => (
          <div key={btn.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onPlayVideo(btn.video_url)}
                className={`flex-1 text-white ${btn.color || "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                <Play className="w-4 h-4 mr-2" />
                {btn.label}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => startEdit(btn)} className="text-gray-400 hover:text-blue-500">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(btn.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {editingId === btn.id && (
              <div className="ml-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Etichetta..." className="text-sm" />
                <Input type="file" accept="video/*" onChange={(e) => setEditVideoFile(e.target.files[0])} className="text-sm" />
                <div className="flex gap-1 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setEditColor(c.value)}
                      className={`w-6 h-6 rounded-full ${c.value.split(" ")[0]} ${editColor === c.value ? "ring-2 ring-offset-1 ring-indigo-500" : ""}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} disabled={editLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                    {editLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salva"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-gray-400">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}