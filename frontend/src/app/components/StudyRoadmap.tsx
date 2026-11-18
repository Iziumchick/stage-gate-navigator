import { ModuleCard } from './ModuleCard';
import { Lock } from 'lucide-react';

interface Module {
  name: string;
  shortCode: string;
  ects: number;
  semester: 'WiSe' | 'SoSe' | 'WiSe & SoSe';
  status: 'passed' | 'repeat' | 'active' | 'available' | 'locked';
  grade?: string;
  milestone?: boolean;
  milestoneLabel?: string;
  ectsLabel?: string;
}

// Helper function to sort modules by priority
function sortModulesByPriority(modules: Module[]): Module[] {
  const priorityOrder = {
    repeat: 1,
    active: 2,
    available: 3,
    passed: 4,
    locked: 5
  };

  return [...modules].sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status]);
}

export const stages = [
  {
    title: 'Abschnitt 1',
    progress: { current: 38, total: 60, label: 'freigeschaltet', locked: false },
    twoColumn: true,
    modules: sortModulesByPriority([
      { name: 'Mathematik 1', shortCode: 'M1', ects: 7, semester: 'WiSe & SoSe' as const, status: 'passed' as const, grade: '2,7' },
      { name: 'Mathematik 2', shortCode: 'M2', ects: 7, semester: 'WiSe & SoSe' as const, status: 'active' as const },
      { name: 'Programmierung 1', shortCode: 'PG1', ects: 8, semester: 'WiSe & SoSe' as const, status: 'repeat' as const },
      { name: 'Programmierung 2', shortCode: 'PG2', ects: 8, semester: 'WiSe & SoSe' as const, status: 'active' as const },
      { name: 'BWL 1', shortCode: 'BWL1', ects: 5, semester: 'WiSe & SoSe' as const, status: 'passed' as const, grade: '2,3' },
      { name: 'BWL 2', shortCode: 'BWL2', ects: 7, semester: 'WiSe & SoSe' as const, status: 'passed' as const, grade: '3,0' },
      { name: 'Grundlagen der Wirtschaftsinformatik', shortCode: 'GWI', ects: 8, semester: 'WiSe & SoSe' as const, status: 'passed' as const, grade: '2,0' },
      { name: 'Hardware-Grundlagen', shortCode: 'HW', ects: 5, semester: 'WiSe & SoSe' as const, status: 'passed' as const, grade: '3,3' },
      { name: 'Anwendungsorientierte Grundlagen der WI', shortCode: 'AGWI', ects: 3, semester: 'WiSe & SoSe' as const, status: 'available' as const },
      { name: 'AW 1', shortCode: 'AW1', ects: 2, semester: 'WiSe & SoSe' as const, status: 'available' as const },
    ])
  },
  {
    title: 'Abschnitt 2',
    progress: { current: 14, total: 61, label: 'freigeschaltet', locked: false },
    twoColumn: true,
    modules: sortModulesByPriority([
      { name: 'Statistik', shortCode: 'STAT', ects: 5, semester: 'WiSe & SoSe' as const, status: 'active' as const },
      { name: 'Wahlpflichtmodul 1', shortCode: 'WPM1', ects: 5, semester: 'WiSe & SoSe' as const, status: 'available' as const },
      { name: 'Software Engineering', shortCode: 'SE', ects: 8, semester: 'WiSe' as const, status: 'passed' as const, grade: '2,7' },
      { name: 'Produktionsplanung und -steuerung', shortCode: 'PR', ects: 7, semester: 'SoSe' as const, status: 'available' as const },
      { name: 'Datenbanken', shortCode: 'DB', ects: 7, semester: 'SoSe' as const, status: 'available' as const },
      { name: 'Geschäftsprozessanalyse und -design', shortCode: 'GP', ects: 7, semester: 'WiSe' as const, status: 'passed' as const, grade: '2,7' },
      { name: 'Algorithmen und Datenstrukturen', shortCode: 'AD', ects: 5, semester: 'SoSe' as const, status: 'available' as const },
      { name: 'IT-Architektur', shortCode: 'ITA', ects: 5, semester: 'SoSe' as const, status: 'available' as const },
      { name: 'Betriebssysteme', shortCode: 'BS', ects: 5, semester: 'WiSe' as const, status: 'available' as const },
      { name: 'Projektmanagement', shortCode: 'PM', ects: 5, semester: 'WiSe' as const, status: 'available' as const },
      { name: 'AW 2', shortCode: 'AW2', ects: 2, semester: 'SoSe' as const, status: 'available' as const },
    ])
  },
  {
    title: 'Praxissemester',
    progress: { current: 0, total: 29, label: 'gesperrt, 90 Credits', locked: true },
    twoColumn: false,
    modules: sortModulesByPriority([
      { name: 'Praktikum im Betrieb + Praxisseminar', shortCode: 'PRAX + PSEM', ects: 26, semester: 'WiSe & SoSe' as const, status: 'locked' as const, milestone: true, milestoneLabel: 'Meilenstein – Praxissemester', ectsLabel: '24 + 2 ECTS' },
      { name: 'Seminar WI', shortCode: 'SWI', ects: 3, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
    ])
  },
  {
    title: 'Abschnitt 3 / Abschluss',
    progress: { current: 0, total: 60, label: 'gesperrt, Abschnitt 1 + 100 Credits', locked: true },
    twoColumn: true,
    modules: sortModulesByPriority([
      { name: 'Vertiefungsmodul IN 1', shortCode: 'VIN1', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul IN 2', shortCode: 'VIN2', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul IW 1', shortCode: 'VIW1', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul IW 3', shortCode: 'VIW3', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul BWL 2', shortCode: 'VB2', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul BWL 1', shortCode: 'VB1', ects: 5, semester: 'WiSe' as const, status: 'locked' as const },
      { name: 'Vertiefungsmodul IW 2', shortCode: 'VIW2', ects: 5, semester: 'WiSe' as const, status: 'locked' as const },
      { name: 'Wahlpflichtmodul 2', shortCode: 'WPM2', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Wahlpflichtmodul 3', shortCode: 'WPM3', ects: 5, semester: 'WiSe & SoSe' as const, status: 'locked' as const },
      { name: 'Bachelorarbeit + Bachelorseminar', shortCode: 'BA + BSEM', ects: 15, semester: 'WiSe & SoSe' as const, status: 'locked' as const, milestone: true, milestoneLabel: 'Meilenstein – Abschluss', ectsLabel: '12 + 3 ECTS' },
    ])
  }
];

export function StudyRoadmap() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Accent line at top */}
      <div className="h-1 bg-gray-300"></div>

      <div className="p-6">
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr 0.6fr 1fr' }}>
          {stages.map((stage, stageIndex) => (
            <div key={stageIndex} className="space-y-3">
              {/* Stage Header with Lock Icon if Locked */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg text-gray-800">{stage.title}</h3>
                  {stage.progress.locked && <Lock className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">
                    {stage.progress.current} / {stage.progress.total} ECTS
                    {stage.progress.label && ` (${stage.progress.label})`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      stage.progress.locked ? 'bg-gray-400' : 'bg-green-500'
                    }`}
                    style={{ width: `${(stage.progress.current / stage.progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Module Cards */}
              <div className={stage.twoColumn ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {stage.modules.map((module, moduleIndex) => (
                  <ModuleCard key={moduleIndex} module={module} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
