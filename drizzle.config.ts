import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://trend_radar:trend_radar@localhost:5432/trend_radar",
  },
  strict: true,
  verbose: true,
});

