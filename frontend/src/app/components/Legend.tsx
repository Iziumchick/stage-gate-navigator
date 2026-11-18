import { Check, RotateCw, Lock } from 'lucide-react';

export function Legend() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3">Legende</h3>

      {/* Horizontal layout with multiple rows */}
      <div className="space-y-3">
        {/* Row 1: Module Status Colors */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-50 border-2 border-green-500 rounded flex-shrink-0"></div>
            <span className="text-sm text-gray-700">aktives Modul</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white border border-green-400 rounded flex-shrink-0"></div>
            <span className="text-sm text-gray-700">verfügbar</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-50 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-sm text-gray-700">gesperrt</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-sm text-gray-700">bestanden</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-orange-50 border-2 border-orange-400 rounded flex-shrink-0"></div>
            <span className="text-sm text-gray-700">Wiederholung</span>
          </div>
        </div>

        {/* Row 2: Icons */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">bestanden</span>
          </div>

          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">Wiederholung</span>
          </div>

          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700">gesperrt</span>
          </div>

          {/* Traffic Light Status */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-300">
            <span className="text-sm text-gray-700">Schwierigkeit:</span>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-600">hoch</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
              <span className="text-xs text-gray-600">mittel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600">gut</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
