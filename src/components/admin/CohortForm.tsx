import { saveCohort } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input, Label, Select } from "@/components/ui";

type Cohort = {
  id?: string;
  program_id?: string;
  name?: string;
  format?: string;
  start_date?: string;
  end_date?: string;
  schedule?: string;
  location?: string;
  address?: string | null;
  capacity?: number;
  status?: string;
};

export function CohortForm({ cohort, programs, formats }: { cohort?: Cohort; programs: Array<{ id: string; short_name: string }>; formats: string[] }) {
  const c = cohort ?? {};
  return (
    <ActionForm action={saveCohort} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" resetOnSuccess={!c.id}>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="lg:col-span-2">
        <Label htmlFor={`name-${c.id ?? "new"}`}>Cohort name</Label>
        <Input id={`name-${c.id ?? "new"}`} name="name" defaultValue={c.name} required placeholder="Accelerator · Mar 2027" />
      </div>
      <div>
        <Label>Program</Label>
        <Select name="program_id" defaultValue={c.program_id ?? programs[0]?.id} required>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short_name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Format</Label>
        <Input name="format" list="formats" defaultValue={c.format} required placeholder="5-Week Accelerator" />
        <datalist id="formats">
          {formats.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>
      <div>
        <Label>Start date</Label>
        <Input name="start_date" type="date" defaultValue={c.start_date} required />
      </div>
      <div>
        <Label>End date</Label>
        <Input name="end_date" type="date" defaultValue={c.end_date} required />
      </div>
      <div className="lg:col-span-2">
        <Label>Days & times</Label>
        <Input name="schedule" defaultValue={c.schedule} required placeholder="Mon–Fri · 8:00 AM – 4:30 PM" />
      </div>
      <div>
        <Label>Location</Label>
        <Input name="location" defaultValue={c.location} required placeholder="Tempe" />
      </div>
      <div className="lg:col-span-2">
        <Label>Address</Label>
        <Input name="address" defaultValue={c.address ?? ""} placeholder="Street, city" />
      </div>
      <div>
        <Label>Capacity</Label>
        <Input name="capacity" type="number" min={0} max={1000} defaultValue={c.capacity ?? 24} required />
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={c.status ?? "open"}>
          <option value="open">Open</option>
          <option value="closed">Closed (hidden from selection)</option>
          <option value="archived">Archived</option>
        </Select>
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <SubmitButton variant="dark" pendingText="Saving…">{c.id ? "Save changes" : "Create cohort"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
