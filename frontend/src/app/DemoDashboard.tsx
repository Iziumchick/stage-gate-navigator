import { StatusCard } from './components/StatusCard';
import { CurrentSemesterCard } from './components/CurrentSemesterCard';
import { NextStepsCard } from './components/NextStepsCard';
import { StudyRoadmap } from './components/StudyRoadmap';
import { Legend } from './components/Legend';

export default function DemoDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">


      {/* Top Dashboard Area */}
      <div className="max-w-[1920px] mx-auto px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl">Sergii Puniegov – Wirtschaftsinformatik (B.Sc.)</h1>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <StatusCard />
          <CurrentSemesterCard />
          <NextStepsCard />
        </div>

        {/* Study Roadmap */}
        <StudyRoadmap />

        {/* Legend */}
        <div className="mt-6">
          <Legend />
        </div>
      </div>
    </div>
  );
}
