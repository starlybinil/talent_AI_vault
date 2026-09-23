"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input, Label } from "@/components/ui";
import { deleteAccount } from "@/app/portal/actions";

export function DeleteAccountForm({ email, hasSeat }: { email: string; hasSeat: boolean }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <ActionForm
      action={deleteAccount}
      confirm={{
        title: "Permanently delete your Talent-Vault account?",
        body: "This can't be undone. If you want to join a program later, you'll need to create a new account and apply again.",
        points: [
          ...(hasSeat ? ["Your cohort seat is released and offered to the next person on the waitlist."] : []),
          "Your applications, status history and messages with admissions are erased.",
          "Your resume, signatures and signed agreement PDFs are deleted from storage.",
          "You're signed out and can no longer sign in with this email.",
        ],
        confirmLabel: "Yes, delete everything",
        cancelLabel: "Keep my account",
        tone: "danger",
      }}
    >
      <Label htmlFor="confirm_email">
        To confirm, type your email address: <span className="font-black text-ink">{email}</span>
      </Label>
      <Input
        id="confirm_email"
        name="confirm_email"
        type="email"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={email}
        className="mt-2"
      />
      <SubmitButton variant="danger" className="mt-4" disabled={!matches} pendingText="Deleting your account…">
        <Trash2 className="h-4 w-4" aria-hidden /> Delete my account
      </SubmitButton>
    </ActionForm>
  );
}
