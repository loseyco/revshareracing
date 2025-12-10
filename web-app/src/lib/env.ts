import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional()
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required on the server")
});

const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
};

const parsedClient = clientSchema.safeParse(rawClientEnv);

if (!parsedClient.success) {
  throw new Error(
    [
      "Missing Supabase configuration.",
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set (or SUPABASE_URL/SUPABASE_ANON_KEY).",
      "Create web-app/.env.local with:",
      "  NEXT_PUBLIC_SUPABASE_URL=...",
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY=...",
      "  SUPABASE_SERVICE_ROLE_KEY=...",
      "",
      `Validation details: ${JSON.stringify(parsedClient.error.format())}`
    ].join("\n")
  );
}

export const clientEnv = parsedClient.data;

// Only validate server env on server-side (during SSR or API routes)
const rawServerEnv = {
  ...clientEnv,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// Only validate if we're on the server (not in browser)
const shouldValidateServer = typeof window === "undefined";

const parsedServer = shouldValidateServer
  ? serverSchema.safeParse(rawServerEnv)
  : { success: true as const, data: rawServerEnv as z.infer<typeof serverSchema> };

if (shouldValidateServer && !parsedServer.success) {
  throw new Error(
    [
      "Missing Supabase server configuration.",
      "SUPABASE_SERVICE_ROLE_KEY must be set in .env.local for server-side operations.",
      `Validation details: ${JSON.stringify(parsedServer.error.format())}`
    ].join("\n")
  );
}

// TypeScript: parsedServer.data is always defined here because:
// 1. If shouldValidateServer is false, we return { success: true, data: ... }
// 2. If shouldValidateServer is true and validation fails, we throw above
// 3. If shouldValidateServer is true and validation succeeds, data is defined
export const serverEnv = parsedServer.success 
  ? parsedServer.data 
  : (() => { throw new Error("Server env validation failed"); })();

