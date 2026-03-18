import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function CardForm({ mediaItems, projectId, onCreated, onCancel, isDark = false }) {
  const [cardNumber, setCardNumber] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [chosenProjectId, setChosenProjectId] = useState(projectId || "");

  useEffect(() => {
    setChosenProjectId(projectId || "");
  }, [projectId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const filtered = mediaItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : prev.length < 15 ? [...prev, id] : prev
    );
  };

  const handleSave = async () => {
    if (!cardNumber || selectedIds.length === 0) return;
    setLoading(true);
    await base44.entities.PlayerCard.create({
      card_number: parseInt(cardNumber, 10),
      media_item_ids: selectedIds,
      ...(chosenProjectId ? { project_id: chosenProjectId } : {}),
    });
    setLoading(false);
    onCreated?.();
  };

  const wrapper = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-indigo-100";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const field = isDark ? "border-gray-700 bg-gray-950 text-white" : "border";

  return (
    <div className={`space-y-4 rounded-2xl border p-5 shadow-sm ${wrapper}`}>
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${text}`}>Nuova Cartella</h2>
        {onCancel ? (
          <button onClick={onCancel}>
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        ) : null}
      </div>

      <div>
        <label className={`mb-1 block text-xs font-semibold ${sub}`}>Progetto</label>
        <select
          value={chosenProjectId}
          onChange={(event) => setChosenProjectId(event.target.value)}
          className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${field}`}
        >
          <option value="">- Nessun progetto -</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={`mb-1 block text-xs font-semibold ${sub}`}>Numero Cartella</label>
        <input
          type="number"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
          placeholder="Es. 1, 2, 3..."
          className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${field}`}
        />
      </div>

      <div>
        <label className={`mb-2 block text-xs font-semibold ${sub}`}>Anteprima Cartella ({selectedIds.length}/15)</label>
        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }).map((_, index) => {
            const id = selectedIds[index];
            const item = id ? mediaItems.find((media) => media.id === id) : null;
            return (
              <div
                key={index}
                className={`overflow-hidden rounded-xl border-2 ${item ? "border-indigo-400" : isDark ? "border-dashed border-gray-700 bg-gray-950" : "border-dashed border-gray-300 bg-gray-50"}`}
                style={{ aspectRatio: "1" }}
              >
                {item ? (
                  <div className="relative h-full w-full">
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white"
                    >
                      x
                    </button>
                    <p className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-0.5 text-center text-[8px] text-white">{item.name}</p>
                  </div>
                ) : (
                  <div className={`flex h-full w-full items-center justify-center text-sm ${isDark ? "text-gray-600" : "text-gray-300"}`}>{index + 1}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className={`mb-1 block text-xs font-semibold ${sub}`}>Seleziona immagini</label>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca immagine..."
          className={`mb-2 w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${field}`}
        />
        <div className="grid max-h-[40vh] grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6 lg:grid-cols-8">
          {filtered.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                  selected
                    ? "border-indigo-500 ring-2 ring-indigo-300"
                    : isDark
                      ? "border-gray-700 hover:border-indigo-400"
                      : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <img src={item.image_url} alt={item.name} className="h-16 w-full object-cover" />
                {selected ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20">
                    <span className="text-lg font-black text-indigo-700">✓</span>
                  </div>
                ) : null}
                <p className={`truncate px-1 py-0.5 text-center text-[9px] ${isDark ? "bg-gray-900 text-gray-300" : "text-gray-600"}`}>{item.name}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading || !cardNumber || selectedIds.length === 0} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salva Cartella
      </Button>
    </div>
  );
}
