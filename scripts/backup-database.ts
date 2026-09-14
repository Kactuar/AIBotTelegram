import dotenv from "dotenv";
import { backupDatabase } from "@/src/server/database-backup";

dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
const destination = process.argv[2];
if (!destination) throw new Error("Usage: npm run db:backup -- <new-backup.sqlite>");
backupDatabase(destination).then(({ target, digest }) => console.info(`Backup created: ${target}\nSHA-256: ${digest}`));
