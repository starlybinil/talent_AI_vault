"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication } from "@/app/portal/actions";
import { Alert, Button, FieldError, Input, Label, Select } from "@/components/ui";
import { EDUCATION_LABEL } from "@/lib/workflow";
import { applicationSchema, validateResume } from "@/lib/validation";
import {
  CLEANROOM_LABEL,
  CLEANROOM_OPTIONS,
  FORM_EDUCATION,
  ROLE_FIT,
  WORK_EXPERIENCE,
  WORK_EXPERIENCE_LABEL,
  acknowledgements,
} from "@/lib/application-questions";
import { cn } from "@/lib/utils";

type Values = {
  first_name: string;
  last_name: string;
  phone: string;
  highest_education: string;
  will_be_18_by_completion: string;
  work_authorized: string;
  visa_sponsorship: string;
  work_experience: string;
  stem_degree_completed: string;
  stem_degree_enrolled: string;
  role_interest: string;
  cleanroom_willing: string;
  shift_willing: string;
  pay_range_accepted: string;
  share_with_employers: boolean;
  acknowledged: boolean;
  resume_path: string;
};

type Step = { key: string; title: string; fields: readonly string[] };

const ALL_STEPS: Step[] = [
  { key: "about", title: "About you", fields: ["first_name", "last_name", "phone"] },
  { key: "eligibility", title: "Eligibility", fields: ["will_be_18_by_completion", "work_authorized", "visa_sponsorship", "work_experience"] },
  { key: "education", title: "Education", fields: ["highest_education", "stem_degree_completed", "stem_degree_enrolled"] },
  { key: "role", title: "Role & pay", fields: ["role_interest", "cleanroom_willing", "shift_willing", "pay_range_accepted"] },
  { key: "resume", title: "Resume", fields: ["resume_path"] },
  { key: "review", title: "Review & acknowledge", fields: ["acknowledged"] },
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const YES_NO_UNSURE = [...YES_NO, { value: "unsure", label: "Unsure" }];

export function ApplicationForm({
  programSlug,
  programName,
  employerPartner,
  learnMoreUrl,
  userId,
  email,
  defaults,
}: {
  programSlug: string;
  programName: string;
  employerPartner?: string | null;
  learnMoreUrl?: string | null;
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
    will_be_18_by_completion: "",
    work_authorized: "",
    visa_sponsorship: "",
    work_experience: "",
    stem_degree_completed: "",
    stem_degree_enrolled: "",
    role_interest: "",
    cleanroom_willing: "",
    shift_willing: "",
    pay_range_accepted: "",
    share_with_employers: true,
    acknowledged: false,
    resume_path: "",
  });
  const fit = ROLE_FIT[programSlug];
  const STEPS = React.useMemo(() => ALL_STEPS.filter((st) => st.key !== "role" || fit), [fit]);
  const stepKey = STEPS[step].key;
  const statements = acknowledgements(programName, fit, employerPartner);
  const [resumeName, setResumeName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  // Optional role answers are sent only when this program asks them.
  const payload = () => {
    const v: Record<string, unknown> = { ...values, program_slug: programSlug };
    if (!fit) for (const k of ["role_interest", "cleanroom_willing", "shift_willing", "pay_range_accepted"]) delete v[k];
    return v;
  };
  const choice = (k: keyof Values, label: React.ReactNode, options: ReadonlyArray<{ value: string; label: string }>, cols = 2) => (
    <fieldset>
      <legend className="text-sm font-bold text-ink">{label}</legend>
      <div className={cn("mt-3 grid gap-2", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((o) => (
          <RadioCard key={o.value} name={k} checked={values[k] === o.value} onChange={() => set(k, o.value as never)} label={o.label} />
        ))}
      </div>
      <FieldError>{errors[k]}</FieldError>
    </fieldset>
  );

  function validateStep(i: number): boolean {
    const parsed = applicationSchema.safeParse(payload());
    if (parsed.success) return true;
    const fields = STEPS[i].fields;
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
    const res = await submitApplication(payload());
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
            {stepKey === "about" && (
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

            {stepKey === "eligibility" && (
              <div className="grid gap-8">
                {choice("will_be_18_by_completion", "Will you be at least 18 years of age by the end of the program?", YES_NO)}
                <div className="grid gap-2">
                  <p className="rounded-xl bg-mist px-4 py-3 text-sm text-ink/70">
                    <strong>Work authorization</strong> means having current legal permission to work in the United States.
                  </p>
                  {choice("work_authorized", "Are you currently authorized to work in the United States?", YES_NO)}
                </div>
                {choice("visa_sponsorship", "Will you require visa sponsorship to work in the United States in the future?", [
                  { value: "future", label: "Yes" },
                  { value: "no", label: "No" },
                ])}
                {choice(
                  "work_experience",
                  "How many years of professional work experience do you have?",
                  WORK_EXPERIENCE.map((w) => ({ value: w, label: WORK_EXPERIENCE_LABEL[w] })),
                  3,
                )}
              </div>
            )}

            {stepKey === "education" && (
              <div className="grid gap-8">
                <div>
                  <Label htmlFor="highest_education">What is the highest level of education you have completed?</Label>
                  <Select
                    id="highest_education"
                    value={values.highest_education}
                    onChange={(e) => set("highest_education", e.target.value)}
                    aria-invalid={!!errors.highest_education}
                  >
                    <option value="">Select one…</option>
                    {FORM_EDUCATION.map((l) => (
                      <option key={l} value={l}>
                        {EDUCATION_LABEL[l]}
                      </option>
                    ))}
                  </Select>
                  <FieldError>{errors.highest_education}</FieldError>
                </div>
                {choice("stem_degree_completed", "Have you completed a bachelor’s degree or higher in a STEM field?", YES_NO_UNSURE, 3)}
                {choice("stem_degree_enrolled", "Are you currently enrolled in a bachelor’s degree or higher program in a STEM field?", YES_NO_UNSURE, 3)}
                <p className="-mt-4 text-xs text-ink/50">STEM means science, technology, engineering or math (for example engineering, computer science, physics, chemistry, biology or mathematics). Not sure? Choose Unsure.</p>
              </div>
            )}

            {stepKey === "role" && fit && (
              <div className="grid gap-8">
                <div className="rounded-2xl border border-gold/60 bg-gold/5 p-5 text-sm leading-relaxed text-ink/80">
                  <p className="text-xs font-bold uppercase tracking-widest text-maroon">
                    {fit.employer} {fit.role} role &amp; pay
                  </p>
                  <p className="mt-2">{fit.description}</p>
                  {learnMoreUrl && (
                    <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-maroon hover:underline">
                      Learn more <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
                {choice("role_interest", `Based on the description above, are you interested in pursuing employment as an ${fit.role} with ${fit.employer}?`, YES_NO)}
                {choice(
                  "cleanroom_willing",
                  "Are you willing to work in a cleanroom environment for extended periods while wearing required cleanroom protective attire?",
                  CLEANROOM_OPTIONS.map((c) => ({ value: c, label: CLEANROOM_LABEL[c] })),
                  3,
                )}
                {choice(
                  "shift_willing",
                  `Are you willing and available to work the shift schedules required for the ${fit.employer} ${fit.role} position, which may include extended, overnight, and weekend shifts?`,
                  YES_NO,
                )}
                {choice(
                  "pay_range_accepted",
                  <>
                    {fit.employer.replace(/ Arizona$/, "")} {fit.role} positions are currently anticipated to pay {fit.payRange}. If offered employment, would you be willing to
                    accept a position within this pay range?
                    <span className="mt-1 block text-xs font-normal text-ink/50">{fit.payNote}</span>
                  </>,
                  YES_NO,
                )}
              </div>
            )}

            {stepKey === "resume" && (
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

            {stepKey === "review" && (
              <div className="grid gap-6">
                <dl className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
                  {[
                    ["Name", `${values.first_name} ${values.last_name}`],
                    ["Email", email],
                    ["Phone", values.phone],
                    ["18+ by end of program", answer(values.will_be_18_by_completion)],
                    ["Authorized to work in the U.S.", answer(values.work_authorized)],
                    ["Will require visa sponsorship", values.visa_sponsorship === "future" ? "Yes" : answer(values.visa_sponsorship)],
                    ["Work experience", WORK_EXPERIENCE_LABEL[values.work_experience] ?? "—"],
                    ["Highest education", EDUCATION_LABEL[values.highest_education] ?? "—"],
                    ["STEM bachelor’s or higher completed", CLEANROOM_LABEL[values.stem_degree_completed] ?? "—"],
                    ["Enrolled in a STEM bachelor’s or higher", CLEANROOM_LABEL[values.stem_degree_enrolled] ?? "—"],
                    ...(fit
                      ? [
                          [`Interested in the ${fit.role} role`, answer(values.role_interest)],
                          ["Willing to work in a cleanroom", CLEANROOM_LABEL[values.cleanroom_willing] ?? "—"],
                          ["Available for required shifts", answer(values.shift_willing)],
                          ["Accepts the pay range", answer(values.pay_range_accepted)],
                        ]
                      : []),
                    ["Resume", resumeName ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[50%_1fr] gap-4 px-5 py-3 text-sm">
                      <dt className="font-bold text-ink/60">{k}</dt>
                      <dd className="break-words font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>

                <label className="flex items-start gap-3 rounded-2xl bg-mist p-4 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-maroon"
                    checked={values.share_with_employers}
                    onChange={(e) => set("share_with_employers", e.target.checked)}
                  />
                  <span>
                    <strong>Share my application with partner employers.</strong> I agree that this program&apos;s partners{employerPartner ? ` (such as ${employerPartner})` : ""}{" "}
                    may view selected details of my application, like my name, education, admissions progress and resume, to consider me
                    for employment. You can ask admissions to withdraw this consent at any time.
                  </span>
                </label>

                <div className={cn("rounded-2xl border p-5", errors.acknowledged ? "border-red-300 bg-red-50/50" : "border-ink/15")}>
                  <p className="font-black text-ink">Application acknowledgement</p>
                  <p className="mt-1 text-sm text-ink/70">By submitting this application, I acknowledge that:</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/80">
                    {statements.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <label className="mt-4 flex items-center gap-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-maroon"
                      checked={values.acknowledged}
                      onChange={(e) => set("acknowledged", e.target.checked)}
                      aria-invalid={!!errors.acknowledged}
                    />
                    I certify and acknowledge the statements above.
                  </label>
                  <FieldError>{errors.acknowledged}</FieldError>
                </div>
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

function answer(v: string): string {
  return v === "yes" ? "Yes" : v === "no" ? "No" : "—";
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
