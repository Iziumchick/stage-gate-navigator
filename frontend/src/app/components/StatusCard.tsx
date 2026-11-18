import { Activity, Check, Circle } from 'lucide-react';

export function StatusCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Accent line at top */}
      <div className="h-1 bg-gray-300"></div>

      <div className="p-6">
        {/* Header with Icon and Status Circle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-700" />
            <h3 className="text-xl text-gray-900">Mein Status</h3>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-green-600 shadow-sm"></div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Fachsemester:</span>
            <span>4</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Studienabschnitt:</span>
            <span>2</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Durchschnittsnote (gesamt):</span>
            <span>2,97</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">ECTS:</span>
            <span>52 / 210</span>
          </div>

          {/* Progress Bar with Segments */}
          <div className="mt-2 relative">
            <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-hidden">
              <div
                className="bg-green-500 h-2.5 rounded-full"
                style={{ width: `${(52 / 210) * 100}%` }}
              ></div>
              {/* Segment markers - 7 segments for ~30 credits each */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-[1px] bg-white opacity-50"
                  style={{ left: `${(i / 7) * 100}%` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Stage-Gate Overview Table */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <div className="space-y-2.5">
              {/* Column Headers */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500"></span>
                <div className="flex items-center gap-6">
                  <span className="text-xs text-gray-500 w-5 text-center">frei</span>
                  <span className="text-xs text-gray-500 w-5 text-center">abg.</span>
                </div>
              </div>

              {/* Abschnitt 1 */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Abschnitt 1</span>
                <div className="flex items-center gap-6">
                  <Check className="w-5 h-5 text-green-600" />
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                </div>
              </div>

              {/* Abschnitt 2 */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Abschnitt 2</span>
                <div className="flex items-center gap-6">
                  <Check className="w-5 h-5 text-green-600" />
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                </div>
              </div>

              {/* Praxissemester */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Praxissemester</span>
                <div className="flex items-center gap-6">
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                </div>
              </div>

              {/* Abschnitt 3 */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Abschnitt 3</span>
                <div className="flex items-center gap-6">
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                  <Circle className="w-4 h-4 text-gray-300 fill-gray-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
