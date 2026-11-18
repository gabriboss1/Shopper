import { BUILDINGS, type BuildingId, type Day } from "@/data/courses";
import { CROWD_LABEL, DINING_HALLS, type CrowdLevel, type Diet, type DiningHall } from "@/data/dining";
import { parseMinutes, walkingMinutesBetween, type Chosen } from "@/lib/schedule";

const LEVELS: CrowdLevel[] = ["Quiet", "Moderate", "Busy", "Very busy"];

export type YaleClock = { weekday: Day | "Sat" | "Sun"; hour: number; minute: number };

export function yaleNow(date = new Date()): YaleClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekday = parts.weekday as YaleClock["weekday"];
  const hour = Number(parts.hour) % 24;
  return { weekday, hour, minute: Number(parts.minute) || 0 };
}

export function typicalCrowd(hallId: string, clock: YaleClock): CrowdLevel {
  const weekend = clock.weekday === "Sat" || clock.weekday === "Sun";
  let level = 0;
  const hour = clock.hour;
  if (hour >= 7 && hour < 21) {
    if (weekend) {
      if (hour >= 11 && hour <= 13) level = 2;
      else if (hour >= 17 && hour <= 19) level = 1;
    } else if (hour === 12 || hour === 18) level = 3;
    else if ((hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 19)) level = 2;
    else if (hour === 11 || hour === 14 || hour === 17 || hour === 20 || (hour >= 8 && hour <= 9)) level = 1;
  }
  if (hallId === "slifka") level = Math.max(0, level - 1);
  if (hallId === "commons" && !weekend && (hour === 12 || hour === 18)) level = 3;
  if (clock.weekday === "Fri" && hour >= 17) level = Math.max(0, level - 1);
  return LEVELS[level] ?? "Quiet";
}

export function hallHours(hall: DiningHall, clock: YaleClock): { open: boolean; label: string } {
  const weekend = clock.weekday === "Sat" || clock.weekday === "Sun";
  const now = clock.hour * 60 + clock.minute;
  const windows: [number, number, string][] = hall.id === "commons"
    ? weekend
      ? [[11 * 60, 14 * 60, "Brunch until 2:00pm"]]
      : [[11 * 60, 14 * 60, "Lunch until 2:00pm"], [17 * 60, 19 * 60 + 30, "Dinner until 7:30pm"]]
    : hall.id === "slifka"
      ? [[11 * 60 + 30, 13 * 60 + 30, "Lunch until 1:30pm"], [17 * 60 + 30, 19 * 60 + 30, "Dinner until 7:30pm"]]
      : weekend
        ? [[10 * 60 + 30, 13 * 60 + 30, "Brunch until 1:30pm"], [17 * 60, 19 * 60, "Dinner until 7:00pm"]]
        : clock.weekday === "Fri"
          ? [[11 * 60 + 30, 13 * 60 + 30, "Lunch until 1:30pm"], [17 * 60, 19 * 60, "Dinner until 7:00pm"]]
          : [[11 * 60 + 30, 13 * 60 + 30, "Lunch until 1:30pm"], [17 * 60, 19 * 60 + 30, "Dinner until 7:30pm"]];
  const current = windows.find(([start, end]) => now >= start && now < end);
  if (current) {
    const closesIn = current[1] - now;
    return { open: true, label: closesIn <= 30 ? `Closing soon · ${current[2]}` : String(current[2]) };
  }
  const next = windows.find(([start]) => start > now);
  return { open: false, label: next ? `Closed · opens ${formatClock(next[0])}` : "Closed for today" };
}

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${minute.toString().padStart(2, "0")}${suffix}`;
}

export function mealMenus(hall: DiningHall, clock: YaleClock) {
  return clock.hour >= 16 ? hall.dinner : hall.lunch;
}

export function menuMatch(items: { tags: Diet[] }[], diets: Diet[]): { ratio: number; phrase: string } {
  if (diets.length === 0) return { ratio: 1, phrase: "open now" };
  const matched = items.filter((item) => diets.some((diet) => item.tags.includes(diet))).length;
  const ratio = items.length === 0 ? 0 : matched / items.length;
  if (ratio >= 0.5) return { ratio, phrase: "strong menu match" };
  if (ratio > 0) return { ratio, phrase: "some menu matches" };
  return { ratio, phrase: "limited menu match" };
}

export type Origin = { lat: number; lng: number; label: string };

export function classOrigin(chosen: Chosen[], clock: YaleClock, collegeId: string): Origin {
  const college = DINING_HALLS.find((hall) => hall.id === collegeId);
  const now = clock.hour * 60 + clock.minute;
  const today = chosen.flatMap((item) =>
    item.section.meetings
      .filter((meeting) => meeting.days.includes(clock.weekday as Day))
      .map((meeting) => ({
        start: parseMinutes(meeting.start),
        end: parseMinutes(meeting.end),
        buildingId: meeting.buildingId,
        label: item.course.code,
      })),
  ).sort((a, b) => a.start - b.start);
  const current = today.find((meeting) => now >= meeting.start && now < meeting.end) ?? today.find((meeting) => meeting.start >= now) ?? today.at(-1);
  if (current) {
    const place = BUILDINGS[current.buildingId];
    return { lat: place.lat, lng: place.lng, label: `${current.label} at ${place.short}` };
  }
  if (college) return { lat: college.lat, lng: college.lng, label: college.short };
  return { lat: 41.3111, lng: -72.9267, label: "Cross Campus" };
}

const CROWD_WEIGHT: Record<CrowdLevel, number> = { Quiet: 0, Moderate: 5, Busy: 12, "Very busy": 22 };

export type DiningOption = {
  hall: DiningHall;
  minutes: number;
  crowd: CrowdLevel;
  crowdLabel: string;
  open: boolean;
  hours: string;
  menu: { name: string; tags: Diet[] }[];
  phrase: string;
  score: number;
};

export function recommendDining(input: {
  chosen: Chosen[];
  clock: YaleClock;
  collegeId: string;
  diets: Diet[];
  lowCrowd: boolean;
  closest: boolean;
}): DiningOption[] {
  const origin = classOrigin(input.chosen, input.clock, input.collegeId);
  const options = DINING_HALLS.map((hall) => {
    const minutes = walkingMinutesBetween(origin, hall);
    const crowd = typicalCrowd(hall.id, input.clock);
    const hours = hallHours(hall, input.clock);
    const menu = mealMenus(hall, input.clock);
    const match = menuMatch(menu, input.diets);
    const closesSoon = hours.label.startsWith("Closing soon") ? 8 : 0;
    const collegeBias = hall.id === input.collegeId ? 4 : 0;
    const score = minutes * 1.2 + CROWD_WEIGHT[crowd] + (1 - match.ratio) * 16 + (hours.open ? 0 : 40) + closesSoon - collegeBias;
    return {
      hall,
      minutes,
      crowd,
      crowdLabel: CROWD_LABEL,
      open: hours.open,
      hours: hours.label,
      menu,
      phrase: hours.open ? match.phrase : "closed",
      score,
    };
  });
  const visible = options.filter((option) => {
    if (input.lowCrowd && (option.crowd === "Busy" || option.crowd === "Very busy")) return false;
    return true;
  });
  visible.sort((a, b) => (input.closest ? a.minutes - b.minutes : a.score - b.score));
  return visible;
}

export function crowdColor(level: CrowdLevel): string {
  if (level === "Quiet") return "#1f7a4d";
  if (level === "Moderate") return "#8c6a2f";
  if (level === "Busy") return "#b85c38";
  return "#9b2335";
}
