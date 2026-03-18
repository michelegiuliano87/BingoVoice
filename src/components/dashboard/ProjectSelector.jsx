import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FolderOpen, ImagePlus, Layers3, PlusSquare } from "lucide-react";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";

export default function ProjectSelector({ projects, selectedProjectId, onSelect, isDark = false }) {
  const { hasPermission } = useLicense();
  const wrapper = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const title = isDark ? "text-gray-300" : "text-gray-500";
  const empty = isDark ? "border-gray-700 bg-gray-900 text-gray-400" : "border-gray-200 bg-gray-50 text-gray-500";
  const itemBase = isDark ? "border-gray-700 bg-gray-900 hover:border-cyan-500" : "border-gray-200 bg-white hover:border-cyan-300";
  const itemSelected = isDark ? "border-cyan-500 bg-cyan-950/40" : "border-cyan-400 bg-cyan-50";
  const text = isDark ? "text-white" : "text-gray-900";
  const subtext = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div className={`space-y-4 rounded-2xl border p-5 shadow-sm ${wrapper}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${title}`}>
            <FolderOpen className="h-4 w-4" /> Progetti
          </h3>
          <p className={`mt-1 text-xs ${subtext}`}>Scegli il progetto attivo tramite miniatura.</p>
        </div>
        {hasPermission(LICENSE_PERMISSIONS.PROJECTS) ? (
          <Button asChild size="sm" className="bg-cyan-600 hover:bg-cyan-700">
            <Link to="/Projects">
              <PlusSquare className="mr-2 h-4 w-4" />
              Gestisci
            </Link>
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onSelect?.(null)}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
          !selectedProjectId ? itemSelected : itemBase
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm">
          <Layers3 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${text}`}>Tutti i progetti</p>
          <p className={`text-xs ${subtext}`}>Visualizza e usa tutti i contenuti caricati.</p>
        </div>
      </button>

      {projects.length === 0 ? (
        <div className={`rounded-2xl border border-dashed p-4 text-sm ${empty}`}>
          Nessun progetto disponibile. Creane uno nella pagina `Progetti`.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect?.(project.id)}
              className={`rounded-2xl border p-2 text-left transition ${selectedProjectId === project.id ? itemSelected : itemBase}`}
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                {project.image_url ? (
                  <img src={project.image_url} alt={project.name} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center ${subtext}`}>
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
              </div>
              <p className={`mt-2 truncate text-sm font-bold ${text}`}>{project.name}</p>
              <p className={`truncate text-[11px] ${subtext}`}>
                {project.description || "Miniatura progetto"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
