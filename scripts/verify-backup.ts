import dotenv from "dotenv";
import { verifyDatabaseBackup } from "@/src/server/database-backup";

dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run db:verify-backup -- <backup.sqlite>");
verifyDatabaseBackup(filename).then(({ target, digest }) => console.info(`Backup verified: ${target}\nSHA-256: ${digest}`));
