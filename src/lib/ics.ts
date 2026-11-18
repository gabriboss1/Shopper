import { BUILDINGS, type Day } from "@/data/courses";
import { parseMinutes, type Chosen, type Leg } from "@/lib/schedule";

const DAY_INDEX: Record<Day, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function mondayOf(from: Date): Date {
  const date = new Date(from);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date;
}

function stamp(monday: Date, day: Day, minutes: number): string {
  const date = new Date(monday);
  date.setDate(monday.getDate() + DAY_INDEX[day]);
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(Math.floor(total / 60))}${pad(total % 60)}00`;
}

function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function scheduleToIcs(chosen: Chosen[], legs: Leg[], from = new Date()): string {
  const monday = mondayOf(from);
  const events: string[] = [];
  for (const item of chosen) {
    for (const meeting of item.section.meetings) {
      for (const day of meeting.days) {
        const start = parseMinutes(meeting.start);
        const end = parseMinutes(meeting.end);
        const place = BUILDINGS[meeting.buildingId];
        const walk = legs.find((leg) => leg.day === day && leg.to.section.id === item.section.id);
        if (walk && walk.minutes > 0) {
          events.push(
            [
              "BEGIN:VEVENT",
              `UID:walk-${item.section.id}-${day}@shopper`,
              `DTSTART;TZID=America/New_York:${stamp(monday, day, start - walk.minutes)}`,
              `DTEND;TZID=America/New_York:${stamp(monday, day, start)}`,
              "RRULE:FREQ=WEEKLY;COUNT=12",
              `SUMMARY:${text(`Shopper – Walk to ${item.course.code}`)}`,
              `LOCATION:${text(place.name)}`,
              "END:VEVENT",
            ].join("\r\n"),
          );
        }
        events.push(
          [
            "BEGIN:VEVENT",
            `UID:class-${item.section.id}-${day}@shopper`,
            `DTSTART;TZID=America/New_York:${stamp(monday, day, start)}`,
            `DTEND;TZID=America/New_York:${stamp(monday, day, end)}`,
            "RRULE:FREQ=WEEKLY;COUNT=12",
            `SUMMARY:${text(`Shopper – ${item.course.code}`)}`,
            `LOCATION:${text(`${place.short} ${meeting.room}`)}`,
            "END:VEVENT",
          ].join("\r\n"),
        );
      }
    }
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shopper//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:DAYLIGHT",
    "DTSTART:20070311T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "DTSTART:20071104T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
