import { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { Users, GraduationCap, Building2, BookOpen } from 'lucide-react';

interface Stats {
  groups: number;
  teachers: number;
  classrooms: number;
  subjects: number;
  schedule_versions: number;
  workload_entries: number;
}

export default function Dashboard() {
  const { t } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [groups, teachers, classrooms, subjects] = await Promise.all([
          apiClient.get<{ id: number }[]>('/groups'),
          apiClient.get<{ id: number }[]>('/teachers'),
          apiClient.get<{ id: number }[]>('/classrooms'),
          apiClient.get<{ id: number }[]>('/subjects'),
        ]);
        setStats({
          groups: groups.length,
          teachers: teachers.length,
          classrooms: classrooms.length,
          subjects: subjects.length,
          schedule_versions: 0,
          workload_entries: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    load();
  }, []);

  const cards = [
    { label: t.dashboardGroups, value: stats?.groups ?? '—', icon: GraduationCap, color: 'text-blue-500' },
    { label: t.dashboardTeachers, value: stats?.teachers ?? '—', icon: Users, color: 'text-green-500' },
    { label: t.dashboardClassrooms, value: stats?.classrooms ?? '—', icon: Building2, color: 'text-orange-500' },
    { label: t.dashboardSubjects, value: stats?.subjects ?? '—', icon: BookOpen, color: 'text-purple-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-museum-text mb-6">{t.dashboardTitle}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-museum-surface border border-museum-border rounded-museum-md p-5">
            <div className="flex items-center justify-between mb-3">
              <c.icon className={`h-6 w-6 ${c.color}`} />
            </div>
            <div className="text-3xl font-bold text-museum-text mb-1">{c.value}</div>
            <div className="text-xs text-museum-text-muted uppercase tracking-wide">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
