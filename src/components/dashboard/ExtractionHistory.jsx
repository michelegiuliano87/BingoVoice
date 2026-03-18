import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, History } from "lucide-react";
import { format } from "date-fns";

export default function ExtractionHistory({ extractions, onCleared }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" /> Storico Estrazioni
        </h3>
      </div>
      {extractions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Nessuna estrazione</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {extractions.map((ext) => (
            <div key={ext.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                {ext.order_number}
              </div>
              <img src={ext.image_url} alt={ext.media_name} className="w-8 h-8 rounded object-cover" />
              <span className="text-sm font-medium text-gray-700 truncate flex-1">{ext.media_name}</span>
              <span className="text-xs text-gray-400">{format(new Date(ext.created_date), "HH:mm")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}