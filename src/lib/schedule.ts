import {
  BUILDINGS,
  type BuildingId,
  type Course,
  type Day,
  type Section,
} from "@/data/courses";

export type Chosen = { course: Course; section: Section };

export type Leg = {
  day: Day;
  from: Chosen;
  to: Chosen;
  minutes: number;
};

export type ManualEvent = {
  id: string;
  title: string;
  day: Day;
  start: string;
  end: string;
};

export const WALK_BUFFER_MINUTES = 15;

export type WalkFn = (from: BuildingId, to: BuildingId) => number;

export type Dropped = { course: Course; section: Section; reason: string };

export type Optimized = {
  chosen: Chosen[];
  dropped: Dropped[];
  legs: Leg[];
};

export function parseMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function formatMinutes(mins: number): string {
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${minute.toString().padStart(2, "0")}${suffix}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatMinutes(parseMinutes(start))}–${formatMinutes(parseMinutes(end))}`;
}

export function formatMeeting(section: Section): string {
  return section.meetings
    .map((meeting) => `${meeting.days.join("/")} ${formatRange(meeting.start, meeting.end)} · ${BUILDINGS[meeting.buildingId].short} ${meeting.room}`)
    .join("; ");
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function sectionsOverlap(a: Section, b: Section): boolean {
  for (const left of a.meetings) {
    for (const right of b.meetings) {
      const days = left.days.filter((day) => right.days.includes(day));
      if (days.length === 0) continue;
      if (rangesOverlap(parseMinutes(left.start), parseMinutes(left.end), parseMinutes(right.start), parseMinutes(right.end))) {
        return true;
      }
    }
  }
  return false;
}

export function sectionOverlapsEvent(section: Section, event: ManualEvent): boolean {
  return section.meetings.some((meeting) => {
    if (!meeting.days.includes(event.day)) return false;
    return rangesOverlap(parseMinutes(meeting.start), parseMinutes(meeting.end), parseMinutes(event.start), parseMinutes(event.end));
  });
}

export function walkingMinutesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earth = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
  if (meters < 30) return 0;
  const pathFactor = 1.45;
  const metersPerSecond = 1.25;
  return Math.max(1, Math.round((meters * pathFactor) / metersPerSecond / 60));
}

export function walkingMinutes(from: BuildingId, to: BuildingId): number {
  if (from === to) return 0;
  return walkingMinutesBetween(BUILDINGS[from], BUILDINGS[to]);
}

type Placed = {
  chosen: Chosen;
  day: Day;
  start: number;
  end: number;
  buildingId: BuildingId;
};

function placed(chosen: Chosen[]): Placed[] {
  const rows: Placed[] = [];
  for (const item of chosen) {
    for (const meeting of item.section.meetings) {
      for (const day of meeting.days) {
        rows.push({
          chosen: item,
          day,
          start: parseMinutes(meeting.start),
          end: parseMinutes(meeting.end),
          buildingId: meeting.buildingId,
        });
      }
    }
  }
  return rows;
}

export function weeklyWalking(chosen: Chosen[]): number {
  return legsOf(chosen).reduce((sum, leg) => sum + leg.minutes, 0);
}

export function legsOf(chosen: Chosen[], walk: WalkFn = walkingMinutes): Leg[] {
  const legs: Leg[] = [];
  const byDay = new Map<Day, Placed[]>();
  for (const row of placed(chosen)) {
    const list = byDay.get(row.day) ?? [];
    list.push(row);
    byDay.set(row.day, list);
  }
  for (const [day, rows] of byDay) {
    rows.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1];
      const next = rows[i];
      if (previous.chosen.course.id === next.chosen.course.id) continue;
      legs.push({
        day,
        from: previous.chosen,
        to: next.chosen,
        minutes: walk(previous.buildingId, next.buildingId),
      });
    }
  }
  return legs;
}

function sharedDayWalk(a: Section, b: Section, walk: WalkFn): { minutes: number; from: BuildingId; to: BuildingId } | null {
  let worst: { minutes: number; from: BuildingId; to: BuildingId } | null = null;
  for (const left of a.meetings) {
    for (const right of b.meetings) {
      if (!left.days.some((day) => right.days.includes(day))) continue;
      const minutes = walk(left.buildingId, right.buildingId);
      if (!worst || minutes > worst.minutes) worst = { minutes, from: left.buildingId, to: right.buildingId };
    }
  }
  return worst;
}

export function optimize(courses: Course[], events: ManualEvent[] = [], walk: WalkFn = walkingMinutes): Optimized {
  const chosen: Chosen[] = [];
  const dropped: Dropped[] = [];
  for (const course of courses) {
    const ranked = course.sections
      .map((section) => {
        const block = chosen
          .map((item) => sharedDayWalk(item.section, section, walk))
          .filter((item): item is NonNullable<typeof item> => Boolean(item && item.minutes > WALK_BUFFER_MINUTES));
        const eventHits = conflictingEvents(section, events).length;
        return { section, block, eventHits };
      })
      .sort((a, b) => a.block.length - b.block.length || a.eventHits - b.eventHits);
    const best = ranked[0];
    if (!best) continue;
    if (best.block.length > 0) {
      const hit = best.block[0];
      const other = chosen.find((item) => {
        const walkHit = sharedDayWalk(item.section, best.section, walk);
        return walkHit && walkHit.minutes > WALK_BUFFER_MINUTES;
      });
      dropped.push({
        course,
        section: best.section,
        reason: `Walk from ${other?.course.code ?? "the previous class"} to ${course.code} is ${hit.minutes} min, longer than the 15-minute buffer`,
      });
      continue;
    }
    chosen.push({ course, section: best.section });
  }
  return { chosen, dropped, legs: legsOf(chosen, walk) };
}

export function conflictingEvents(section: Section, events: ManualEvent[]): ManualEvent[] {
  return events.filter((event) => sectionOverlapsEvent(section, event));
}
