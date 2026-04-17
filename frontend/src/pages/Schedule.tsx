import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { Play, Download, Trash2, CheckCircle, Globe, Archive, Filter, Info, MapPin, Users, Clock, AlertTriangle, ExternalLink } from 'lucide-react';

interface Semester { id: number; number: number; academic_year?: { name: string } }
interface Version { id: number; status: string; created_at: string; description: string | null }
interface Group { id: number; name: string }
interface Subject { id: number; name: string }
interface ScheduleEntry {
  id: number;
  day_of_week: number;
  time_slot_number: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string;
  classroom_name: string;
  week_type: string;
  lesson_type: string;
  is_locked: boolean;
}
interface GenResult {
  version_id: number;
  placed_count: number;
  total_count: number;
  unplaced: { group: string; subject: string; teacher: string; lesson_type: string; reason: string }[];
  warnings: string[];
}

export default function Schedule() {
  const { t, lang } = useLang();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSem, setSelectedSem] = useState<number | ''>('');
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<number | ''>('');
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genResult, setGenResult] = useState<GenResult | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sems, grps, subs] = await Promise.all([
        apiClient.get<Semester[]>('/semesters'),
        apiClient.get<Group[]>('/groups'),
        apiClient.get<Subject[]>('/subjects'),
      ]);
      setSemesters(sems);
      setGroups(grps);
      setSubjects(subs);
      if (sems.length > 0) setSelectedSem(sems[0].id);
    } catch {
      console.error('Failed to fetch initial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSem) {
      apiClient.get<Version[]>(`/schedule/versions?semester_id=${selectedSem}`).then(vList => {
        setVersions(vList);
        if (vList.length > 0 && !selectedVersionId) {
          setSelectedVersionId(vList[0].id);
        }
      }).catch(() => {});
    } else {
      setVersions([]);
      setSelectedVersionId(null);
    }
  }, [selectedSem, selectedVersionId]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!selectedVersionId) {
        setEntries([]);
        return;
      }
      let url = `/schedule/versions/${selectedVersionId}/entries/detailed?`;
      if (selectedGroup) url += `group_id=${selectedGroup}&`;
      if (selectedSubject) url += `subject_id=${selectedSubject}&`;
      
      try {
        const data = await apiClient.get<ScheduleEntry[]>(url);
        setEntries(data);
      } catch (e) {
        console.error('Failed to fetch entries:', e);
      }
    };
    fetchEntries();
  }, [selectedVersionId, selectedGroup, selectedSubject]);

  const handleGenerate = async () => {
    if (!selectedSem) return;
    setGenerating(true);
    try {
      const result = await apiClient.post<GenResult>(`/schedule/generate`, {
        semester_id: selectedSem,
        description: `Generated on ${new Date().toLocaleString()}`
      });
      setGenResult(result);
      setShowGenModal(true);
      
      const up = await apiClient.get<Version[]>(`/schedule/versions?semester_id=${selectedSem}`);
      setVersions(up);
      setSelectedVersionId(result.version_id);
    } catch {
      alert(t.errorGenerate);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await apiClient.put(`/schedule/versions/${id}`, { status });
      const up = await apiClient.get<Version[]>(`/schedule/versions?semester_id=${selectedSem}`);
      setVersions(up);
    } catch {
      alert(t.errorChangeStatus);
    }
  };

  const handleExport = async (id: number) => {
    setExporting(true);
    try {
      const blob = await apiClient.fetchBlob(`/schedule/versions/${id}/export`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_v${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert(t.errorExport);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t.confirmDeleteVersion)) {
      try {
        await apiClient.delete(`/schedule/versions/${id}`);
        setVersions(versions.filter(v => v.id !== id));
      } catch {
        alert(t.error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-museum-text">{t.scheduleTitle}</h1>
          <p className="text-sm text-museum-text-muted">{t.scheduleSubtitle}</p>
        </div>
        <Button onClick={handleGenerate} loading={generating} disabled={!selectedSem}>
          <Play className="h-4 w-4 mr-2" />
          {t.generateSchedule}
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center p-12 text-museum-accent animate-pulse">
          <Clock className="h-8 w-8" />
        </div>
      )}

      <div className="bg-museum-surface border border-museum-border rounded-museum-md p-6 shadow-sm overflow-visible relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Select
              label={t.semesterLabel}
              value={selectedSem}
              onChange={(e) => {
                setSelectedSem(Number(e.target.value));
                setSelectedVersionId(null);
              }}
            >
              <option value="">{t.selectSemester}</option>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>
                  {s.academic_year?.name} - {s.number} {t.semSuffix}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              label={t.versionN}
              value={selectedVersionId || ''}
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              disabled={versions.length === 0}
            >
              <option value="">{versions.length === 0 ? t.noData : t.open}</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  v{v.id} ({v.status}) - {new Date(v.created_at).toLocaleDateString()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              label={t.groupFilter}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{t.allGroups}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div>
            <Select
              label={t.subjectFullName}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{t.all}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>

        {selectedVersionId && (
          <div className="mt-6 pt-6 border-t border-museum-border flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-auto">
              {versions.find(v => v.id === selectedVersionId) && (
                <>
                  <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                    versions.find(v => v.id === selectedVersionId)?.status === 'published' ? 'bg-museum-success/10 text-museum-success' :
                    versions.find(v => v.id === selectedVersionId)?.status === 'approved' ? 'bg-blue-100 text-blue-600' : 'bg-museum-bg text-museum-text-secondary'
                  }`}>
                    {versions.find(v => v.id === selectedVersionId)?.status === 'published' ? t.statusPublished : 
                     versions.find(v => v.id === selectedVersionId)?.status === 'approved' ? t.statusApproved : 
                     versions.find(v => v.id === selectedVersionId)?.status === 'archived' ? t.statusArchive : t.statusDraft}
                  </span>
                  <span className="text-xs text-museum-text-muted">
                    {new Date(versions.find(v => v.id === selectedVersionId)!.created_at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'kk-KZ')}
                  </span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleExport(selectedVersionId)} loading={exporting}>
                <Download className="h-4 w-4 mr-2" />
                {t.exportExcel}
              </Button>
              
              {versions.find(v => v.id === selectedVersionId)?.status === 'generated' && (
                <Button variant="ghost" size="sm" onClick={() => updateStatus(selectedVersionId, 'approved')}>
                  <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                  {t.approve}
                </Button>
              )}

              {versions.find(v => v.id === selectedVersionId)?.status === 'approved' && (
                <Button variant="ghost" size="sm" onClick={() => updateStatus(selectedVersionId, 'published')}>
                  <Globe className="h-4 w-4 mr-2 text-museum-success" />
                  {t.publish}
                </Button>
              )}

              {versions.find(v => v.id === selectedVersionId)?.status === 'published' && (
                <Button variant="ghost" size="sm" onClick={() => updateStatus(selectedVersionId, 'archived')}>
                  <Archive className="h-4 w-4 mr-2" />
                  {t.toArchive}
                </Button>
              )}

              <Button variant="ghost" size="sm" className="text-museum-danger hover:bg-museum-danger-soft" onClick={() => handleDelete(selectedVersionId)}>
                <Trash2 className="h-4 w-4" />
              </Button>

              <a 
                href={`/classrooms`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-museum-text-secondary hover:text-museum-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {t.checkFreeClassrooms}
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-museum-text">{t.scheduleVersions}</h2>
          <div className="flex items-center gap-2 text-xs text-museum-text-muted">
            <Filter className="h-3 w-3" />
            {entries.length} {t.lessons}
          </div>
        </div>

        {!selectedVersionId ? (
          <div className="flex flex-col items-center justify-center py-20 bg-museum-surface border border-dashed border-museum-border rounded-museum-md text-museum-text-muted">
            <Info className="h-12 w-12 mb-4 opacity-20" />
            <p className="max-w-xs text-center">{t.selectSemesterHint}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 bg-museum-surface border border-museum-border rounded-museum-md">
            <p className="text-museum-text font-bold text-lg">{t.noEntriesForDisplay}</p>
            <p className="text-sm text-museum-text-muted mt-2">{t.tryAnotherGroup}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((dayNum) => {
              const dayLessons = entries
                .filter(s => s.day_of_week === dayNum)
                .sort((a, b) => a.time_slot_number - b.time_slot_number);
              
              if (dayLessons.length === 0) return null;
              
              const dayNames = [t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
              
              return (
                <div key={dayNum} className="bg-museum-surface border border-museum-border rounded-museum-md overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-museum-accent px-4 py-2 text-white font-bold uppercase tracking-wider text-sm flex justify-between items-center">
                    <span>{dayNames[dayNum-1]}</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">{dayLessons.length}</span>
                  </div>
                  <div className="divide-y divide-museum-border/40 flex-1">
                    {dayLessons.map((l, i) => (
                      <div key={i} className={`p-4 hover:bg-museum-surface-hover transition-colors ${l.is_locked ? 'bg-museum-bg/30' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-museum-accent bg-museum-accent-soft px-2 py-0.5 rounded">
                            {l.time_slot_number} {t.pair}
                          </span>
                          <span className="text-[10px] text-museum-text-muted font-bold font-mono flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {l.start_time} - {l.end_time}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-museum-text mb-1 leading-tight line-clamp-2 min-h-[2.5rem]">
                          {l.subject_name}
                        </h3>
                        <div className="space-y-1.5">
                          <p className="text-xs text-museum-text-secondary flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-museum-text-muted" /> {l.teacher_name}
                          </p>
                          <p className="text-xs text-museum-text-secondary flex items-center gap-1.5 font-bold">
                            <MapPin className="h-3 w-3 text-museum-text-accent" /> {l.classroom_name}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-1.5">
                            {l.week_type !== 'обе' && (
                              <span className="text-[9px] font-bold uppercase py-0.5 px-1.5 bg-museum-surface-light border border-museum-border rounded">
                                {l.week_type === 'числитель' ? t.weekNumerator : t.weekDenominator}
                              </span>
                            )}
                            <span className="text-[9px] font-bold uppercase py-0.5 px-1.5 bg-museum-accent-soft text-museum-accent border border-museum-accent/20 rounded">
                              {l.lesson_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Results Modal */}
      <Modal 
        isOpen={showGenModal} 
        onClose={() => setShowGenModal(false)} 
        title={t.statusGenerated}
        size="lg"
      >
        {genResult && (
          <div className="space-y-6">
            <div className="flex items-center justify-around p-6 bg-museum-accent/5 border border-museum-accent/10 rounded-museum-md">
              <div className="text-center">
                <div className="text-3xl font-black text-museum-accent">{genResult.placed_count}</div>
                <div className="text-[10px] uppercase font-bold text-museum-text-muted tracking-wider">{t.placed}</div>
              </div>
              <div className="h-10 w-[1px] bg-museum-border" />
              <div className="text-center">
                <div className="text-3xl font-black text-museum-text">{genResult.total_count}</div>
                <div className="text-[10px] uppercase font-bold text-museum-text-muted tracking-wider">{t.all}</div>
              </div>
              <div className="h-10 w-[1px] bg-museum-border" />
              <div className="text-center">
                <div className={`text-3xl font-black ${genResult.unplaced.length > 0 ? 'text-museum-danger' : 'text-museum-success'}`}>
                  {genResult.unplaced.length}
                </div>
                <div className="text-[10px] uppercase font-bold text-museum-text-muted tracking-wider">{t.unplacedLessons}</div>
              </div>
            </div>

            {genResult.unplaced.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-museum-danger flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t.unplacedLessons}
                </h3>
                <div className="max-h-60 overflow-y-auto border border-museum-border rounded-museum-md">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-museum-bg text-museum-text-muted uppercase text-[9px] font-bold">
                      <tr>
                        <th className="px-3 py-2">{t.dashboardGroups}</th>
                        <th className="px-3 py-2">{t.dashboardSubjects}</th>
                        <th className="px-3 py-2">{t.dashboardTeachers}</th>
                        <th className="px-3 py-2">{t.dashboardClassrooms} / {t.statusDraft}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-museum-border">
                      {genResult.unplaced.map((u, i) => (
                        <tr key={i} className="hover:bg-museum-surface-hover">
                          <td className="px-3 py-2 font-bold">{u.group}</td>
                          <td className="px-3 py-2">{u.subject} ({u.lesson_type})</td>
                          <td className="px-3 py-2">{u.teacher}</td>
                          <td className="px-3 py-2 text-museum-danger">{u.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {genResult.warnings.length > 0 && (
              <div className="space-y-2 p-4 bg-yellow-50 border border-yellow-100 rounded-museum-md">
                <h4 className="text-xs font-bold text-yellow-700 uppercase flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Предупреждения
                </h4>
                <ul className="text-xs text-yellow-600 list-disc list-inside space-y-1">
                  {genResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <Button className="w-full" onClick={() => setShowGenModal(false)}>
              {t.close}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
