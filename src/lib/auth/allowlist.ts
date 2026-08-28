/**
 * Emails allowed to create a Cosecha account — Google, X, or email/password all
 * go through this same list via `databaseHooks.user.create.before` in
 * `server.ts`, so there is one place to update when Miguel adds someone.
 */
const ALLOWED_SIGNUP_EMAILS = new Set([
  "miguelarambulam@gmail.com",
  "samuel@pleinproduce.com",
  "juan@pleinproduce.com",
  "juanesmercado@gmail.com",
  "jose@pleinproduce.com",
]);

export function isAllowedSignupEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ALLOWED_SIGNUP_EMAILS.has(email!.trim().toLowerCase());
}
