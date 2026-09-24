"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication } from "@/app/portal/actions";
import { Alert, Button, FieldError, Input, Label, Select } from "@/components/ui";
import { DEGREE_LEVELS, EDUCATION_LABEL, VISA_LABEL } from "@/lib/workflow";
import { EDUCATION_LEVELS, VISA_OPTIONS, applicationSchema, validateResume } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Values = {
  first_name: string;
  last_name: string;
  phone: string;
  highest_education: string;
  major: string;
  visa_sponsorship: string;
  will_be_18_by_completion: string;
  share_with_employers: boolean;
  resume_path: string;
};

const STEPS = [
  { key: "about", title: "About you", fields: ["first_name", "last_name", "phone"] },
  { key: "education", title: "Education", fields: ["highest_education", "major"] },
  { key: "resume", title: "Resume", fields: ["resume_path"] },
  { key: "eligibility", title: "Eligibility", fields: ["visa_sponsorship", "will_be_18_by_completion"] },
  { key: "review", title: "Review & submit", fields: [] },
] as const;

export function ApplicationForm({
  programSlug,
  programName,
  employerPartner,
  userId,
  email,
  defaults,
}: {
  programSlug: string;
  programName: string;
  employerPartner?: string | null;
  userId: string;
  email: string;
  defaults: Partial<Values>;
}) {
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [values, setValues] = React.useState<Values>({
    first_name: defaults.first_name ?? "",
    last_name: defaults.last_name ?? "",
    phone: defaults.phone ?? "",
    highest_education: "",
    major: "",
    visa_sponsorship: "",
    will_be_18_by_completion: "",
    share_with_employers: true,
    resume_path: "",
  });
  const [resumeName, setResumeName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const needsMajor = (DEGREE_LEVELS as readonly string[]).includes(values.highest_education);

  function validateStep(i: number): boolean {
    const parsed = applicationSchema.safeParse({ ...values, program_slug: programSlug });
    if (parsed.success) return true;
    const fields = STEPS[i].fields as readonly string[];
    const errs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if ((fields.length === 0 || fields.includes(k)) && !errs[k]) errs[k] = issue.message;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function go(delta: number) {
    if (delta > 0 && !validateStep(step)) return;
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onResume(file: File | undefined) {
    if (!file) return;
    const problem = validateResume(file);
    if (problem) {
      setErrors((e) => ({ ...e, resume_path: problem }));
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z]/g, "");
    const path = `${userId}/resumes/${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from("applicant-files").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    setUploading(false);
    if (error) {
      setErrors((e) => ({ ...e, resume_path: `Upload failed: ${error.message}` }));
      return;
    }
    setResumeName(file.name);
    set("resume_path", path);
  }

  async function onSubmit() {
    if (!validateStep(STEPS.length - 1)) {
      setFormError("Some answers need attention — go back and check the highlighted fields.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await submitApplication({ ...values, program_slug: programSlug });
    // On success the server action redirects; we only get here on error.
    setSubmitting(false);
    if (res?.error) {
      setFormError(res.error);
      if (res.fieldErrors) setErrors(res.fieldErrors);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-xl">
      <div className="bg-ink px-6 py-6 text-white sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Application · {programName}</p>
        <div className="mt-4 flex gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full bg-gold"
                initial={false}
                animate={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }}
                transition={{ duration: 0.4 }}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/70">
          Step {step + 1} of {STEPS.length} · <span className="font-bold text-white">{STEPS[step].title}</span>
        </p>
      </div>

      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" value={values.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" aria-invalid={!!errors.first_name} />
                  <FieldError>{errors.first_name}</FieldError>
                </div>
                <div>
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" value={values.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" aria-invalid={!!errors.last_name} />
                  <FieldError>{errors.last_name}</FieldError>
                </div>
                <div>
                  <Label htmlFor="phone">Phone number</Label>
                  <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="(602) 555-0123" aria-invalid={!!errors.phone} />
                  <FieldError>{errors.phone}</FieldError>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={email} disabled />
                  <p className="mt-1.5 text-xs text-ink/50">From your account — we&apos;ll send every update here.</p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-5">
                <div>
                  <Label htmlFor="highest_education">Highest diploma or degree earned</Label>
                  <Select
                    id="highest_education"
                    value={values.highest_education}
                    onChange={(e) => set("highest_education", e.target.value)}
                    aria-invalid={!!errors.highest_education}
                  >
                    <option value="">Select one…</option>
                    {EDUCATION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {EDUCATION_LABEL[l]}
                      </option>
                    ))}
                  </Select>
                  <FieldError>{errors.highest_education}</FieldError>
                </div>
                <AnimatePresence>
                  {needsMajor && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <Label htmlFor="major">Program major</Label>
                      <Input id="major" value={values.major} onChange={(e) => set("major", e.target.value)} placeholder="e.g. Electrical Engineering Technology" aria-invalid={!!errors.major} />
                      <FieldError>{errors.major}</FieldError>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {step === 2 && (
              <div>
                <Label>Upload your resume</Label>
                <p className="mt-1 text-sm text-ink/60">PDF or Word document, up to 5 MB. No resume? A simple list of your work and school history is fine.</p>
                <label
                  className={cn(
                    "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
                    values.resume_path ? "border-emerald-400 bg-emerald-50" : "border-ink/20 hover:border-maroon hover:bg-mist",
                  )}
                >
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => onResume(e.target.files?.[0])}
                    aria-label="Resume file"
                  />
                  {uploading ? (
                    <Loader2 className="h-10 w-10 animate-spin text-maroon" />
                  ) : values.resume_path ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                      <p className="mt-3 flex items-center gap-2 font-bold text-ink">
                        <FileText className="h-4 w-4" /> {resumeName}
                      </p>
                      <p className="mt-1 text-sm text-ink/60">Uploaded. Click to replace.</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-maroon" />
                      <p className="mt-3 font-bold text-ink">Click to choose a file</p>
                      <p className="mt-1 text-sm text-ink/60">PDF, DOC or DOCX</p>
                    </>
                  )}
                </label>
                <FieldError>{errors.resume_path}</FieldError>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-8">
                <fieldset>
                  <legend className="text-sm font-bold text-ink">
                    Do you require visa sponsorship now or in the future to be employed {employerPartner ? `at ${employerPartner}` : "by this program\u2019s employer partner"}?
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {VISA_OPTIONS.map((o) => (
                      <RadioCard key={o} name="visa" checked={values.visa_sponsorship === o} onChange={() => set("visa_sponsorship", o)} label={VISA_LABEL[o]} />
                    ))}
                  </div>
                  <FieldError>{errors.visa_sponsorship}</FieldError>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-bold text-ink">Will you be 18 years or older by the time you complete the program?</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <RadioCard name="age" checked={values.will_be_18_by_completion === "yes"} onChange={() => set("will_be_18_by_completion", "yes")} label="Yes" />
                    <RadioCard name="age" checked={values.will_be_18_by_completion === "no"} onChange={() => set("will_be_18_by_completion", "no")} label="No" />
                  </div>
                  <FieldError>{errors.will_be_18_by_completion}</FieldError>
                </fieldset>
                <label className="flex items-start gap-3 rounded-2xl bg-mist p-4 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 accent-maroon"
                    checked={values.share_with_employers}
                    onChange={(e) => set("share_with_employers", e.target.checked)}
                  />
                  <span>
                    <strong>Share my application with partner employers.</strong> I agree that this program&apos;s partners{employerPartner ? ` (such as ${employerPartner})` : ""}
                    may view selected details of my application — like my name, education, admissions progress and resume — to consider me
                    for employment. You can ask admissions to withdraw this consent at any time.
                  </span>
                </label>
              </div>
            )}

            {step === 4 && (
              <div>
                <dl className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
                  {[
                    ["Name", `${values.first_name} ${values.last_name}`],
                    ["Email", email],
                    ["Phone", values.phone],
                    ["Highest diploma/degree", EDUCATION_LABEL[values.highest_education] ?? "—"],
                    ...(needsMajor ? [["Major", values.major]] : []),
                    ["Resume", resumeName ?? "—"],
                    ["Visa sponsorship", VISA_LABEL[values.visa_sponsorship] ?? "—"],
                    ["18+ by completion", values.will_be_18_by_completion === "yes" ? "Yes" : values.will_be_18_by_completion === "no" ? "No" : "—"],
                    ["Share with employers", values.share_with_employers ? "Yes" : "No"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[40%_1fr] gap-4 px-5 py-3 text-sm">
                      <dt className="font-bold text-ink/60">{k}</dt>
                      <dd className="break-words font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-ink/60">
                  By submitting, you confirm the information is accurate. You&apos;ll get a confirmation email and can track your status in
                  the portal.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {formError && (
          <Alert tone="danger" className="mt-6">
            {formError}
          </Alert>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0 || submitting} type="button">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(1)} type="button" disabled={uploading} size="lg">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onSubmit} type="button" disabled={submitting} size="lg">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit application
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RadioCard({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 font-bold transition",
        checked ? "border-maroon bg-maroon/5 text-maroon ring-2 ring-maroon/20" : "border-ink/15 hover:border-ink/40",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-maroon" />
      {label}
    </label>
  );
}
