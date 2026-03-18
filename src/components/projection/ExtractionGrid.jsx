import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExtractionGrid({ extractions, latestId }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
      <AnimatePresence>
        {extractions.map((ext) => (
          <motion.div
            key={ext.id}
            initial={{ opacity: 0, scale: 0.5, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className={`relative rounded-2xl overflow-hidden shadow-2xl ${
              ext.id === latestId ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-gray-950" : ""
            }`}
          >
            <div className="aspect-square">
              <img src={ext.image_url} alt={ext.media_name} className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-white text-sm font-semibold truncate">{ext.media_name}</p>
              <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center text-xs font-bold shadow-lg">
                {ext.order_number}
              </div>
            </div>
            {ext.id === latestId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="absolute inset-0 bg-yellow-400/30"
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}