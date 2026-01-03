import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_IRCOMMANDER_URL: z.string().url().optional()
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required on the server"),
  JWT_SECRET: z.string().min(32).optional()
});

const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_IRCOMMANDER_URL: process.env.NEXT_PUBLIC_IRCOMMANDER_URL ?? "https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app"
};

const parsedClient = clientSchema.safeParse(rawClientEnv);

if (!parsedClient.success) {
  throw new Error(
    [
      "Missing Supabase configuration.",
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
      "Create gridpass-app/.env.local with:",
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
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// Only validate if we're on the server (not in browser)
const shouldValidateServer = typeof window === "undefined";

const parsedServer = shouldValidateServer
  ? serverSchema.safeParse(rawServerEnv)
  : { success: true as const, data: rawServerEnv as z.infer<typeof serverSchema> };

if (shouldValidateServer && !parsedServer.success) {
  const errorDetails = parsedServer.error.format();
  const missingServiceKey = errorDetails.SUPABASE_SERVICE_ROLE_KEY;
  
  if (missingServiceKey) {
    throw new Error(
      [
        "Missing Supabase Service Role Key.",
        "SUPABASE_SERVICE_ROLE_KEY must be set in .env.local for server-side operations.",
        "",
        "To fix:",
        "1. Go to: https://supabase.com/dashboard/project/wonlunpmgsnxctvgozva/settings/api",
        "2. Copy the 'service_role' key (secret)",
        "3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your_key_here",
        "4. Restart the dev server",
        "",
        `Validation details: ${JSON.stringify(errorDetails)}`
      ].join("\n")
    );
  }
  
  throw new Error(
    [
      "Missing GridPass server configuration.",
      "SUPABASE_SERVICE_ROLE_KEY must be set in .env.local for server-side operations.",
      `Validation details: ${JSON.stringify(errorDetails)}`
    ].join("\n")
  );
}

export const serverEnv = parsedServer.success 
  ? parsedServer.data 
  : (() => { throw new Error("Server env validation failed"); })();

