// One-time cleanup of stale project allocations left behind by the bulk Keka
// import (open-ended allocations to projects people long ago moved off of).
//
// Safe by default: running it with no flag only PREVIEWS what would change and
// writes nothing. Add --apply to actually write the end dates.
//
//   Preview (no changes):   npx tsx scripts/cleanup-stale-allocations.ts
//   Apply the cleanup:      npx tsx scripts/cleanup-stale-allocations.ts --apply
//
// "Stale" = an allocation with no end date, that started more than 30 days ago
// (so genuine new joiners are never touched), and whose employee has logged no
// time on that project in the last 30 days. Each is ended on the last day they
// actually logged (or its start date if they never logged), which frees their
// utilization and drops the project from their current timesheet -- while
// leaving the weeks they really worked it intact.

import { getStaleAllocationsPreview, applyStaleAllocationCleanup } from "@/lib/stale-allocations";
import { STALE_ALLOCATION_DAYS } from "@/lib/allocation";
import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const preview = await getStaleAllocationsPreview();

  if (preview.length === 0) {
    console.log("No stale allocations found. Nothing to clean up.");
    return;
  }

  console.log(
    `Found ${preview.length} stale allocation(s) (open-ended, started >${STALE_ALLOCATION_DAYS}d ago, no entries in last ${STALE_ALLOCATION_DAYS}d):\n`
  );
  console.log(
    "Employee".padEnd(24) +
      "Project".padEnd(30) +
      "%".padEnd(5) +
      "Started".padEnd(13) +
      "Last logged".padEnd(14) +
      "Will end on"
  );
  console.log("-".repeat(100));
  for (const s of preview) {
    console.log(
      s.employeeName.slice(0, 22).padEnd(24) +
        s.projectName.slice(0, 28).padEnd(30) +
        `${s.allocationPercentage}%`.padEnd(5) +
        s.startDate.padEnd(13) +
        (s.lastLogged ?? "never").padEnd(14) +
        s.proposedEndDate
    );
  }

  const affectedEmployees = new Set(preview.map((s) => s.employeeName)).size;
  console.log(
    `\nSummary: ${preview.length} allocation(s) across ${affectedEmployees} employee(s) would be closed.`
  );

  if (!apply) {
    console.log("\nThis was a PREVIEW -- nothing was changed. Re-run with --apply to write these end dates.");
    return;
  }

  console.log("\nApplying...");
  const ended = await applyStaleAllocationCleanup();
  console.log(`Done. Ended ${ended} allocation(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
