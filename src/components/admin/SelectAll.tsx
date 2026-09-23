"use client";

export function SelectAll({ name = "ids" }: { name?: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="h-4 w-4 accent-maroon"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((cb) => (cb.checked = e.currentTarget.checked));
      }}
    />
  );
}
