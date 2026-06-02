// Single source of truth for the owner-only feature gate.
// The AI Philosophy area is restricted to this email address.
export const OWNER_EMAIL = "8russelld7@gmail.com";

export const isOwner = (email?: string | null) =>
  !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();