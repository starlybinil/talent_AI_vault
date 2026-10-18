/** Application questions from the ET Program Admissions Process deck (shared by the form, admin views and exports). */

export const WORK_EXPERIENCE = ["0_5", "6_10", "10_plus"] as const;
export const WORK_EXPERIENCE_LABEL: Record<string, string> = {
  "0_5": "0–5 years",
  "6_10": "6–10 years",
  "10_plus": "More than 10 years",
};

export const CLEANROOM_OPTIONS = ["yes", "no", "unsure"] as const;
export const CLEANROOM_LABEL: Record<string, string> = { yes: "Yes", no: "No", unsure: "Unsure" };

/** Education choices offered on the form, in the deck's order. Older answers (some college, certificate) still display. */
export const FORM_EDUCATION = ["no_hs", "hs_ged", "associate", "bachelor", "master_plus"] as const;

/** Employer role & pay questions, per program. Programs without an entry skip that step. */
export type RoleFit = {
  employer: string;
  role: string;
  description: string;
  payRange: string;
  payNote: string;
};

export const ROLE_FIT: Record<string, RoleFit> = {
  "asu-tsmc": {
    employer: "TSMC Arizona",
    role: "Equipment Technician",
    description:
      "Equipment Technicians support the equipment used to manufacture semiconductor chips. The role includes troubleshooting and repairing equipment, performing preventative maintenance, following safety and quality procedures, and supporting continuous manufacturing operations. Equipment Technicians work in a cleanroom (“Fab”) environment for extended periods and are required to wear cleanroom protective attire (“bunny suit”).",
    payRange: "$25–$30 per hour plus benefits",
    payNote: "Compensation is determined by TSMC Arizona and is subject to change.",
  },
};

/** Statements the applicant certifies when submitting. */
export function acknowledgements(programName: string, fit: RoleFit | undefined, employerPartner?: string | null): string[] {
  const employer = fit?.employer ?? employerPartner ?? "the employer partner";
  const role = fit?.role ?? "technician";
  const partners = fit ? `${fit.employer.replace(/ Arizona$/, "")} and partners` : `${employer} and program partners`;
  return [
    "I certify that the information provided in this application is true and accurate to the best of my knowledge.",
    `I understand the expectations of the ${programName} and the ${employer} ${role} employment opportunity.`,
    `I understand that ${partners} will have access to my program performance, including attendance and assessment results, for evaluation purposes during the program.`,
    `I understand that successful completion of the program and assessments are required to be eligible for a ${employer} interview for an ${role} role.`,
    "I understand that submitting this application and meeting minimum eligibility requirements do not guarantee admission into the program.",
    `I understand that completion of the program does not guarantee employment with ${employer}.`,
  ];
}

export const yesNo = (v: boolean | null | undefined) => (v === true ? "Yes" : v === false ? "No" : "—");

type AnswerSource = {
  will_be_18_by_completion: boolean | null;
  work_authorized?: boolean | null;
  visa_sponsorship: string | null;
  work_experience?: string | null;
  highest_education: string | null;
  major?: string | null;
  stem_degree_completed?: boolean | null;
  stem_degree_enrolled?: boolean | null;
  role_interest?: boolean | null;
  cleanroom_willing?: string | null;
  shift_willing?: boolean | null;
  pay_range_accepted?: boolean | null;
  acknowledged_at?: string | null;
};

/** The applicant's answers as [label, value] rows, in form order. Role & pay rows appear only when answered. */
export function answerRows(a: AnswerSource, labels: { education: Record<string, string>; visa: Record<string, string> }): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["18+ by end of program", yesNo(a.will_be_18_by_completion)],
    ["Authorized to work in the U.S.", yesNo(a.work_authorized)],
    ["Will require visa sponsorship", a.visa_sponsorship ? labels.visa[a.visa_sponsorship] ?? a.visa_sponsorship : "—"],
    ["Work experience", a.work_experience ? WORK_EXPERIENCE_LABEL[a.work_experience] ?? a.work_experience : "—"],
    ["Highest education", a.highest_education ? labels.education[a.highest_education] ?? a.highest_education : "—"],
    ["STEM bachelor’s or higher completed", yesNo(a.stem_degree_completed)],
    ["Enrolled in a STEM bachelor’s or higher", yesNo(a.stem_degree_enrolled)],
  ];
  if (a.major) rows.push(["Major (earlier form)", a.major]);
  if (a.role_interest != null || a.cleanroom_willing || a.shift_willing != null || a.pay_range_accepted != null) {
    rows.push(
      ["Interested in the role", yesNo(a.role_interest)],
      ["Willing to work in a cleanroom", a.cleanroom_willing ? CLEANROOM_LABEL[a.cleanroom_willing] : "—"],
      ["Available for required shifts", yesNo(a.shift_willing)],
      ["Accepts the pay range", yesNo(a.pay_range_accepted)],
    );
  }
  return rows;
}

/** Eligibility answers admissions should look at closely (shown as a warning, never auto-rejected). */
export function eligibilityFlags(a: AnswerSource): string[] {
  const flags: string[] = [];
  if (a.will_be_18_by_completion === false) flags.push("will not be 18 by the end of the program");
  if (a.work_authorized === false) flags.push("is not currently authorized to work in the U.S.");
  if (a.visa_sponsorship === "now" || a.visa_sponsorship === "future") flags.push("will require visa sponsorship");
  if (a.highest_education === "no_hs") flags.push("does not have a high school diploma or GED");
  return flags;
}
