import { redirect } from "next/navigation";

/** Agreements are managed on each program's page; keep old links working. */
export default function AgreementsRedirect() {
  redirect("/admin/programs");
}
