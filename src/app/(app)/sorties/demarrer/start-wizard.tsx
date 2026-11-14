"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BoatPicker } from "@/components/outings/boat-picker";
import { CrewPicker, type PickerMemberDTO } from "@/components/outings/crew-picker";
import { startOutingAction } from "@/app/actions/outings";
import { BoatTagsWarning } from "@/components/boats/boat-tags";
import { DirectionPicker, type Direction } from "@/components/outings/direction-picker";
import { CLUB_TZ } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BoatOptionDTO } from "@/lib/picker-data";
import type { CrewMemberInput } from "@/lib/validation/outing";

const STEPS = ["Bateau", "Équipage", "Départ"] as const;

export function StartOutingWizard({
  boats,
  members,
  currentUserId,
  initialBoatId,
  serverNow,
}: {
  boats: BoatOptionDTO[];
  members: PickerMemberDTO[];
  currentUserId: string;
  initialBoatId: string | null;
  serverNow: { date: string; time: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialBoatId ? 1 : 0);
  const [boatId, setBoatId] = useState<string | null>(initialBoatId);
  const me = members.find((m) => m.id === currentUserId);
  const [crew, setCrew] = useState<CrewMemberInput[]>(
    me && !me.busyOn ? [{ userId: currentUserId, crewRole: "ROWER" }] : [],
  );
  const [date, setDate] = useState(serverNow.date);
  const [time, setTime] = useState(serverNow.time);
  const [timeEdited, setTimeEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const boat = useMemo(() => boats.find((b) => b.id === boatId) ?? null, [boats, boatId]);
  const rowers = crew.filter((c) => c.crewRole === "ROWER").length;

  // À l'étape de confirmation, l'heure de départ est actualisée (sauf si modifiée à la main).
  useEffect(() => {
    if (step === 2 && !timeEdited) {
      const now = new Date();
      setDate(formatInTimeZone(now, CLUB_TZ, "yyyy-MM-dd"));
      setTime(formatInTimeZone(now, CLUB_TZ, "HH:mm"));
    }
  }, [step, timeEdited]);

  function selectBoat(b: BoatOptionDTO) {
    setBoatId(b.id);
    // Ajuste l'équipage si le nouveau bateau est plus petit
    let r = 0;
    let c = 0;
    setCrew((prev) =>
      prev.filter((m) => {
        if (m.crewRole === "ROWER") return ++r <= b.rowingCapacity;
        return ++c <= b.coxswainCapacity;
      }),
    );
    setError(null);
    setStep(1);
  }

  function submit() {
    if (!boat) return;
    if (!direction) {
      setError("Choisissez la direction : Genève ou Lausanne.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await startOutingAction({ boatId: boat.id, crew, direction, departureDate: date, departureTime: time, notes });
      if (res.ok) {
        toast.success(`Bonne sortie ! ${boat.name} est enregistré sur l'eau.`);
        router.push(`/sorties/${res.data.id}?nouveau=1`);
      } else {
        setError(res.error);
        toast.error(res.error);
        if (res.code === "BOAT_BUSY" || res.code === "BOAT_UNAVAILABLE") router.refresh();
      }
    });
  }

  const selectedNames = crew
    .map((c) => members.find((m) => m.id === c.userId))
    .filter(Boolean)
    .map((m) => m!.firstName);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} aria-label="Étape précédente">
            <ArrowLeft />
          </Button>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Démarrer une sortie</h1>
          <p className="text-muted-foreground text-sm">Enregistrez votre départ maintenant, terminez la sortie au retour.</p>
        </div>
      </div>

      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step || (i === 2 && rowers === 0)}
              onClick={() => setStep(i)}
              className="flex w-full flex-col gap-1.5 text-left"
            >
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section aria-labelledby="step-boat">
          <h2 id="step-boat" className="mb-3 font-medium">
            Quel bateau prenez-vous ?
          </h2>
          <BoatPicker boats={boats} value={boatId} onSelect={selectBoat} />
        </section>
      )}

      {step === 1 && boat && (
        <section aria-labelledby="step-crew" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="step-crew" className="font-medium">
              Qui est dans le bateau ?
            </h2>
            <button type="button" onClick={() => setStep(0)} className="text-link text-sm hover:underline">
              {boat.name} ({boat.typeCode}) · changer
            </button>
          </div>
          <BoatTagsWarning boatName={boat.name} tags={boat.tags} />
          <CrewPicker
            members={members}
            value={crew}
            onChange={setCrew}
            rowingCapacity={boat.rowingCapacity}
            coxswainCapacity={boat.coxswainCapacity}
            currentUserId={currentUserId}
          />
          <div className="bg-background/95 sticky bottom-20 z-10 -mx-1 rounded-xl p-1 backdrop-blur md:bottom-4">
            <Button size="xl" className="w-full" disabled={rowers === 0} onClick={() => setStep(2)}>
              Continuer <ChevronRight />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && boat && (
        <section aria-labelledby="step-confirm" className="flex flex-col gap-4">
          <h2 id="step-confirm" className="font-medium">
            Confirmez le départ
          </h2>
          <BoatTagsWarning boatName={boat.name} tags={boat.tags} />
          <div className="grid gap-2">
            <Label>Direction</Label>
            <DirectionPicker
              value={direction}
              onChange={(d) => {
                setDirection(d);
                setError(null);
              }}
              invalid={!!error && !direction}
            />
          </div>
          <Card>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bateau</span>
                <span className="font-medium">
                  {boat.name} <span className="text-muted-foreground">({boat.typeCode})</span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Équipage</span>
                <span className="text-right font-medium">{selectedNames.join(", ")}</span>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dep-date">Date</Label>
              <Input
                id="dep-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTimeEdited(true);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dep-time">Heure de départ</Label>
              <Input
                id="dep-time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setTimeEdited(true);
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">
              Commentaire <span className="text-muted-foreground font-normal">(facultatif)</span>
            </Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parcours prévu, conditions…" />
          </div>
          {error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <Button size="xl" className="w-full" onClick={submit} disabled={pending || !direction}>
            {pending ? <Loader2 className="animate-spin" /> : <Play />}
            Démarrer la sortie
          </Button>
          {!direction && (
            <p className="text-muted-foreground -mt-2 text-center text-sm">Choisissez d&apos;abord la direction.</p>
          )}
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
            <Check className="size-3.5" /> Le bateau sera signalé comme occupé jusqu&apos;à votre retour.
          </p>
        </section>
      )}
    </div>
  );
}
