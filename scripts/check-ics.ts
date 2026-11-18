import { DEFAULT_LIST, getCourse } from "../src/data/courses";
import { scheduleToIcs } from "../src/lib/ics";
import { optimize, parseMinutes } from "../src/lib/schedule";

const list = DEFAULT_LIST.map((id) => getCourse(id)!);
const plan = optimize(list);
const ics = scheduleToIcs(plan.chosen, plan.legs, new Date("2026-11-17T15:00:00"));
if (!ics.includes("BEGIN:VCALENDAR") || !plan.chosen.every((item) => ics.includes(`SUMMARY:Shopper – ${item.course.code}`))) {
  console.error("missing class events");
  process.exit(1);
}
if (plan.legs.some((leg) => leg.minutes > 0) && !ics.includes("SUMMARY:Shopper – Walk to ")) {
  console.error("missing walking buffer");
  process.exit(1);
}
const sample = plan.chosen[0];
const meeting = sample.section.meetings[0];
const start = parseMinutes(meeting.start);
const hh = String(Math.floor(start / 60)).padStart(2, "0");
const mm = String(start % 60).padStart(2, "0");
const classBlock = ics.split("BEGIN:VEVENT").find((block) => block.includes(`UID:class-${sample.section.id}-${meeting.days[0]}`));
if (!classBlock || !classBlock.includes(`T${hh}${mm}00`)) {
  console.error("class export did not keep the real start time");
  process.exit(1);
}
console.log("ics ok");
