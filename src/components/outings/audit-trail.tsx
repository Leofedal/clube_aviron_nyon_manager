import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/time";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  START: "Départ enregistré",
  FINISH: "Retour enregistré",
  UPDATE: "Modification",
  CANCEL: "Annulation",
  OVERLAP_OVERRIDE: "Chevauchement autorisé",
  DEACTIVATE: "Désactivation",
  REACTIVATE: "Réactivation",
  PASSWORD_RESET: "Réinitialisation du mot de passe",
  ROLE_CHANGE: "Changement de rôle",
};

export function actionLabel(a: string) {
  return ACTION_LABELS[a] ?? a;
}

/** Différences lisibles entre deux instantanés JSON. */
export function diffValues(prev: unknown, next: unknown): { key: string; from: string; to: string }[] {
  if (!prev || !next || typeof prev !== "object" || typeof next !== "object") return [];
  const p = prev as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
  const out: { key: string; from: string; to: string }[] = [];
  for (const k of keys) {
    if (["updatedAt", "createdAt", "passwordHash"].includes(k)) continue;
    const a = JSON.stringify(p[k] ?? null);
    const b = JSON.stringify(n[k] ?? null);
    if (a !== b) out.push({ key: k, from: short(p[k]), to: short(n[k]) });
  }
  return out;
}

function short(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(new Date(v));
  if (Array.isArray(v)) return `${v.length} élément(s)`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

export function AuditTrail({
  entries,
}: {
  entries: {
    id: string;
    action: string;
    createdAt: Date;
    previousValues: unknown;
    newValues: unknown;
    actor: { firstName: string; lastName: string } | null;
  }[];
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Historique (journal d&apos;audit)</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-4">
          {entries.map((e) => {
            const diff = diffValues(e.previousValues, e.newValues);
            const reason = (e.newValues as { reason?: string } | null)?.reason;
            return (
              <li key={e.id} className="text-sm">
                <span className="bg-navy absolute -left-[5px] mt-1.5 size-2.5 rounded-full" />
                <div className="font-medium">{actionLabel(e.action)}</div>
                <div className="text-muted-foreground text-xs">
                  {formatDateTime(e.createdAt)} · {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "système"}
                </div>
                {reason && <div className="mt-1 text-xs">Motif : {reason}</div>}
                {diff.length > 0 && e.action !== "CREATE" && e.action !== "START" && (
                  <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {diff
                      .filter((d) => d.key !== "reason")
                      .map((d) => (
                        <li key={d.key}>
                          <span className="font-mono">{d.key}</span> : {d.from} → <span className="text-foreground">{d.to}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
