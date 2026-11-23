export interface AuthUser { id: number; email: string; name: string; role: 'student' | 'admin'; privacy_version?:string|null; email_verified?:boolean }
export class APIError extends Error { constructor(message: string, public status: number) { super(message); } }
export interface Admission {
  status: 'available' | 'blocked' | 'unknown' | 'completed';
  reason: string;
  source?: string;
}
export interface MilestonePlanning {
  status: 'available' | 'blocked' | 'completed';
  kind: 'practice' | 'practice_seminar' | 'thesis' | 'thesis_seminar';
  reason: string;
  registration_note: string;
  steps: string[];
  info_url: string;
  source: string;
}
export interface ModuleInfo {
  completion_rule?: 'single' | 'all' | 'one' | 'catalog';
  stage_id?: string;
  linked_courses?: { id: string; title: string }[];
  composite_group?: { title: string; ects: number; completed: boolean; grade?: string | null; children: { id: string; title: string; ects: number; status: string; grade: string | null }[] };
  reference_handbook?: { url?: string | null; label?: string };
  description_pdf?: string | null;
  description?: string | null;
  aw_components?: {title:string;ects:number;kind:string}[];
  components?: { title: string; ects: number; grade_fraction?: string; grade_weight_as_printed?: string; status?: string; grade?: string | null }[];
  offered_in?: string | null;
  grade_weight?: string | null;
  handbook?: { url?: string | null; label?: string; pages?: { start: number; end?: number } | null };
}
export interface SemesterCourse {
  elo?: string; webuntis?: string; schedule?: string; room?: string;
  meetings?: { weekday: number; start: string; end: string; room: string; group: string; teachers?: string[]; recurrence?: 'weekly' | 'unconfirmed'; recurrence_note?:string; dates?:string[]; shared_with?:string[]; component_titles?:string[] }[];
}
export interface CourseOption {
  ects?: number; id: string; title: string; short_title: string; catalog_status: string; source_term: string;
  notice?: string; section_verified: boolean; course?: SemesterCourse & { offered?: boolean | null }; details?: ModuleInfo;
}
export interface ImportItem {
  id: number;
  created_at: string | null;
  uploaded_at?: string | null;
  degree_program_raw: string | null;
  status: string;
}
export interface ExamAttempt {
  code:string; short_code:string; title:string; attempt:number; grade:number|null; ects:number|null; status:string; released_on:string|null;
}
export interface ImportReportSummary {
  format:string; module_count:number; attempt_count:number; open_exam_count:number; historical_failure_count:number; warnings:string[];
}
export interface SourceGroup {
  requirement_title: string;
  requirement_meta: { ects: number | null; grade_val: string | null };
  subs: { title: string; ects: number | null; grade_val: string | null }[];
}
export interface DashboardModule {
  id: string;
  title: string;
  short_title: string;
  required_ects: number;
  credited_ects?:number; completion_pending?:boolean; result_status?:string; credit_hold_reason?:string;
  actual_ects: number | null;
  grade: string | null;
  status: 'passed' | 'failed' | 'review' | 'unknown';
  source: SourceGroup | null;
  exam_history?: ExamAttempt[];
  open_exam_count?: number;
  planning?: MilestonePlanning;
  details?: ModuleInfo;
  course?: SemesterCourse;
  course_options?: CourseOption[];
  requires_course_selection?: boolean;
  completion_rule?: 'single' | 'all' | 'one' | 'catalog';
  actual_course_title?: string;
  semester_offered?: boolean;
  mapping_notes?: string[];
  admission?: Admission;
}
export interface DashboardData {
  semester_calendar?:import('./SemesterCalendarEditor').SemesterCalendar;
  progress?:{gates?:{id:string;minimum_ects:number;scope:'first'|'total';all_first:boolean}[];confirmed_ects:number;milestones:{id:string;title:string;available:boolean;completed:boolean;reason:string}[]};
  import_id: number | null;
  import_report?:ImportReportSummary|null;
  example_scenario?: string;
  example_label?: string;
  example_start_term?: string;
  program: string | null;
  supported: boolean;
  official_grade: number | null;
  official_credits: number | null;
  spo_version: string | null;
  curriculum_edition?: string | null;
  semester_data_configured?: boolean;
  stages: { access?:{status:'available'|'blocked';reason?:string}; id: string; title: string; modules: DashboardModule[] }[];
  unmatched_groups: SourceGroup[];
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { const headers = new Headers(init?.headers); if (init?.method && !['GET', 'HEAD'].includes(init.method)) headers.set('X-Requested-With', 'StudyNavigator'); response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' }); }
  catch { throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth-expired'));
    throw new APIError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg || 'Ungültige Angabe').join('; ') : detail?.message || `Anfrage fehlgeschlagen (${response.status}).`, response.status);
  }
  if (body === null) throw new Error('Unerwartete Serverantwort. Bitte Backend prüfen.');
  return body as T;
}
