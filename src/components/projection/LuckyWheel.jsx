import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

const ITEM_WIDTH = 220;
const VISIBLE_COUNT = 7;
const STRIP_BEFORE = 28;
const SPIN_DURATION_MS = 3500;

export default function LuckyWheel({ images, target, onComplete, audioUrl }) {
  const [strip, setStrip] = useState([]);
  const [targetX, setTargetX] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const calledRef = useRef(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!target) return;

    const filteredImages = images.filter((img) => img.image_url !== target.image_url);
    const pool = filteredImages.length > 0 ? filteredImages : [target];
    // Shuffle pool e cicla senza ripetizioni consecutive
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const built = [];
    for (let i = 0; i < STRIP_BEFORE; i++) {
      built.push(shuffled[i % shuffled.length]);
    }
    built.push(target);

    const centerOffset = Math.floor(VISIBLE_COUNT / 2) * ITEM_WIDTH;
    const tx = centerOffset - STRIP_BEFORE * ITEM_WIDTH;

    setStrip(built);
    setTargetX(tx);

    // Play wheel audio
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

    const t1 = setTimeout(() => setSpinning(true), 80);
    const t2 = setTimeout(() => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete?.();
      }
    }, SPIN_DURATION_MS);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const centerOffset = Math.floor(VISIBLE_COUNT / 2) * ITEM_WIDTH;
  const viewportWidth = ITEM_WIDTH * VISIBLE_COUNT;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-white text-5xl font-black mb-10 uppercase tracking-widest text-center"
        style={{ textShadow: "0 0 40px rgba(255,200,0,0.9)" }}
      >
        Estrazione in corso...
      </motion.h2>

      {/* Slot viewport */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{ width: viewportWidth, height: 270, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}
      >
        {/* Strip */}
        <motion.div
          className="flex absolute top-0 left-0 h-full"
          initial={{ x: 0 }}
          animate={spinning ? { x: targetX } : { x: 0 }}
          transition={spinning ? { duration: SPIN_DURATION_MS / 1000, ease: [0.05, 0.15, 0.6, 1] } : { duration: 0 }}
        >
          {strip.map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-2 flex flex-col items-center justify-center"
              style={{ width: ITEM_WIDTH }}
            >
              <img
                src={item.image_url}
                alt={item.label || ""}
                className="w-full object-cover rounded-2xl shadow-xl"
                style={{ height: 190 }}
              />
              <p className="text-white text-center text-sm mt-2 font-semibold truncate w-full px-1 opacity-80">
                {item.label || ""}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Center highlight */}
        <div
          className="absolute inset-y-0 z-10 rounded-2xl pointer-events-none"
          style={{
            left: centerOffset,
            width: ITEM_WIDTH,
            border: "4px solid #facc15",
            boxShadow: "0 0 40px rgba(250,204,21,0.7), inset 0 0 20px rgba(250,204,21,0.1)",
          }}
        />

        {/* Side fades */}
        <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-yellow-400 text-xl font-bold mt-8 uppercase tracking-widest"
      >
        ★ ★ ★
      </motion.p>
    </div>
  );
}
