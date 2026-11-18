import { User, GraduationCap, Calendar } from 'lucide-react';

export function Header() {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between">
        {/* Left: OTH Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-gray-700">OTH Regensburg</span>
        </div>

        {/* Right: Calendar Chip + User */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Heute, 07.12.2024</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">
              SP
            </div>
            <span className="text-gray-700 text-sm">Sergii Puniegov</span>
          </div>
        </div>
      </div>
    </div>
  );
}
