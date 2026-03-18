import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LatestExtraction({ extraction, bonusAudioUrl, onComplete }) {
  const bonusAudioRef = useRef(null);
  const extractionAudioRef = useRef(null);
  const [phase, setPhase] = useState(null); // "bonus" | "reveal" | null
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!extraction) {
      setPhase(null);
      return;
    }

    const timers = [];

    const playReveal = () => {
      if (bonusAudioRef.current) {
        bonusAudioRef.current.pause();
        bonusAudioRef.current.currentTime = 0;
      }
      setPhase("reveal");

      // Aspetta la fine dell'audio estrazione prima di chiudere
      const audio = extractionAudioRef.current;
      if (extraction.audio_url && audio) {
        audio.src = extraction.audio_url;
        audio.onended = () => {
          onCompleteRef.current?.();
        };
        audio.play().catch(() => {});
        // Nascondi l'immagine dopo 5 secondi, ma l'audio continua
        const t = setTimeout(() => setPhase(null), 15000);
        timers.push(t);
      } else {
        // Nessun audio: nascondi dopo 10 secondi
        const t = setTimeout(() => {
          setPhase(null);
          onCompleteRef.current?.();
        }, 15000);
        timers.push(t);
      }
    };

    if (extraction.is_bonus && !extraction.skip_intro) {
      setPhase("bonus");
      const tBonus = setTimeout(() => {
        if (bonusAudioRef.current) bonusAudioRef.current.play().catch(() => {});
      }, 100);
      timers.push(tBonus);
      const t1 = setTimeout(playReveal, 4000);
      timers.push(t1);
    } else {
      playReveal();
    }

    return () => {
      timers.forEach(clearTimeout);
      // Ferma l'audio estrazione se il componente viene smontato/resettato
      if (extractionAudioRef.current) {
        extractionAudioRef.current.pause();
        extractionAudioRef.current.onended = null;
      }
    };
  }, [extraction]);

  return (
    <>
      {/* Audio bonus (durante schermata BONUS VOICE) */}
      {bonusAudioUrl && <audio ref={bonusAudioRef} src={bonusAudioUrl} />}
      {/* Audio estrazione (durante reveal immagine) */}
      <audio ref={extractionAudioRef} />

      {/* BONUS VOICE phase */}
      <AnimatePresence>
        {phase === "bonus" && (
          <motion.div
            key="bonus-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
            style={{ background: "radial-gradient(ellipse at center, #1a0030 0%, #000 100%)" }}
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-yellow-300"
                style={{
                  width: Math.random() * 6 + 2,
                  height: Math.random() * 6 + 2,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
                transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() * 2 }}
              />
            ))}
            <div className="text-center z-10 px-8">
              <motion.div
                initial={{ scale: 0.3, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 10, delay: 0.2 }}
              >
                <p className="text-yellow-300 text-2xl md:text-3xl font-black uppercase tracking-widest mb-4 drop-shadow-lg">
                  🎤 Attenzione!
                </p>
                <h1
                  className="font-black uppercase leading-none drop-shadow-2xl"
                  style={{
                    fontSize: "clamp(4rem, 15vw, 12rem)",
                    background: "linear-gradient(135deg, #ff6fd8, #ff4f4f, #ffd700, #ff6fd8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 30px rgba(255,100,200,0.7))",
                  }}
                >
                  BONUS
                </h1>
                <h1
                  className="font-black uppercase leading-none drop-shadow-2xl"
                  style={{
                    fontSize: "clamp(4rem, 15vw, 12rem)",
                    background: "linear-gradient(135deg, #ffd700, #ff9f00, #ffd700)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 30px rgba(255,200,0,0.8))",
                  }}
                >
                  VOICE
                </h1>
              </motion.div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="h-1 bg-gradient-to-r from-pink-500 via-yellow-400 to-pink-500 rounded-full mt-6 mx-auto w-64"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal phase */}
      <AnimatePresence>
        {phase === "reveal" && extraction && (
          <motion.div
            key="reveal-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="text-center"
            >
              <motion.div
                initial={{ rotateY: 180 }}
                animate={{ rotateY: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative inline-block"
              >
                <img
                  src={extraction.image_url}
                  alt={extraction.media_name}
                  className={`w-72 h-72 md:w-96 md:h-96 object-cover rounded-3xl shadow-2xl border-4 ${
                    extraction.is_bonus
                      ? "border-pink-400 shadow-pink-500/40"
                      : "border-yellow-400 shadow-yellow-500/20"
                  }`}
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute -top-4 -left-4 w-14 h-14 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center text-2xl font-black shadow-xl"
                >
                  {extraction.order_number}
                </motion.div>
                {extraction.is_bonus && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.7, type: "spring" }}
                    className="absolute -top-4 -right-4 bg-gradient-to-br from-pink-500 to-yellow-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-xl uppercase tracking-wider"
                  >
                    🎤 Bonus Voice
                  </motion.div>
                )}
              </motion.div>
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`mt-8 text-4xl md:text-5xl font-black tracking-tight ${
                  extraction.is_bonus ? "text-pink-300" : "text-white"
                }`}
              >
                {extraction.media_name}
              </motion.h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}