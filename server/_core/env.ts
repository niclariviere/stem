export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Public origin used in magic-link URLs and SIWS messages.
  // Defaults to localhost for dev; override in production.
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  // Comma-separated list of emails that become admins on first login.
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
};
