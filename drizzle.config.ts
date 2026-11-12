import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: ["./drizzle/schema.ts", "./drizzle/catalog-schema.ts", "./drizzle/commerce-schema.ts", "./drizzle/finance-schema.ts", "./drizzle/verification-schema.ts", "./drizzle/showcase-schema.ts", "./drizzle/servicepub-schema.ts", "./drizzle/branding-schema.ts", "./drizzle/reviews-schema.ts", "./drizzle/storelink-schema.ts"],
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
