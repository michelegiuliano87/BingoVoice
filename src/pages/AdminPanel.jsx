import React from "react";
import { ArrowLeft, Shield, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLicense } from "@/components/licensing/LicenseProvider";
import usePersistentTheme from "@/hooks/usePersistentTheme";
import AdminLicensePanel from "../components/dashboard/AdminLicensePanel";
import { LICENSE_PERMISSIONS } from "@/lib/licensing";

export default function AdminPanel() {
  const { activeLicense, isAdmin, hasPermission } = useLicense();
  const { isDark, toggleTheme } = usePersistentTheme();

  if (!isAdmin || !hasPermission(LICENSE_PERMISSIONS.ADMIN_PANEL)) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${isDark ? "bg-gray-950" : "bg-gray-50"}`}>
        <div className={`w-full max-w-md rounded-3xl border p-8 text-center shadow-sm ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-white"}`}>
          <Shield className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className={`mt-4 text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>Accesso Admin Richiesto</h1>
          <p className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Questa pagina e&apos; disponibile solo per licenze con privilegi admin.
          </p>
          <Link to="/Dashboard" className="mt-6 block">
            <Button className="w-full">Torna alla Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-50"}`}>
      <div className={`sticky top-0 z-10 border-b ${isDark ? "border-gray-800 bg-gray-900" : "bg-white"}`}>
        <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3">
          <Link to="/Dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>Pannello Admin</h1>
            <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Gestione licenze, clienti e dispositivi · {activeLicense?.email}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-500" />}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-4 py-6">
        <AdminLicensePanel isDark={isDark} />
      </div>
    </div>
  );
}
