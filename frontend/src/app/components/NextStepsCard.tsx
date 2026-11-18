import { CheckSquare, Calendar, AlertTriangle, Lightbulb } from 'lucide-react';

const nextSteps = [
  { text: 'Prüfungsanmeldung WiSe abschließen (11.11–18.11)', icon: Calendar, color: 'text-blue-600' },
  { text: '5 offene Module aus Abschnitt 1 planen, um Praxissemester freizuschalten', icon: Lightbulb, color: 'text-amber-600' },
  { text: 'Es fehlen 8 ECTS für Zugang zum Praxissemester – Vorschlag: AW 1 und weitere Module belegen', icon: Lightbulb, color: 'text-amber-600' },
  { text: 'Automatische Wiederholung in \'Programmierung 1\' (2. Versuch) beachten', icon: AlertTriangle, color: 'text-red-600' }
];

export function NextStepsCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Accent line at top */}
      <div className="h-1 bg-gray-300"></div>

      <div className="p-6">
        {/* Header with Icon */}
        <div className="flex items-center gap-2 mb-6">
          <CheckSquare className="w-5 h-5 text-gray-700" />
          <h3 className="text-xl text-gray-900">Nächste Schritte</h3>
        </div>

        <div className="space-y-2.5">
          {nextSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-2.5 hover:bg-gray-50 p-2 -ml-2 rounded transition-colors cursor-pointer"
              >
                <Icon className={`w-4 h-4 ${step.color} flex-shrink-0 mt-0.5`} />
                <span className="text-gray-700 text-sm leading-tight">{step.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
