import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, FolderOpen, Pencil, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import usePersistentTheme from "@/hooks/usePersistentTheme";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";
import CardForm from "../components/cards/CardForm";
import CardEditModal from "../components/cards/CardEditModal.jsx";

export default function CardManager() {
  const queryClient = useQueryClient();
  const { isDark, toggleTheme } = usePersistentTheme();
  const { hasPermission } = useLicense();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [editingCard, setEditingCard] = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["playerCards"],
    queryFn: () => base44.entities.PlayerCard.list("card_number"),
  });

  const { data: mediaItems = [] } = useQuery({
    queryKey: ["mediaItems"],
    queryFn: () => base44.entities.MediaItem.list("-created_date"),
  });

  const filteredCards = selectedProjectId
    ? cards.filter((card) => card.project_id === selectedProjectId)
    : cards;

  const filteredMedia = selectedProjectId
    ? mediaItems.filter((item) => item.project_id === selectedProjectId)
    : mediaItems;

  const refreshCards = () => queryClient.invalidateQueries({ queryKey: ["playerCards"] });

  const handleDelete = async (id) => {
    await base44.entities.PlayerCard.delete(id);
    refreshCards();
  };

  const pageBg = isDark ? "bg-gray-950" : "bg-gray-50";
  const header = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const panel = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const title = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const filterButton = (selected) =>
    selected
      ? "bg-indigo-600 text-white shadow"
      : isDark
        ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200";

  if (!hasPermission(LICENSE_PERMISSIONS.CARD_MANAGER)) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md rounded-3xl border p-8 text-center shadow-sm ${panel}`}>
          <h1 className={`text-2xl font-black ${title}`}>Modulo Cartelle non attivo</h1>
          <p className={`mt-3 text-sm ${sub}`}>
            Questa licenza non ha il permesso per creare o modificare cartelle.
          </p>
          <Button asChild className="mt-6">
            <Link to="/Dashboard">Torna alla Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className={`${header} sticky top-0 z-10 border-b`}>
        <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3">
          <Link to="/Dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className={`text-xl font-black ${title}`}>Gestione Cartelle</h1>
            <p className={`text-xs ${sub}`}>
              {filteredCards.length} cartelle {selectedProjectId ? `- ${projects.find((project) => project.id === selectedProjectId)?.name}` : "totali"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-500" />}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 items-start gap-6 px-4 py-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
            <h2 className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${sub}`}>
              <FolderOpen className="h-4 w-4" /> Progetto
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setSelectedProjectId(null)}
                className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${filterButton(!selectedProjectId)}`}
              >
                Tutti
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${filterButton(selectedProjectId === project.id)}`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${panel}`}>
            <h2 className={`mb-4 text-sm font-semibold uppercase tracking-wider ${sub}`}>Cartelle ({filteredCards.length})</h2>
            {filteredCards.length === 0 ? (
              <p className={`py-6 text-center text-sm ${sub}`}>Nessuna cartella</p>
            ) : (
              <div className="space-y-2">
                {filteredCards.map((card) => (
                  <div key={card.id} className={`flex items-center gap-3 rounded-xl border p-3 ${isDark ? "border-gray-800 bg-gray-950" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-lg font-black text-indigo-700">
                      {card.card_number}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${title}`}>Cartella #{card.card_number}</p>
                      <p className={`text-xs ${sub}`}>
                        {(card.media_item_ids || []).length} immagini
                        {card.project_id && !selectedProjectId ? (
                          <span className="ml-1 text-indigo-400">· {projects.find((project) => project.id === card.project_id)?.name}</span>
                        ) : null}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditingCard(card)} className="text-gray-400 hover:text-blue-500">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <CardForm
            mediaItems={filteredMedia}
            projectId={selectedProjectId}
            onCreated={refreshCards}
            onCancel={null}
            isDark={isDark}
          />
        </div>
      </div>

      {editingCard ? (
        <CardEditModal
          card={editingCard}
          mediaItems={filteredMedia}
          onClose={() => setEditingCard(null)}
          onUpdated={() => {
            refreshCards();
            setEditingCard(null);
          }}
          isDark={isDark}
        />
      ) : null}
    </div>
  );
}
