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

export type Optimized = {
  chosen: Chosen[];
  dropped: Course[];
  weeklyWalkingMinutes: number;
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

export function walkingMinutes(from: BuildingId, to: BuildingId): number {
  if (from === to) return 0;
  const a = BUILDINGS[from];
  const b = BUILDINGS[to];
  const earth = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
  const pathFactor = 1.45;
  const metersPerSecond = 1.25;
  return Math.max(1, Math.round((meters * pathFactor) / metersPerSecond / 60));
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

export function legsOf(chosen: Chosen[]): Leg[] {
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
        minutes: walkingMinutes(previous.buildingId, next.buildingId),
      });
    }
  }
  return legs;
}

function conflictsWith(chosen: Chosen[], section: Section): boolean {
  return chosen.some((item) => sectionsOverlap(item.section, section));
}

export function optimize(courses: Course[]): Optimized {
  if (courses.length === 0) {
    return { chosen: [], dropped: [], weeklyWalkingMinutes: 0, legs: [] };
  }

  const chosen = courses.length > 8 ? greedy(courses) : search(courses);
  const chosenIds = new Set(chosen.map((item) => item.course.id));
  return {
    chosen,
    dropped: courses.filter((course) => !chosenIds.has(course.id)),
    weeklyWalkingMinutes: weeklyWalking(chosen),
    legs: legsOf(chosen),
  };
}

function search(courses: Course[]): Chosen[] {
  let best: { chosen: Chosen[]; score: number } | null = null;
  const current: Chosen[] = [];

  function scoreOf(pick: Chosen[]): number {
    const ids = new Set(pick.map((item) => item.course.id));
    let drop = 0;
    courses.forEach((course, index) => {
      if (!ids.has(course.id)) drop += 1000 - index;
    });
    return drop * 100 + weeklyWalking(pick);
  }

  function dfs(index: number) {
    if (index === courses.length) {
      const score = scoreOf(current);
      if (!best || score < best.score) best = { chosen: current.slice(), score };
      return;
    }
    const course = courses[index];
    for (const section of course.sections) {
      if (!conflictsWith(current, section)) {
        current.push({ course, section });
        dfs(index + 1);
        current.pop();
      }
    }
    dfs(index + 1);
  }

  dfs(0);
  return best?.chosen ?? [];
}

function greedy(courses: Course[]): Chosen[] {
  const chosen: Chosen[] = [];
  for (const course of courses) {
    let best: { section: Section; walk: number } | null = null;
    for (const section of course.sections) {
      if (conflictsWith(chosen, section)) continue;
      const walk = weeklyWalking([...chosen, { course, section }]);
      if (!best || walk < best.walk) best = { section, walk };
    }
    if (best) chosen.push({ course, section: best.section });
  }
  return chosen;
}

export function conflictingEvents(section: Section, events: ManualEvent[]): ManualEvent[] {
  return events.filter((event) => sectionOverlapsEvent(section, event));
}
