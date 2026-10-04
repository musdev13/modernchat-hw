import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Прострочені історії ховаються одразу (фільтр за expiresAt); тут вони остаточно прибираються разом із файлами.
crons.interval("cleanup expired stories", { minutes: 30 }, internal.stories.cleanupExpired, {});

export default crons;
