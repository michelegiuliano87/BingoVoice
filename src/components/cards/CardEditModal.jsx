import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

export default function CardEditModal({ card, mediaItems, onClose, onUpdated, isDark = false }) {
  const [selectedIds, setSelectedIds] = useState(card.media_item_ids || []);
  const [cardNumber, setCardNumber] = useState(String(card.card_number));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = mediaItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : prev.length < 15 ? [...prev, id] : prev
    );
  };

  const handleSave = async () => {
    setLoading(true);
    await base44.entities.PlayerCard.update(card.id, {
      media_item_ids: selectedIds,
      card_number: parseInt(cardNumber, 10),
    });
    setLoading(false);
    onUpdated?.();
  };

  const modal = isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900";
  const field = isDark ? "border-gray-700 bg-gray-950 text-white" : "border";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 rounded-2xl p-6 shadow-xl ${modal}`} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">Modifica Cartella</h3>
            <input
              type="number"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              className={`w-20 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 ${field}`}
            />
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div>
          <p className={`mb-2 text-xs font-semibold ${sub}`}>Anteprima cartella ({selectedIds.length}/15)</p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }).map((_, index) => {
              const id = selectedIds[index];
              const item = id ? mediaItems.find((media) => media.id === id) : null;
              return (
                <div key={index} className={`overflow-hidden rounded-xl border-2 ${item ? "border-indigo-400" : isDark ? "border-dashed border-gray-700 bg-gray-950" : "border-dashed border-gray-300 bg-gray-50"}`} style={{ aspectRatio: "1" }}>
                  {item ? (
                    <div className="relative h-full w-full">
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      <button
                        onClick={() => toggle(id)}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                      >
                        x
                      </button>
                      <p className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-0.5 text-center text-[8px] text-white">{item.name}</p>
                    </div>
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-xs ${isDark ? "text-gray-600" : "text-gray-300"}`}>{index + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca immagine..."
          className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${field}`}
        />

        <div className="grid max-h-48 min-h-0 flex-1 grid-cols-5 gap-2 overflow-y-auto p-1 sm:grid-cols-8 lg:grid-cols-10">
          {filtered.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                  selected
                    ? "border-indigo-500 ring-2 ring-indigo-300"
                    : isDark
                      ? "border-gray-700 hover:border-indigo-400"
                      : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <img src={item.image_url} alt={item.name} className="h-14 w-full object-cover" />
                {selected ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20">
                    <span className="text-lg font-black text-indigo-700">✓</span>
                  </div>
                ) : null}
                <p className={`truncate px-0.5 py-0.5 text-center text-[8px] ${isDark ? "bg-gray-900 text-gray-300" : "text-gray-600"}`}>{item.name}</p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={loading || selectedIds.length === 0} className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}
