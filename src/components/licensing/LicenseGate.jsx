import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLicense } from "@/components/licensing/LicenseProvider";
import { matchesOwnerEmail } from "@/lib/licensing";

export default function LicenseGate({ children }) {
  const { loading, hasActiveLicense, activate, activateOwnerAccess, ownerEmail } = useLicense();
  const [email, setEmail] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const ownerMode = useMemo(() => matchesOwnerEmail(email, ownerEmail), [email, ownerEmail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900/90 p-8 shadow-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200">BingoVoice</p>
          <h2 className="mt-4 text-2xl font-black">Verifica licenza in corso</h2>
        </div>
      </div>
    );
  }

  if (hasActiveLicense) {
    return children;
  }

  const handleActivate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await activate({ email, key: licenseKey });
      setSuccess("Licenza attivata correttamente.");
    } catch (activationError) {
      setError(activationError.message || "Attivazione non riuscita");
    }
  };

  const handleOwnerAccess = async () => {
    setError("");
    setSuccess("");
    try {
      await activateOwnerAccess();
      setSuccess("Accesso proprietario attivato.");
    } catch (activationError) {
      setError(activationError.message || "Accesso proprietario non riuscito");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/90 p-8 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan-200">
            <Sparkles className="h-4 w-4" />
            BingoVoice
          </div>
          <h2 className="text-2xl font-black">Attiva BingoVoice</h2>
          <form onSubmit={handleActivate} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@dominio.it"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Chiave licenza</label>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="BV-XXXX-XXXX-XXXX..."
                rows={5}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950 transition hover:bg-cyan-400"
            >
              Attiva programma
            </button>
          </form>

          {ownerMode ? (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="text-sm font-bold text-amber-200">Accesso prioritario proprietario</p>
              <p className="mt-1 text-xs text-amber-100/80">
                Per la mail proprietaria puoi attivare subito un profilo admin su questo PC.
              </p>
              <button
                type="button"
                onClick={handleOwnerAccess}
                className="mt-4 w-full rounded-xl border border-amber-300/40 bg-amber-300/20 px-4 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-300/30"
              >
                Attiva accesso proprietario
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
