import dotenv from "dotenv";
import { migrateDatabase } from "@/src/server/database";

dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
migrateDatabase();
console.info("Database migrations are up to date.");
