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

import {
  getStaleAllocationsPreview,
  applyStaleAllocationCleanup,
  getLateEndedAllocationsPreview,
  applyLateEndedCorrection,
} from "@/lib/stale-allocations";
import { STALE_ALLOCATION_DAYS } from "@/lib/allocation";
import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const stale = await getStaleAllocationsPreview();
  const lateEnded = await getLateEndedAllocationsPreview();

  // --- Part 1: open-ended allocations gone stale ---
  if (stale.length === 0) {
    console.log("Part 1 - Open stale allocations: none found.\n");
  } else {
    console.log(
      `Part 1 - ${stale.length} OPEN stale allocation(s) (started >${STALE_ALLOCATION_DAYS}d ago, no entries in last ${STALE_ALLOCATION_DAYS}d) -> will be closed:\n`
    );
    console.log(
      "Employee".padEnd(24) + "Project".padEnd(30) + "%".padEnd(5) + "Started".padEnd(13) + "Last logged".padEnd(14) + "Will end on"
    );
    console.log("-".repeat(100));
    for (const s of stale) {
      console.log(
        s.employeeName.slice(0, 22).padEnd(24) +
          s.projectName.slice(0, 28).padEnd(30) +
          `${s.allocationPercentage}%`.padEnd(5) +
          s.startDate.padEnd(13) +
          (s.lastLogged ?? "never").padEnd(14) +
          s.proposedEndDate
      );
    }
    console.log();
  }

  // --- Part 2: already-ended allocations whose end date is far too late ---
  if (lateEnded.length === 0) {
    console.log("Part 2 - Allocations ended too late: none found.\n");
  } else {
    console.log(
      `Part 2 - ${lateEnded.length} allocation(s) ended >${STALE_ALLOCATION_DAYS}d after the last entry -> end date corrected back to last logged:\n`
    );
    console.log(
      "Employee".padEnd(24) + "Project".padEnd(30) + "%".padEnd(5) + "Ended on".padEnd(13) + "Last logged".padEnd(14) + "Corrected to"
    );
    console.log("-".repeat(100));
    for (const s of lateEnded) {
      console.log(
        s.employeeName.slice(0, 22).padEnd(24) +
          s.projectName.slice(0, 28).padEnd(30) +
          `${s.allocationPercentage}%`.padEnd(5) +
          s.currentEndDate.padEnd(13) +
          s.lastLogged.padEnd(14) +
          s.correctedEndDate
      );
    }
    console.log();
  }

  if (stale.length === 0 && lateEnded.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  const employees = new Set([...stale.map((s) => s.employeeName), ...lateEnded.map((s) => s.employeeName)]).size;
  console.log(`Summary: ${stale.length} to close + ${lateEnded.length} to correct, across ${employees} employee(s).`);

  if (!apply) {
    console.log("\nThis was a PREVIEW -- nothing was changed. Re-run with --apply to write these changes.");
    return;
  }

  console.log("\nApplying...");
  const closed = await applyStaleAllocationCleanup();
  const corrected = await applyLateEndedCorrection();
  console.log(`Done. Closed ${closed} open stale allocation(s), corrected ${corrected} late-ended allocation(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
