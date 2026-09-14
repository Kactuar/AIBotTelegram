import dotenv from "dotenv";
import { restoreDatabaseBackup } from "@/src/server/database-backup";

dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
const [backup, destination] = process.argv.slice(2);
if (!backup || !destination) throw new Error("Usage: npm run db:restore -- <backup.sqlite> <new-database.sqlite>");
restoreDatabaseBackup(backup, destination).then(({ target, digest }) => console.info(`Restored and verified: ${target}\nSHA-256: ${digest}`));
