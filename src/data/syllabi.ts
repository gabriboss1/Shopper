export const MOCK_SYLLABI: Record<string, string> = {
  "cpsc-223": "Weekly problem sets and two programming projects. Lectures introduce data structures, with a short discussion section. No group project. Reading is light. One midterm and a final exam.",
  "cpsc-201": "Introductory programming with weekly problem sets. Lectures are the main format. Workload is moderate. A final exam and three projects. Little required group work.",
  "cpsc-323": "Systems programming with heavy problem sets and a large project. Lectures plus lab. Reading is moderate. Two exams. Students may pair on the project.",
  "math-120": "Problem sets three times a week and two exams. Lecture course. Workload is heavy. Almost no group work. Reading is limited to the textbook.",
  "math-225": "Proof-based linear algebra. Weekly problem sets and a final exam. Seminar-style discussion on Fridays. Moderate reading. Independent work.",
  "econ-115": "Lecture course with weekly problem sets and two midterms. Reading is moderate. No group project. A final exam covers the core models.",
  "econ-116": "Lectures and discussion section. Problem sets and two exams. Workload is moderate. A short policy paper is optional. Little group work.",
  "engl-114": "Writing seminar with weekly essays and workshops. Heavy writing, light exams. Discussion-based. One revision portfolio. Peer review is required but graded individually.",
  "engl-129": "Seminar on tragedy. Two papers and a final exam. Reading is heavy. Discussion every meeting. No group project.",
  "hist-135": "Lecture and discussion. Two papers, a midterm, and a final exam. Reading is heavy. A group presentation in week 8.",
  "hist-202": "Seminar with weekly response papers and one long research paper. Reading is heavy. Discussion-based. No exam. Independent research.",
  "psyc-110": "Large lecture with textbook reading and three exams. Workload is moderate. A short lab report. Minimal group work.",
  "psyc-200": "Problem sets in statistics each week and two exams. Lecture format. Moderate workload. Students work independently. A final project analyzes a dataset.",
  "biol-101": "Lectures, weekly problem sets, and a lab. Two exams and a final. Reading is moderate. Lab pairs share equipment but submit separate reports.",
  "chem-161": "Lecture and lab. Heavy problem sets and three exams. Reading is moderate. Lab is done with a partner. A final exam.",
  "phys-170": "Problem sets and three exams. Lectures with a discussion section. Workload is heavy. Independent work. Light reading.",
  "phil-175": "Seminar with short weekly papers and one longer essay. Discussion-based. Reading is moderate. No exam and no group project.",
  "plsc-113": "Lectures and discussion. Two papers, a midterm, and a final exam. Reading is moderate. A group debate in one section meeting.",
  "fren-130": "Language seminar with daily participation, quizzes, and a final exam. Workload is moderate. Conversation practice in pairs. Short writing assignments.",
  "span-140": "Seminar with quizzes, a midterm, and a final exam. Moderate reading and writing. Pair conversation. Attendance is required.",
  "musi-110": "Lectures and listening assignments. Two exams and one concert report. Reading is light. No group project.",
  "eeb-220": "Lecture and field lab. A research project, one paper, and a final exam. Reading is moderate. Field teams of three share data.",
  "arch-101": "Studio course with weekly projects and a final review. Workload is heavy. Critique is discussion-based. Some team models.",
  "eeng-200": "Lectures, weekly problem sets, and a lab project. Two exams. Workload is heavy. Lab partners submit one joint report.",
};

export function mockSyllabus(courseId: string): string | null {
  return MOCK_SYLLABI[courseId] ?? null;
}
