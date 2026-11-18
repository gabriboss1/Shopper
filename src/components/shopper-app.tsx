"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DAYS, COURSES, DEFAULT_LIST, getCourse, type Course, type Day } from "@/data/courses";
import { conflictingEvents, formatMeeting, formatMinutes, optimize, parseMinutes, type ManualEvent, type Optimized } from "@/lib/schedule";
import { scheduleToIcs } from "@/lib/ics";
import { colorFor, type MapPin } from "@/components/campus-map";
import { CasPanel } from "@/components/cas-panel";

const CampusMap = dynamic(() => import("@/components/campus-map").then((mod) => mod.CampusMap), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-[#e7e1d4]" />,
});

const START = 8 * 60;
const END = 21 * 60;
const HOUR = 46;

export function ShopperApp() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [ids, setIds] = useState<string[]>(DEFAULT_LIST);
  const [ready, setReady] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [events, setEvents] = useState<ManualEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDay, setEventDay] = useState<Day>("Tue");
  const [eventStart, setEventStart] = useState("15:00");
  const [eventEnd, setEventEnd] = useState("16:30");
  const [eventNote, setEventNote] = useState("");
  const [undo, setUndo] = useState<{ id: string; index: number; code: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState("");
  const undoTimer = useState<{ id: number | null }>({ id: null })[0];

  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("list");
    const sharedIds = shared?.split(",").filter((id) => getCourse(id)) ?? [];
    if (sharedIds.length > 0) {
      setIds(sharedIds);
    } else {
      const raw = localStorage.getItem("shopper-list");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) setIds(parsed.filter((id) => getCourse(id)));
        } catch {
          /* keep the seeded list */
        }
      }
    }
    setReady(true);
    let current = localStorage.getItem("shopper-profile");
    if (!current) {
      current = crypto.randomUUID();
      localStorage.setItem("shopper-profile", current);
    }
    setProfileId(current);
    void fetch(`/api/events?profileId=${current}`)
      .then((response) => response.json())
      .then((body: { events?: ManualEvent[] }) => {
        if (Array.isArray(body.events)) setEvents(body.events);
      })
      .catch(() => setEventNote("Calendar events are unavailable."));
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("shopper-list", JSON.stringify(ids));
  }, [ids, ready]);

  const departments = useMemo(() => ["All", ...Array.from(new Set(COURSES.map((course) => course.department)))], []);
  const list = useMemo(
    () => ids.map((id) => getCourse(id)).filter((course): course is Course => Boolean(course)),
    [ids],
  );
  const plan = useMemo(() => optimize(list), [list]);
  const dropped = new Set(plan.dropped.map((course) => course.id));

  const results = COURSES.filter((course) => {
    const haystack = `${course.code} ${course.title} ${course.department} ${course.sections.map((section) => section.instructor).join(" ")}`.toLowerCase();
    const matchesText = haystack.includes(query.trim().toLowerCase());
    const matchesDept = department === "All" || course.department === department;
    return matchesText && matchesDept;
  });

  async function saveEvents(next: ManualEvent[]) {
    setEvents(next);
    if (!profileId) return;
    const response = await fetch("/api/events", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, events: next }),
    });
    setEventNote(response.ok ? "Events stored encrypted." : "Could not store events.");
  }

  function add(id: string) {
    setIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function remove(id: string) {
    setIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      if (undoTimer.id) window.clearTimeout(undoTimer.id);
      undoTimer.id = window.setTimeout(() => setUndo(null), 8000);
      setUndo({ id, index, code: getCourse(id)?.code ?? "Course" });
      return current.filter((item) => item !== id);
    });
  }

  function undoRemove() {
    if (!undo) return;
    if (undoTimer.id) window.clearTimeout(undoTimer.id);
    setIds((current) => {
      if (current.includes(undo.id)) return current;
      const copy = current.slice();
      copy.splice(Math.min(undo.index, copy.length), 0, undo.id);
      return copy;
    });
    setUndo(null);
  }

  async function copyLink() {
    const url = `${window.location.origin}/?list=${ids.join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote(url);
    }
    window.setTimeout(() => setShareNote(""), 2000);
  }

  function move(id: string, direction: -1 | 1) {
    setIds((current) => {
      const index = current.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = current.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  const pins: MapPin[] = plan.chosen.map((item) => ({
    id: item.section.id,
    buildingId: item.section.meetings[0].buildingId,
    label: item.course.code,
    detail: formatMeeting(item.section),
  }));

  return (
    <div className="min-h-screen">
      <header className="bg-[#00356b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">Yale shopping period</p>
            <h1 className="text-2xl font-semibold">Shopper</h1>
          </div>
          <p className="max-w-sm text-right text-sm text-white/80">
            {plan.chosen.length} in the week · {plan.weeklyWalkingMinutes} min walking
            {plan.dropped.length > 0 ? ` · ${plan.dropped.length} left out` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[340px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <label className="block text-sm font-medium" htmlFor="search">
              Search courses
            </label>
            <input
              id="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, title, or instructor"
              className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2 outline-none focus:border-[#00356b]"
            />
            <select
              aria-label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2"
            >
              {departments.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
              {results.map((course) => {
                const added = ids.includes(course.id);
                const open = openId === course.id;
                const first = course.sections[0];
                return (
                  <li key={course.id} className="rounded-lg border border-[#eee6d8] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" className="text-left" onClick={() => setOpenId(open ? null : course.id)}>
                        <p className="font-medium">
                          {course.code} <span className="font-normal text-[#5c564c]">{course.title}</span>
                        </p>
                        <p className="text-xs text-[#5c564c]">{first ? formatMeeting(first) : "Time unavailable"} · Capacity unknown</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => (added ? remove(course.id) : add(course.id))}
                        className={`shrink-0 rounded-md px-2 py-1 text-sm ${added ? "bg-[#efe8dc] text-[#00356b]" : "bg-[#00356b] text-white"}`}
                      >
                        {added ? "Remove" : "Add"}
                      </button>
                    </div>
                    {open ? (
                      <ul className="mt-2 space-y-1 text-xs text-[#3d3832]">
                        {course.sections.map((section) => (
                          <li key={section.id}>Section {section.label}: {formatMeeting(section)} · Capacity unknown</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Shopping list</h2>
              <div className="flex gap-3">
                <button type="button" className="text-sm text-[#00356b] underline" onClick={() => void copyLink()}>
                  Copy share link
                </button>
                <button type="button" className="text-sm text-[#00356b] underline" onClick={() => setIds(DEFAULT_LIST)}>
                  Reset sample
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-[#5c564c]">Higher in the list is kept first when a time conflict is unavoidable.</p>
            {shareNote ? <p className="text-xs text-[#1f7a4d]">{shareNote}</p> : null}
            {list.length === 0 ? <p className="mt-3 text-sm">Add a course to build a week.</p> : null}
            <ol className="mt-3 space-y-2">
              {list.map((course, index) => {
                const chosen = plan.chosen.find((item) => item.course.id === course.id);
                const conflict = dropped.has(course.id);
                const eventHits = chosen ? conflictingEvents(chosen.section, events) : [];
                return (
                  <li key={course.id} className={`rounded-lg border p-2 ${conflict || eventHits.length > 0 ? "border-[#9b2335] bg-[#fdf2f3]" : "border-[#eee6d8]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {index + 1}. {course.code}
                        </p>
                        <p className="text-sm text-[#3d3832]">{course.title}</p>
                        <p className="text-xs text-[#5c564c]">Capacity unknown</p>
                        {chosen ? <p className="text-xs text-[#1f7a4d]">Section {chosen.section.label}: {formatMeeting(chosen.section)}</p> : null}
                        {conflict ? <p className="text-xs font-medium text-[#9b2335]">Conflict — left out of the optimized week</p> : null}
                        {eventHits.map((event) => (
                          <p key={event.id} className="text-xs font-medium text-[#9b2335]">Conflicts with {event.title}</p>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" aria-label={`Move ${course.code} up`} className="rounded border px-2 text-xs" onClick={() => move(course.id, -1)}>
                          Up
                        </button>
                        <button type="button" aria-label={`Move ${course.code} down`} className="rounded border px-2 text-xs" onClick={() => move(course.id, 1)}>
                          Down
                        </button>
                        <button type="button" className="rounded border px-2 text-xs" onClick={() => remove(course.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <CasPanel />
          <form
            className="rounded-xl border border-[#e4dccb] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const title = eventTitle.trim();
              if (!title || eventStart >= eventEnd) {
                setEventNote("Give the event a name and an end time after the start.");
                return;
              }
              void saveEvents([...events, { id: crypto.randomUUID(), title, day: eventDay, start: eventStart, end: eventEnd }]);
              setEventTitle("");
            }}
          >
            <h2 className="font-semibold">Your commitments</h2>
            <p className="mt-1 text-xs text-[#5c564c]">Add a class, practice, or job. Google and Outlook are not connected. Overlaps are marked on the list.</p>
            <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event name" aria-label="Event name" className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select aria-label="Event day" value={eventDay} onChange={(event) => setEventDay(event.target.value as Day)} className="rounded-lg border border-[#d9d0c1] px-2 py-2">
                {DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
              <input aria-label="Event start" type="time" value={eventStart} onChange={(event) => setEventStart(event.target.value)} className="rounded-lg border border-[#d9d0c1] px-2 py-2" />
              <input aria-label="Event end" type="time" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} className="rounded-lg border border-[#d9d0c1] px-2 py-2" />
            </div>
            <button type="submit" className="mt-2 rounded-md bg-[#00356b] px-3 py-2 text-sm text-white">Add event</button>
            <ul className="mt-2 space-y-1 text-sm">
              {events.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span>{item.title} · {item.day} {item.start}–{item.end}</span>
                  <button type="button" className="text-xs underline" onClick={() => void saveEvents(events.filter((event) => event.id !== item.id))}>Remove</button>
                </li>
              ))}
            </ul>
            {eventNote ? <p className="mt-2 text-xs">{eventNote}</p> : null}
          </form>
        </section>

        <section className="space-y-4">
          <Week plan={plan} events={events} />
          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <h2 className="font-semibold">Campus map</h2>
            <p className="mt-1 text-xs text-[#5c564c]">
              Walking times are estimated from building coordinates at a campus pace. They are not turn-by-turn directions.
            </p>
            <div className="mt-3">
              <CampusMap pins={pins} legs={plan.legs} />
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {plan.legs.length === 0 ? <li>Add two classes on the same day to see a walk.</li> : null}
              {plan.legs.map((leg) => (
                <li key={`${leg.day}-${leg.from.section.id}-${leg.to.section.id}`}>
                  {leg.day}: {leg.from.course.code} to {leg.to.course.code} · {leg.minutes} min
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      {undo ? (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#00356b] px-4 py-2 text-sm text-white shadow-lg">
          <span>Removed {undo.code}</span>
          <button type="button" className="underline" onClick={undoRemove}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Week({ plan, events }: { plan: Optimized; events: ManualEvent[] }) {
  const hours = [];
  for (let minute = START; minute < END; minute += 60) hours.push(minute);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e4dccb] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Optimized week</h2>
        <button
          type="button"
          className="rounded-md bg-[#00356b] px-3 py-1.5 text-sm text-white"
          onClick={() => {
            const blob = new Blob([scheduleToIcs(plan.chosen, plan.legs)], { type: "text/calendar" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "shopper.ics";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export .ics
        </button>
      </div>
      <p className="text-sm text-[#5c564c]">{plan.weeklyWalkingMinutes} minutes of walking between classes. The file adds that walk as a buffer before class.</p>
      <div className="mt-3 min-w-[720px]">
        <div className="grid grid-cols-[52px_repeat(5,1fr)] text-xs font-medium text-[#5c564c]">
          <div />
          {DAYS.map((day) => (
            <div key={day} className="px-1 pb-1">
              {day}
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[52px_repeat(5,1fr)]" style={{ height: ((END - START) / 60) * HOUR }}>
          <div className="relative">
            {hours.map((minute) => (
              <div key={minute} className="absolute left-0 text-[10px] text-[#8a8174]" style={{ top: ((minute - START) / 60) * HOUR - 6 }}>
                {formatMinutes(minute)}
              </div>
            ))}
          </div>
          {DAYS.map((day) => (
            <DayColumn key={day} day={day} plan={plan} events={events} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, plan, events }: { day: Day; plan: Optimized; events: ManualEvent[] }) {
  return (
    <div className="relative border-l border-[#eee6d8]">
      {events
        .filter((event) => event.day === day)
        .map((event) => {
          const start = parseMinutes(event.start);
          const end = parseMinutes(event.end);
          return (
            <div
              key={event.id}
              className="absolute inset-x-1 overflow-hidden rounded-md bg-[#6b655c] px-1 py-0.5 text-[11px] text-white"
              style={{ top: ((start - START) / 60) * HOUR, height: Math.max(18, ((end - start) / 60) * HOUR - 2) }}
            >
              {event.title}
            </div>
          );
        })}
      {plan.chosen.flatMap((item, index) =>
        item.section.meetings
          .filter((meeting) => meeting.days.includes(day))
          .map((meeting) => {
            const start = parseMinutes(meeting.start);
            const end = parseMinutes(meeting.end);
            const hits = conflictingEvents(item.section, events);
            const walk = plan.legs.find((leg) => leg.day === day && leg.to.section.id === item.section.id);
            return (
              <div key={`${item.section.id}-${day}`}>
                {walk && walk.minutes > 0 ? (
                  <div
                    className="absolute inset-x-1 overflow-hidden rounded-sm bg-[#d9e3f0] px-1 text-[10px] text-[#00356b]"
                    style={{ top: ((start - walk.minutes - START) / 60) * HOUR, height: Math.max(14, (walk.minutes / 60) * HOUR - 1) }}
                  >
                    {walk.minutes} min walk
                  </div>
                ) : null}
                <div
                  className="absolute inset-x-1 overflow-hidden rounded-md px-1 py-0.5 text-[11px] leading-tight text-white"
                  style={{
                    top: ((start - START) / 60) * HOUR,
                    height: Math.max(22, ((end - start) / 60) * HOUR - 2),
                    background: colorFor(index),
                    outline: hits.length > 0 ? "2px solid #9b2335" : undefined,
                  }}
                >
                  <div className="font-semibold">{item.course.code}</div>
                  <div>{hits.length > 0 ? `Conflicts with ${hits[0].title}` : meeting.room}</div>
                </div>
              </div>
            );
          }),
      )}
    </div>
  );
}
