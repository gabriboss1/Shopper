export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type Day = (typeof DAYS)[number];

export const BUILDINGS = {
  wlh: { name: "William L. Harkness Hall", short: "WLH", lat: 41.3122, lng: -72.9278 },
  lc: { name: "Linsly-Chittenden Hall", short: "LC", lat: 41.3094, lng: -72.9304 },
  hq: { name: "Humanities Quadrangle", short: "HQ", lat: 41.3116, lng: -72.9306 },
  akw: { name: "Arthur K. Watson Hall", short: "AKW", lat: 41.3136, lng: -72.9218 },
  sss: { name: "Sheffield-Sterling-Strathcona Hall", short: "SSS", lat: 41.3144, lng: -72.9256 },
  kbt: { name: "Kline Biology Tower", short: "KBT", lat: 41.3174, lng: -72.9226 },
  scl: { name: "Sterling Chemistry Laboratory", short: "SCL", lat: 41.3166, lng: -72.9252 },
  spl: { name: "Sloane Physics Laboratory", short: "SPL", lat: 41.3148, lng: -72.9246 },
  mason: { name: "Mason Laboratory", short: "Mason", lat: 41.3137, lng: -72.9248 },
  pwg: { name: "Payne Whitney Gymnasium", short: "PWG", lat: 41.3138, lng: -72.9308 },
  sprague: { name: "Sprague Hall", short: "Sprague", lat: 41.3099, lng: -72.9269 },
  whc: { name: "Whitney Humanities Center", short: "WHC", lat: 41.3118, lng: -72.9274 },
  rkz: { name: "Rosenkranz Hall", short: "RKZ", lat: 41.313, lng: -72.9286 },
  luce: { name: "Luce Hall", short: "Luce", lat: 41.3148, lng: -72.9234 },
  kroon: { name: "Kroon Hall", short: "Kroon", lat: 41.3169, lng: -72.9236 },
  phelps: { name: "Phelps Hall", short: "Phelps", lat: 41.3108, lng: -72.9293 },
  rudolph: { name: "Rudolph Hall", short: "Rudolph", lat: 41.3087, lng: -72.9318 },
  becton: { name: "Becton Center", short: "Becton", lat: 41.3126, lng: -72.9254 },
  davies: { name: "Davies Auditorium", short: "Davies", lat: 41.317, lng: -72.9224 },
} as const;

export type BuildingId = keyof typeof BUILDINGS;

export type Meeting = {
  days: Day[];
  start: string;
  end: string;
  buildingId: BuildingId;
  room: string;
};

export type Section = {
  id: string;
  label: string;
  instructor: string;
  meetings: Meeting[];
};

export const MAJORS = {
  CPSC: "Computer Science",
  MATH: "Mathematics",
  ECON: "Economics",
  ENGL: "English",
  HIST: "History",
  PSYC: "Psychology",
  BIOL: "Biology",
  CHEM: "Chemistry",
  PHYS: "Physics",
  PHIL: "Philosophy",
  PLSC: "Political Science",
  FREN: "French",
  SPAN: "Spanish",
  MUSI: "Music",
  EEB: "Ecology and Evolutionary Biology",
  ARCH: "Architecture",
  EENG: "Electrical Engineering",
} as const;

export type MajorCode = keyof typeof MAJORS;
export type Distributional = "WR" | "SO" | "L" | "QR" | "SC" | "HU";

const DISTRIBUTIONALS: Record<string, Distributional> = {
  "cpsc-223": "QR",
  "cpsc-201": "QR",
  "cpsc-323": "QR",
  "math-120": "QR",
  "math-225": "QR",
  "econ-115": "SO",
  "econ-116": "SO",
  "engl-114": "WR",
  "engl-129": "HU",
  "hist-135": "HU",
  "hist-202": "HU",
  "psyc-110": "SO",
  "psyc-200": "QR",
  "biol-101": "SC",
  "chem-161": "SC",
  "phys-170": "SC",
  "phil-175": "HU",
  "plsc-113": "SO",
  "fren-130": "L",
  "span-140": "L",
  "musi-110": "HU",
  "eeb-220": "SC",
  "arch-101": "HU",
  "eeng-200": "SC",
};

export type Course = {
  id: string;
  code: string;
  title: string;
  department: MajorCode;
  major: string;
  distributional: Distributional;
  sections: Section[];
};

function section(
  courseId: string,
  label: string,
  instructor: string,
  days: Day[],
  start: string,
  end: string,
  buildingId: BuildingId,
  room: string,
): Section {
  return {
    id: `${courseId}-${label}`,
    label,
    instructor,
    meetings: [{ days, start, end, buildingId, room }],
  };
}

function course(id: string, code: string, title: string, department: MajorCode, sections: Section[]): Course {
  const distributional = DISTRIBUTIONALS[id];
  if (!distributional || !MAJORS[department]) throw new Error(`Missing major or distributional for ${id}`);
  return { id, code, title, department, major: MAJORS[department], distributional, sections };
}

export const COURSES: Course[] = [
  course("cpsc-223", "CPSC 223", "Data Structures and Programming Techniques", "CPSC", [
    section("cpsc-223", "01", "R. Adeyemi", ["Tue", "Thu"], "11:35", "12:50", "akw", "200"),
    section("cpsc-223", "02", "R. Adeyemi", ["Mon", "Wed"], "13:30", "14:45", "wlh", "112"),
  ]),
  course("cpsc-201", "CPSC 201", "Introduction to Computer Science", "CPSC", [
    section("cpsc-201", "01", "L. Okonkwo", ["Mon", "Wed", "Fri"], "10:30", "11:20", "akw", "104"),
    section("cpsc-201", "02", "L. Okonkwo", ["Tue", "Thu"], "09:00", "10:15", "mason", "211"),
  ]),
  course("cpsc-323", "CPSC 323", "Introduction to Systems Programming", "CPSC", [
    section("cpsc-323", "01", "S. Iqbal", ["Mon", "Wed"], "14:30", "15:45", "akw", "300"),
  ]),
  course("math-120", "MATH 120", "Calculus of Functions of Several Variables", "MATH", [
    section("math-120", "01", "L. Petrov", ["Mon", "Wed", "Fri"], "09:25", "10:15", "sss", "110"),
    section("math-120", "02", "S. Berg", ["Tue", "Thu"], "10:30", "11:20", "mason", "104"),
  ]),
  course("math-225", "MATH 225", "Linear Algebra and Matrix Theory", "MATH", [
    section("math-225", "01", "H. Nguyen", ["Mon", "Wed", "Fri"], "11:35", "12:25", "sss", "207"),
    section("math-225", "02", "H. Nguyen", ["Tue", "Thu"], "13:00", "14:15", "wlh", "119"),
  ]),
  course("econ-115", "ECON 115", "Introductory Microeconomics", "ECON", [
    section("econ-115", "01", "M. Chen", ["Tue", "Thu"], "11:35", "12:50", "wlh", "201"),
    section("econ-115", "02", "M. Chen", ["Mon", "Wed", "Fri"], "10:30", "11:20", "wlh", "201"),
  ]),
  course("econ-116", "ECON 116", "Introductory Macroeconomics", "ECON", [
    section("econ-116", "01", "J. Okonkwo", ["Mon", "Wed", "Fri"], "13:30", "14:20", "sss", "114"),
    section("econ-116", "02", "J. Okonkwo", ["Tue", "Thu"], "09:00", "10:15", "rkz", "102"),
  ]),
  course("engl-114", "ENGL 114", "Writing Seminar", "ENGL", [
    section("engl-114", "01", "A. Brooks", ["Mon", "Wed"], "11:35", "12:50", "lc", "102"),
    section("engl-114", "02", "A. Brooks", ["Tue", "Thu"], "14:30", "15:45", "lc", "102"),
  ]),
  course("engl-129", "ENGL 129", "Tragedy", "ENGL", [
    section("engl-129", "01", "C. Walsh", ["Tue", "Thu"], "10:30", "11:20", "lc", "211"),
  ]),
  course("hist-135", "HIST 135", "The Atlantic World", "HIST", [
    section("hist-135", "01", "H. Nguyen", ["Tue", "Thu"], "14:30", "15:45", "hq", "207"),
    section("hist-135", "02", "H. Nguyen", ["Mon", "Wed"], "09:00", "10:15", "hq", "207"),
  ]),
  course("hist-202", "HIST 202", "Modern China", "HIST", [
    section("hist-202", "01", "E. Park", ["Mon", "Wed"], "13:30", "14:45", "hq", "241"),
  ]),
  course("psyc-110", "PSYC 110", "Introduction to Psychology", "PSYC", [
    section("psyc-110", "01", "D. Alvarez", ["Tue", "Thu"], "11:35", "12:50", "sss", "207"),
  ]),
  course("psyc-200", "PSYC 200", "Statistics", "PSYC", [
    section("psyc-200", "01", "D. Alvarez", ["Mon", "Wed", "Fri"], "09:25", "10:15", "sss", "114"),
  ]),
  course("biol-101", "BIOL 101", "Biochemistry and Biophysics", "BIOL", [
    section("biol-101", "01", "P. Shah", ["Tue", "Thu"], "13:00", "14:15", "kbt", "123"),
    section("biol-101", "02", "P. Shah", ["Mon", "Wed", "Fri"], "11:35", "12:25", "kbt", "123"),
  ]),
  course("chem-161", "CHEM 161", "General Chemistry I", "CHEM", [
    section("chem-161", "01", "N. Rossi", ["Mon", "Wed", "Fri"], "09:25", "10:15", "scl", "110"),
    section("chem-161", "02", "N. Rossi", ["Mon", "Wed", "Fri"], "11:35", "12:25", "scl", "110"),
  ]),
  course("phys-170", "PHYS 170", "University Physics", "PHYS", [
    section("phys-170", "01", "A. Rahman", ["Mon", "Wed", "Fri"], "10:30", "11:20", "spl", "59"),
  ]),
  course("phil-175", "PHIL 175", "Introduction to Ethics", "PHIL", [
    section("phil-175", "01", "C. Walsh", ["Tue", "Thu"], "13:00", "14:15", "whc", "208"),
  ]),
  course("plsc-113", "PLSC 113", "Introduction to American Politics", "PLSC", [
    section("plsc-113", "01", "M. Ellis", ["Mon", "Wed"], "14:30", "15:45", "rkz", "05"),
    section("plsc-113", "02", "M. Ellis", ["Tue", "Thu"], "10:30", "11:20", "rkz", "05"),
  ]),
  course("fren-130", "FREN 130", "Intermediate French", "FREN", [
    section("fren-130", "01", "C. Moreau", ["Mon", "Wed", "Fri"], "11:35", "12:25", "lc", "210"),
    section("fren-130", "02", "C. Moreau", ["Mon", "Wed", "Fri"], "13:30", "14:20", "hq", "129"),
  ]),
  course("span-140", "SPAN 140", "Intermediate Spanish", "SPAN", [
    section("span-140", "01", "I. Vega", ["Tue", "Thu"], "09:00", "10:15", "lc", "319"),
  ]),
  course("musi-110", "MUSI 110", "Introduction to the History of Music", "MUSI", [
    section("musi-110", "01", "J. Adler", ["Mon", "Wed"], "15:30", "16:20", "sprague", "101"),
  ]),
  course("eeb-220", "EEB 220", "General Ecology", "EEB", [
    section("eeb-220", "01", "P. Shah", ["Tue", "Thu"], "09:00", "10:15", "kroon", "101"),
  ]),
  course("arch-101", "ARCH 101", "Introduction to Architecture", "ARCH", [
    section("arch-101", "01", "R. Klein", ["Tue", "Thu"], "15:30", "16:45", "rudolph", "201"),
  ]),
  course("eeng-200", "EENG 200", "Introduction to Electronics", "EENG", [
    section("eeng-200", "01", "A. Rahman", ["Mon", "Wed", "Fri"], "13:30", "14:20", "becton", "201"),
  ]),
];

export function getCourse(id: string): Course | undefined {
  return COURSES.find((course) => course.id === id);
}

export function buildingOf(id: BuildingId) {
  return BUILDINGS[id];
}
