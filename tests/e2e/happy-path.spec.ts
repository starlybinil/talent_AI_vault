import { expect, test, type Page } from "@playwright/test";
import path from "path";

/**
 * Full admissions happy path across roles:
 * register → apply → admin screens + invites → admin records pass → applicant ranks cohorts →
 * signs agreements → admin confirms → employer sees the candidate (policy-limited).
 */
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "";
const ADMIN = "admissions.demo@talent-vault.org";
const EMPLOYER = "employer.demo@talent-vault.org";
const stamp = Date.now();
const applicantEmail = `e2e.applicant+${stamp}@example.com`;
const applicantPassword = `E2e-${stamp}-pw!`;

test.skip(!PASSWORD, "Set E2E_DEMO_PASSWORD to the demo staff password");
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/");
}

async function adminOp(page: Page, applicationUrl: string, label: string) {
  await page.goto(applicationUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByText("Done — the applicant has been notified")).toBeVisible();
}

let applicationPath = "";

test("applicant registers from the ASU entry link and applies", async ({ page }) => {
  await page.goto("/apply/asu-tsmc?utm_source=asu");
  await expect(page).toHaveURL(/\/register/);
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email address").fill(applicantEmail);
  await page.getByLabel("Password").fill(applicantPassword);
  await page.getByRole("button", { name: "Create my account" }).click();
  // Projects with email confirmation ON stop here; turn it off for the test project or confirm via SQL.
  await page.waitForURL(/\/portal\/apply\/asu-tsmc/);

  await page.getByLabel("Phone number").fill("(602) 555-0199");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Highest diploma or degree earned").selectOption("bachelor");
  await page.getByLabel("Program major").fill("Electrical Engineering Technology");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Resume file").setInputFiles(path.join(__dirname, "../fixtures/resume.pdf"));
  await expect(page.getByText("Uploaded. Click to replace.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("No", { exact: true }).first().check();
  await page.getByLabel("Yes", { exact: true }).last().check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit application" }).click();

  await page.waitForURL(/\/portal\/applications\/[0-9a-f-]+/);
  await expect(page.getByText("Application submitted!")).toBeVisible();
  applicationPath = new URL(page.url()).pathname.replace("/portal/", "/admin/");
});

test("admissions screens, invites and records a passing assessment", async ({ page }) => {
  await signIn(page, ADMIN, PASSWORD);
  await adminOp(page, applicationPath, "Pass screening & send assessment");
  await adminOp(page, applicationPath, "Record: passed (TSMC verified)");
  await expect(page.getByText("Enrollment open").first()).toBeVisible();
  await signOut(page);
});

test("applicant enrolls: ranks cohorts, then signs every agreement on the same page", async ({ page }) => {
  await signIn(page, applicantEmail, applicantPassword);
  await page.goto(applicationPath.replace("/admin/", "/portal/") + "?tab=enrollment");
  const cards = page.locator("button[aria-pressed]");
  for (let i = 0; i < 3; i++) await cards.nth(i).click();
  await page.getByRole("button", { name: "Submit Choices" }).click();
  await expect(page.getByText("Your seat is reserved!")).toBeVisible();

  while ((await page.getByRole("button", { name: "Sign document" }).count()) > 0) {
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign document" }) }).first();
    await form.locator('input[name="agree"]').check();
    const canvas = form.locator("canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 });
    await page.mouse.move(box.x + 220, box.y + 80, { steps: 8 });
    await page.mouse.up();
    await form.getByRole("button", { name: "Sign document" }).click();
    await expect(form.getByText(/Signed\.|All agreements signed/)).toBeVisible();
    await page.reload();
  }
  await signOut(page);
});

test("admissions verifies and confirms; applicant sees Confirmed", async ({ page }) => {
  await signIn(page, ADMIN, PASSWORD);
  await adminOp(page, applicationPath, "Confirm Enrollment");
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await expect(page.getByText("You're confirmed — welcome")).toBeVisible(); // email log entry
  await signOut(page);

  await signIn(page, applicantEmail, applicantPassword);
  await page.goto(applicationPath.replace("/admin/", "/portal/"));
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await signOut(page);
});

test("employer partner sees the candidate with policy-limited fields", async ({ page }) => {
  await signIn(page, EMPLOYER, PASSWORD);
  await page.goto("/employer/candidates");
  await expect(page.getByRole("link", { name: /E2E/ })).toBeVisible();
  await expect(page.getByText("Visa sponsorship answer")).toHaveCount(0); // not in the default policy
  await expect(page.getByText("Phone")).toHaveCount(0);
});
