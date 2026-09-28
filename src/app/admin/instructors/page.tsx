import Link from "next/link";
import { Mail, Phone, Presentation, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { assignInstructor, deleteInstructor, saveInstructor, unassignInstructor } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { todayInArizona } from "@/lib/schedule";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Instructors" };

type Instructor = { id: string; name: string; title: string; email: string | null; phone: string | null; bio: string | null; active: boolean };
type Cohort = { id: string; name: string; start_date: string; end_date: string; program_id: string };
type Assignment = { id: string; cohort_id: string; instructor_id: string; role: string };

function InstructorFields({ i }: { i?: Instructor }) {
  const key = i?.id ?? "new";
  return (
    <>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div>
        <Label htmlFor={`name-${key}`}>Full name</Label>
        <Input id={`name-${key}`} name="name" defaultValue={i?.name} required minLength={2} maxLength={120} />
      </div>
      <div>
        <Label htmlFor={`title-${key}`}>Title</Label>
        <Input id={`title-${key}`} name="title" defaultValue={i?.title ?? ""} maxLength={80} placeholder="Instructor, Lab TA, Program coordinator…" />
      </div>
      <div>
        <Label htmlFor={`email-${key}`}>Email (optional)</Label>
        <Input id={`email-${key}`} name="email" type="email" defaultValue={i?.email ?? ""} maxLength={200} />
      </div>
      <div>
        <Label htmlFor={`phone-${key}`}>Phone (optional)</Label>
        <Input id={`phone-${key}`} name="phone" defaultValue={i?.phone ?? ""} maxLength={40} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`bio-${key}`}>Short bio shown to trainees (optional)</Label>
        <Textarea id={`bio-${key}`} name="bio" defaultValue={i?.bio ?? ""} maxLength={1000} className="min-h-16 text-sm" placeholder="Background, specialty, industry experience…" />
      </div>
    </>
  );
}

export default async function InstructorsPage() {
  await requirePermission("cohorts.manage", "/admin/instructors");
  const supabase = await createClient();
  const [{ data: instructors }, { data: cohorts }, { data: programs }, { data: assignments }] = await Promise.all([
    supabase.from("instructors").select("id, name, title, email, phone, bio, active").order("active", { ascending: false }).order("name"),
    supabase.from("cohorts").select("id, name, start_date, end_date, program_id").order("start_date"),
    supabase.from("programs").select("id, short_name").order("sort"),
    supabase.from("cohort_instructors").select("id, cohort_id, instructor_id, role"),
  ]);
  const people = (instructors ?? []) as Instructor[];
  const allCohorts = (cohorts ?? []) as Cohort[];
  const cohortById = new Map(allCohorts.map((c) => [c.id, c]));
  const programName = new Map((programs ?? []).map((p) => [p.id as string, p.short_name as string]));
  const links = (assignments ?? []) as Assignment[];
  const today = todayInArizona();
  // Only cohorts that haven't finished are offered for new assignments, grouped by program.
  const openCohorts = allCohorts.filter((c) => c.end_date >= today);
  const byProgram = (programs ?? [])
    .map((p) => ({ name: p.short_name as string, cohorts: openCohorts.filter((c) => c.program_id === p.id) }))
    .filter((g) => g.cohorts.length);

  return (
    <div>
      <PageHeader
        eyebrow="Scheduling"
        title="Instructors"
        description="Add each instructor once, then assign them to as many cohorts as they teach, across any program. Trainees see the instructors of their own cohort on their In program tab."
      />

      <Card>
        <h2 className="mb-5 text-lg font-black">Add an instructor</h2>
        <ActionForm action={saveInstructor} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
          <InstructorFields />
          <div className="sm:col-span-2">
            <SubmitButton variant="dark" pendingText="Adding…">
              Add instructor
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <div className="mt-6 grid gap-4">
        {people.length === 0 && <EmptyState title="No instructors yet" />}
        {people.map((i) => {
          const mine = links
            .filter((l) => l.instructor_id === i.id)
            .map((l) => ({ ...l, cohort: cohortById.get(l.cohort_id) }))
            .filter((l) => l.cohort)
            .sort((a, b) => a.cohort!.start_date.localeCompare(b.cohort!.start_date));
          const progs = Array.from(new Set(mine.map((l) => programName.get(l.cohort!.program_id)).filter(Boolean)));
          const current = mine.filter((l) => l.cohort!.end_date >= today).length;
          return (
            <Card key={i.id} className={i.active ? undefined : "opacity-70"}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-maroon">
                  <Presentation className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink">{i.name}</p>
                  <p className="text-sm font-bold text-maroon">{i.title}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
                    {i.email && (
                      <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-maroon">
                        <Mail className="h-3 w-3" aria-hidden /> {i.email}
                      </a>
                    )}
                    {i.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" aria-hidden /> {i.phone}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!i.active && <Badge tone="neutral">Inactive</Badge>}
                  <Badge tone={current ? "success" : "neutral"}>
                    {current} current · {mine.length} total cohort{mine.length === 1 ? "" : "s"}
                  </Badge>
                  {progs.map((p) => (
                    <Badge key={p} tone="info">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>

              {mine.length > 0 && (
                <ul className="mt-4 divide-y divide-ink/5 rounded-xl border border-ink/10">
                  {mine.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <Link href={`/admin/cohorts/${l.cohort_id}`} className="font-bold hover:text-maroon">
                          {l.cohort!.name}
                        </Link>
                        <span className="text-xs text-ink/50">
                          {" "}
                          · {programName.get(l.cohort!.program_id)} · {formatDate(l.cohort!.start_date)} – {formatDate(l.cohort!.end_date)} · {l.role}
                        </span>
                      </span>
                      <ActionForm action={unassignInstructor} confirm={`Unassign ${i.name} from ${l.cohort!.name}?`}>
                        <input type="hidden" name="id" value={l.id} />
                        <SubmitButton size="sm" variant="ghost" className="text-ink/50" pendingText="…">
                          Unassign
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}

              {i.active && byProgram.length > 0 && (
                <ActionForm action={assignInstructor} className="mt-4 grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <input type="hidden" name="instructor_id" value={i.id} />
                  <div>
                    <Label htmlFor={`assign-${i.id}`}>Assign to a cohort</Label>
                    <Select id={`assign-${i.id}`} name="cohort_id" required defaultValue="">
                      <option value="" disabled>
                        Choose a cohort…
                      </option>
                      {byProgram.map((g) => (
                        <optgroup key={g.name} label={g.name}>
                          {g.cohorts.map((c) => (
                            <option key={c.id} value={c.id} disabled={mine.some((l) => l.cohort_id === c.id)}>
                              {c.name} ({formatDate(c.start_date)})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`role-${i.id}`}>Role in cohort</Label>
                    <Input id={`role-${i.id}`} name="role" maxLength={80} defaultValue={i.title} />
                  </div>
                  <SubmitButton size="sm" variant="outline" pendingText="Assigning…">
                    Assign
                  </SubmitButton>
                </ActionForm>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-bold text-maroon">Edit instructor</summary>
                <ActionForm action={saveInstructor} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InstructorFields i={i} />
                  <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                    <input type="checkbox" name="active" defaultChecked={i.active} className="h-4 w-4 accent-maroon" />
                    Active (can be assigned to new cohorts)
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton variant="dark" size="sm" pendingText="Saving…">
                      Save changes
                    </SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm
                  action={deleteInstructor}
                  className="mt-4 border-t border-ink/10 pt-4"
                  confirm={{
                    title: `Delete ${i.name}?`,
                    body: mine.length
                      ? `They're removed from the directory and unassigned from ${mine.length} cohort(s). To keep their history, mark them inactive instead.`
                      : "They're removed from the directory.",
                    confirmLabel: "Delete instructor",
                    tone: "danger",
                  }}
                >
                  <input type="hidden" name="id" value={i.id} />
                  <SubmitButton size="sm" variant="ghost" className="text-red-700" pendingText="Deleting…">
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete instructor
                  </SubmitButton>
                </ActionForm>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
