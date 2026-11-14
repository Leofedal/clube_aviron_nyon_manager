import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Mon compte" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Mon compte" description={`${user.firstName} ${user.lastName} · ${user.email}`} />
      <PasswordForm />
    </div>
  );
}
