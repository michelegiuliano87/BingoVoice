import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIZE_COLORS = {
  "BINGO! 🎉": "#f59e0b",
  "CINQUINA 🏆": "#8b5cf6",
  "QUATERNA ⭐⭐⭐⭐": "#3b82f6",
  "TERNO ⭐⭐⭐": "#10b981",
  "AMBO ⭐⭐": "#ec4899",
};

export default function CardCheckOverlay({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => onClose?.(), 20000);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          key="card-check-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 15 }}
            className="bg-gray-900 rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <p className="text-white/60 text-sm uppercase tracking-widest mb-1">Cartella</p>
              <p className="text-white font-black text-5xl">#{data.cardNumber}</p>
            </div>

            {/* Prize banner */}
            {data.prize ? (
              <div
                className="rounded-2xl p-4 text-center text-white font-black text-3xl mb-6 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${PRIZE_COLORS[data.prize]}, ${PRIZE_COLORS[data.prize]}88)` }}
              >
                {data.prize}
                <p className="text-base font-semibold opacity-90 mt-1">
                  {data.count} / {data.totalItems} immagini estratte
                </p>
              </div>
            ) : (
              <div className="rounded-2xl p-4 text-center bg-gray-700 text-white/60 font-bold text-xl mb-6">
                Nessuna vincita ancora
                <p className="text-sm mt-1">{data.count} / {data.totalItems} immagini estratte</p>
              </div>
            )}

            {/* Grid 5x3 */}
            <div className="grid grid-cols-5 gap-2">
              {(data.items || []).map((item) => (
                <div
                  key={item.id}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    item.bestRow
                      ? "border-yellow-400 ring-2 ring-yellow-300"
                      : item.matched
                      ? "border-green-500 ring-1 ring-green-300"
                      : "border-gray-700 opacity-30"
                  }`}
                >
                  <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover" />
                  {item.matched && (
                    <div className={`absolute inset-0 flex items-center justify-center ${item.bestRow ? "bg-yellow-400/30" : "bg-green-500/30"}`}>
                      <span className={`font-black text-3xl drop-shadow ${item.bestRow ? "text-yellow-300" : "text-green-300"}`}>✓</span>
                    </div>
                  )}
                  <p className="text-[9px] text-center truncate px-0.5 py-0.5 text-white/70 bg-black/50">{item.name}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-white/30 text-xs mt-6">Tocca per chiudere</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}