import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import CardChecker from "../cards/CardChecker";

export default function DashboardCardChecker({ mediaItems, extractions, isDark, selectedProjectId }) {
  const [cardNumber, setCardNumber] = useState("");
  const [checkerResult, setCheckerResult] = useState(null);

  const { data: allCards = [] } = useQuery({
    queryKey: ["playerCards"],
    queryFn: () => base44.entities.PlayerCard.list("card_number"),
  });

  const handleCheck = () => {
    const num = parseInt(cardNumber);
    // Filtra per progetto se selezionato
    const scopedCards = selectedProjectId
      ? allCards.filter((c) => c.project_id === selectedProjectId)
      : allCards;
    const card = scopedCards.find((c) => c.card_number === num);
    if (!card) {
      setCheckerResult({ error: `Cartella #${num} non trovata${selectedProjectId ? " nel progetto selezionato" : ""}.` });
      return;
    }
    setCheckerResult({ card, mediaItems });
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Numero cartella..."
          value={cardNumber}
          onChange={(e) => { setCardNumber(e.target.value); setCheckerResult(null); }}
          className={`flex-1 border rounded-xl px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white"}`}
        />
        <button
          onClick={handleCheck}
          disabled={!cardNumber}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-40 flex items-center gap-1"
        >
          <Trophy className="w-4 h-4" />
        </button>
      </div>
      {checkerResult && (
        <CardChecker
          result={checkerResult}
          extractions={extractions}
          onHide={() => setCheckerResult(null)}
        />
      )}
    </div>
  );
}