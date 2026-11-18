import { useState } from 'react';
import { ModuleDetails } from '../ModuleDetails';
import { Check, RotateCw, Lock, Clock } from 'lucide-react';

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

interface ModuleCardProps {
  module: Module;
}

const statusStyles = {
  passed: 'bg-gray-100 border-gray-300',
  repeat: 'bg-orange-50 border-orange-400 border-2',
  active: 'bg-green-50 border-green-500 border-2',
  available: 'bg-white border-gray-300',
  locked: 'bg-gray-50 border-gray-300'
};

export function ModuleCard({ module }: ModuleCardProps) {
  const [open, setOpen] = useState(false);
  // Milestone cards are taller
  const heightClass = module.milestone ? 'h-[90px]' : 'h-[60px]';

  return (
    <>
    <button type="button" aria-label={module.name} onClick={() => setOpen(true)} title={module.name} className={`text-left border rounded p-2 ${statusStyles[module.status]} transition-all hover:shadow-sm ${heightClass} flex flex-col justify-between ${module.milestone ? 'col-span-1' : ''}`}>
      {/* Milestone Label if applicable */}
      {module.milestone && module.milestoneLabel && (
        <div className="text-[10px] text-gray-500 mb-1 font-medium">{module.milestoneLabel}</div>
      )}

      {/* Line 1: Short Code + Grade/Checkmark */}
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium">{module.shortCode}</span>
        {module.status === 'passed' && module.grade && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-green-700">{module.grade}</span>
            <Check className="w-3 h-3 text-green-600" />
          </div>
        )}
        {module.status === 'repeat' && (
          <RotateCw className="w-3 h-3 text-orange-600" />
        )}
        {module.status === 'locked' && (
          <Lock className="w-3 h-3 text-gray-400" />
        )}
      </div>

      {/* Line 2: ECTS + Term Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{module.ectsLabel || `${module.ects} ECTS`}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
          module.semester === 'WiSe & SoSe' ? 'bg-purple-100 text-purple-700' :
          module.semester === 'WiSe' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {module.semester}
        </span>
      </div>
    </button>
    {open && <ModuleDetails open onClose={() => setOpen(false)} storageKey={`stage-gate.demo-module:${module.shortCode}`} title={module.name} subtitle={`${module.ectsLabel || `${module.ects} ECTS`} · ${module.semester}`} term="WiSe 2026/27" offeredIn={`${module.semester} (Beispieldaten)`} admission={{ status: module.status === 'locked' ? 'blocked' : 'available', reason: module.status === 'locked' ? 'Beispiel: erforderliche ECTS und Abschluss des vorherigen Abschnitts fehlen.' : 'Beispiel: Zulassungsbedingungen erfüllt.', source: 'Fiktive Demodaten; keine bestätigte Studienordnung' }} passed={module.status === 'passed'}><p className="text-sm text-gray-500">Beispieldaten · Status: {{ passed: 'Bestanden', repeat: 'Wiederholung', active: 'Offen', available: 'Offen', locked: 'Gesperrt' }[module.status]}{module.grade ? ` · Note: ${module.grade}` : ''}</p></ModuleDetails>}
    </>
  );
}
