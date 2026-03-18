import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function VideoOverlay({ videoUrl, onEnded }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.play();
    }
  }, [videoUrl]);

  return (
    <AnimatePresence>
      {videoUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 bg-black"
        >
          <video
            ref={videoRef}
            src={videoUrl}
            onEnded={onEnded}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            autoPlay
            playsInline
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}