import { MeetingList } from './MeetingList';
import type { CatalogCourse, ModuleGroup, Semester } from './CatalogEditor';

const stages = [
  { id: 'abschnitt_1', title: 'Abschnitt 1' },
  { id: 'abschnitt_2', title: 'Abschnitt 2' },
  { id: 'abschnitt_3', title: 'Abschnitt 3' },
];

/** Inspect the semester offer through its existing Modul → Teilmodul hierarchy. */
export function SemesterTimetable({ courses, groups, semester }: {
  courses: Record<string, CatalogCourse>;
  groups: ModuleGroup[];
  semester: Semester;
}) {
  return <div role="group" aria-label="Stundenplan nach Studienabschnitt" className="grid grid-cols-3 gap-4 mt-5 items-start">
    {stages.map(stage => <section key={stage.id} aria-label={`Stundenplan ${stage.title}`} className="min-w-0">
      <h4 className="text-base font-medium border-b pb-3 mb-3">{stage.title}</h4>
      <div className="space-y-2">{groups.filter(group => group.stage_id === stage.id).map(group => {
        const members = group.teilmodule_ids.map(id => courses[id]).filter(Boolean);
        if (!members.length) return null;
        const choice = group.completion_rule === 'catalog' || group.completion_rule === 'one';
        const nested = choice || members.length > 1 || stage.id === 'abschnitt_3';
        const title = group.completion_rule === 'catalog' ? group.short_title : group.title;
        return <details key={group.id} data-testid={`schedule-module-${group.id}`} className="border rounded-lg bg-white">
          <summary className="cursor-pointer text-sm p-3 leading-relaxed break-words">{title}</summary>
          <div className="px-3 pb-3 space-y-2">{members.map(course => {
            const value = semester.modules[course.id];
            const meetings = <MeetingList meetings={value?.meetings} fallback={value?.schedule} room={value?.room} />;
            return nested ? <details key={course.id} data-course-id={course.id} className="border rounded-lg">
              <summary className="cursor-pointer text-sm p-3 leading-relaxed break-words">{course.title}</summary>
              <div className="px-3 pb-3">{meetings}</div>
            </details> : <div key={course.id} data-course-id={course.id}>{meetings}</div>;
          })}</div>
        </details>;
      })}</div>
    </section>)}
  </div>;
}
