// One-time correction of ProjectAllocation date ranges so they match what people
// actually logged. See src/lib/allocation-date-fix.ts for the rules. The bulk
// import set allocation start dates from whichever import FILE first mentioned a
// project, so many start far too late (e.g. on-bench-since-2023 shown as 2026),
// which makes Project History and utilization wrong. Timesheet data is never
// touched -- only allocation start/end corrected, and genuinely-missing
// allocations created. Safe by default (preview); --apply to write.
//
//   Preview:  npx tsx scripts/fix-allocation-dates.ts
//   Apply:    npx tsx scripts/fix-allocation-dates.ts --apply

import { computeAllocationDateFixes, applyAllocationDateFixes } from "@/lib/allocation-date-fix";
import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");
  const { startFixes, endFixes, creates, multi } = await computeAllocationDateFixes();

  const line = (emp: string, proj: string, detail: string) =>
    "  " + emp.slice(0, 22).padEnd(24) + proj.slice(0, 30).padEnd(32) + detail;

  console.log(`START dates to pull back (start later than first logged) (${startFixes.length}):`);
  startFixes.forEach((f) => console.log(line(f.emp, f.proj, `${f.from} -> ${f.to}`)));
  console.log(`\nEND dates to extend (end before last logged) (${endFixes.length}):`);
  endFixes.forEach((f) => console.log(line(f.emp, f.proj, `${f.from} -> ${f.to}`)));
  console.log(`\nMissing allocations to CREATE (logged but no allocation) (${creates.length}):`);
  creates.forEach((c) => console.log(line(c.emp, c.proj, `create ${c.start} .. ${c.end}`)));
  if (multi.length > 0) {
    console.log(`\nPairs with MULTIPLE allocations -- left for manual review (${multi.length}):`);
    multi.forEach((m) => console.log(line(m.emp, m.proj, `${m.n} allocations`)));
  }

  const total = startFixes.length + endFixes.length + creates.length;
  console.log(`\nSummary: ${startFixes.length} start(s) to fix, ${endFixes.length} end(s) to extend, ${creates.length} allocation(s) to create.`);
  if (total === 0) { console.log("\nNothing to fix."); return; }
  if (!apply) { console.log("\nThis was a PREVIEW -- nothing was changed. Re-run with --apply to write these corrections."); return; }

  console.log("\nApplying...");
  const r = await applyAllocationDateFixes();
  console.log(`Done. Fixed ${r.starts} start(s), extended ${r.ends} end(s), created ${r.created} allocation(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
