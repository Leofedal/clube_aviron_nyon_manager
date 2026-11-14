import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOuting } from "@/lib/services/outing-queries";
import { canFinishOuting } from "@/lib/permissions";
import { toOutingDTO } from "@/lib/dto";
import { toLocalDateString, toLocalTimeString } from "@/lib/time";
import { FinishOutingForm } from "./finish-form";

export const metadata = { title: "Terminer la sortie" };

export default async function FinishOutingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const outing = await getOuting(id);
  if (!outing) notFound();
  if (outing.status !== "IN_PROGRESS") redirect(`/sorties/${id}`);
  const allowed = canFinishOuting(user, {
    status: outing.status,
    createdById: outing.createdById,
    departureAt: outing.departureAt,
    createdAt: outing.createdAt,
    crewUserIds: outing.crew.map((c) => c.userId),
  });
  if (!allowed) redirect(`/sorties/${id}`);
  const now = new Date();
  return (
    <FinishOutingForm
      outing={toOutingDTO(outing)}
      defaults={{ date: toLocalDateString(now), time: toLocalTimeString(now) }}
    />
  );
}
