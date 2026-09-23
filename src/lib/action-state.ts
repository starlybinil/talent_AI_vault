export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

export const ok = (message?: string): ActionState => ({ ok: true, message });
export const fail = (error: string): ActionState => ({ ok: false, error });
