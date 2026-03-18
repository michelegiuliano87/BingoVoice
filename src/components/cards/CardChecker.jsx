import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";

const PRIZE_COLORS = {
  "BINGO! 🎉": "from-yellow-400 to-orange-500",
  "CINQUINA 🏆": "from-purple-500 to-indigo-600",
  "QUATERNA ⭐⭐⭐⭐": "from-blue-500 to-cyan-500",
  "TERNO ⭐⭐⭐": "from-green-500 to-emerald-600",
  "AMBO ⭐⭐": "from-pink-400 to-rose-500",
};

// Calcola il miglior premio considerando righe (5 caselle per riga)
function computePrize(cardIds, extractedIds) {
  const totalMatched = cardIds.filter((id) => extractedIds.has(id)).length;
  if (totalMatched >= 15) return { prize: "BINGO! 🎉", matched: cardIds.filter((id) => extractedIds.has(id)) };

  // Righe: 0-4, 5-9, 10-14
  let bestCount = 0;
  let bestRowMatched = [];
  for (let row = 0; row < 3; row++) {
    const rowIds = cardIds.slice(row * 5, row * 5 + 5);
    const rowMatched = rowIds.filter((id) => extractedIds.has(id));
    if (rowMatched.length > bestCount) {
      bestCount = rowMatched.length;
      bestRowMatched = rowMatched;
    }
  }

  let prize = null;
  if (bestCount === 5) prize = "CINQUINA 🏆";
  else if (bestCount === 4) prize = "QUATERNA ⭐⭐⭐⭐";
  else if (bestCount === 3) prize = "TERNO ⭐⭐⭐";
  else if (bestCount === 2) prize = "AMBO ⭐⭐";

  const allMatched = cardIds.filter((id) => extractedIds.has(id));
  return { prize, matched: allMatched, bestRowMatched };
}

export default function CardChecker({ result, extractions, onHide }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (result && !result.error) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onHide?.();
      }, 20000);
    }
    return () => clearTimeout(timerRef.current);
  }, [result]);

  if (!result) return null;

  if (result.error) {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
        {result.error}
      </div>
    );
  }

  const { card, mediaItems } = result;
  const cardIds = card.media_item_ids || [];
  const extractedIds = new Set(extractions.map((e) => e.media_item_id));
  const { prize, matched, bestRowMatched = [] } = computePrize(cardIds, extractedIds);
  const count = matched.length;

  const getItem = (id) => mediaItems.find((m) => m.id === id);

  const handleShowOnScreen = async () => {
    // Costruisce payload con i dati della cartella e il risultato
    const payload = {
      cardNumber: card.card_number,
      prize,
      count,
      totalItems: cardIds.length,
      items: cardIds.map((id) => {
        const item = getItem(id);
        return { id, image_url: item?.image_url || "", name: item?.name || "", matched: matched.includes(id), bestRow: bestRowMatched.includes(id) };
      }),
    };
    await base44.entities.ScreenCommand.create({
      command_type: "show_extraction",
      extraction_id: JSON.stringify({ type: "card_check", ...payload }),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
      {/* Prize banner */}
      {prize ? (
        <div className={`bg-gradient-to-r ${PRIZE_COLORS[prize]} rounded-2xl p-4 text-center text-white shadow-lg`}>
          <p className="text-3xl font-black">{prize}</p>
          <p className="text-sm opacity-90 mt-1">{count} immagini estratte su {cardIds.length}</p>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl p-4 text-center">
          <p className="text-xl font-bold text-gray-500">Nessuna vincita ancora</p>
          <p className="text-sm text-gray-400 mt-1">{count} immagini estratte su {cardIds.length}</p>
        </div>
      )}

      {/* Grid 5x3 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Cartella #{card.card_number}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {cardIds.map((id, idx) => {
            const item = getItem(id);
            const isMatched = matched.includes(id);
            const isBestRow = bestRowMatched.includes(id);
            if (!item) return <div key={id} className="h-14 rounded-xl bg-gray-100" />;
            return (
              <div
                key={id}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  isBestRow ? "border-yellow-400 ring-2 ring-yellow-300" :
                  isMatched ? "border-green-500 ring-1 ring-green-300" :
                  "border-gray-200 opacity-40"
                }`}
              >
                <img src={item.image_url} alt={item.name} className="w-full h-14 object-cover" />
                {isMatched && (
                  <div className={`absolute inset-0 flex items-center justify-center ${isBestRow ? "bg-yellow-400/20" : "bg-green-500/20"}`}>
                    <span className={`font-black text-xl drop-shadow ${isBestRow ? "text-yellow-600" : "text-green-700"}`}>✓</span>
                  </div>
                )}
                <p className="text-[8px] text-center truncate px-0.5 py-0.5 text-gray-600">{item.name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasto Mostra a Schermo */}
      <Button
        onClick={handleShowOnScreen}
        className="w-full gap-2 bg-gray-800 hover:bg-gray-900 text-white"
      >
        <Monitor className="w-4 h-4" /> Mostra a Schermo
      </Button>
    </motion.div>
  );
}