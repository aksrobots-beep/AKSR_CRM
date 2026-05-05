/**
 * Run task reminder sweep once (for cron).
 * cd backend && node src/scripts/task-reminder-sweep.js
 */
import '../load-env.js';
import { runTaskReminderSweep } from '../services/taskReminders.js';

runTaskReminderSweep()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
