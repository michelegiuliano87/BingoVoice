import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoUrl from "@/assets/logo.png";
const TOTAL_SLOTS = 90;

export default function BingoBoard({ extractions, latestId }) {
  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    return extractions.find((e) => e.order_number === i + 1) || null;
  });

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col overflow-hidden p-2">
      {/* Logo + stats row */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0">
        <img
          src={logoUrl}
          alt="BingoVoice"
          className="h-12 object-contain drop-shadow-xl"
        />
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">
            Estratti: <span className="text-white font-bold">{extractions.length}</span>
          </span>
          <span className="text-gray-500">
            Rimanenti: <span className="text-yellow-400 font-bold">{TOTAL_SLOTS - extractions.length}</span>
          </span>
        </div>
      </div>

      {/* Board — fills remaining space */}
      <div
        className="flex-1 grid min-h-0"
        style={{
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gridTemplateRows: "repeat(9, minmax(0, 1fr))",
          gap: "4px",
        }}
      >
        {slots.map((extraction, i) => (
          <motion.div
            key={i}
            className={`relative rounded-md overflow-hidden border ${
              extraction
                ? extraction.id === latestId
                  ? "border-yellow-400 shadow-lg shadow-yellow-500/40"
                  : extraction.is_bonus
                  ? "border-pink-500"
                  : "border-gray-700"
                : "border-gray-800 bg-gray-900"
            }`}
          >
            <AnimatePresence>
              {extraction ? (
                <motion.div
                  key="filled"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="absolute inset-0"
                >
                  <img
                    src={extraction.image_url}
                    alt={extraction.media_name}
                    className="w-full h-full object-cover"
                  />
                  {/* Bonus badge */}
                  {extraction.is_bonus && (
                    <div className="absolute inset-0 bg-gradient-to-t from-pink-900/70 to-transparent" />
                  )}
                  {/* Number badge */}
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center text-[8px] font-black leading-none shadow">
                    {extraction.order_number}
                  </div>
                  {extraction.is_bonus && (
                    <div className="absolute bottom-0.5 left-0 right-0 text-center">
                      <span className="text-[7px] font-black text-pink-300 uppercase tracking-wide leading-none">BONUS</span>
                    </div>
                  )}
                  {/* Latest glow */}
                  {extraction.id === latestId && (
                    <motion.div
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 2, repeat: 2 }}
                      className="absolute inset-0 bg-yellow-400/30"
                    />
                  )}
                </motion.div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-gray-700 text-[10px] font-bold">{i + 1}</span>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
