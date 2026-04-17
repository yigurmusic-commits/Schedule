import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import DataTable from '../components/DataTable';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

interface TeacherSubject {
  id: number;
  teacher_id: number;
  subject_id: number;
  group_id: number;
  subject?: { name: string };
  group?: { name: string };
}

interface Subject { id: number; name: string; }
interface Group { id: number; name: string; }
interface Teacher { id: number; full_name: string; }

export default function TeacherSubjects() {
  const { t } = useLang();
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [links, setLinks] = useState<TeacherSubject[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLink, setNewLink] = useState({ subject_id: 0, group_id: 0 });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [linksData, sData, gData, tData] = await Promise.all([
        apiClient.get<TeacherSubject[]>(`/teachers/${teacherId}/subjects`),
        apiClient.get<Subject[]>('/subjects'),
        apiClient.get<Group[]>('/groups'),
        apiClient.get<Teacher>(`/teachers/${teacherId}`),
      ]);
      setLinks(linksData);
      setSubjects(sData);
      setGroups(gData);
      setTeacher(tData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setNewLink({ 
      subject_id: subjects[0]?.id || 0, 
      group_id: groups[0]?.id || 0 
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(`/teachers/${teacherId}/subjects`, {
        subject_id: Number(newLink.subject_id),
        group_id: Number(newLink.group_id),
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save link:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t.delete + '?')) {
      try {
        await apiClient.delete(`/teacher-subjects/${id}`);
        fetchData();
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    }
  };

  const columns = [
    {
      key: 'subject',
      header: t.subjects,
      render: (l: TeacherSubject) => l.subject?.name || t.noData,
    },
    {
      key: 'group',
      header: t.groups,
      render: (l: TeacherSubject) => l.group?.name || t.noData,
    },
    {
      key: 'actions',
      header: t.actions,
      render: (l: TeacherSubject) => (
        <Button variant="ghost" size="sm" className="text-museum-danger" onClick={() => handleDelete(l.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
      className: 'w-24 text-right',
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/teachers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.back}
        </Button>
        <h1 className="text-2xl font-bold text-museum-text">
          {t.workload}: {teacher?.full_name}
        </h1>
        <div className="flex-1" />
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t.add}
        </Button>
      </div>

      <DataTable columns={columns} data={links} loading={loading} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t.addSubject}>
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label={t.subjects}
            value={newLink.subject_id}
            onChange={(e) => setNewLink({ ...newLink, subject_id: Number(e.target.value) })}
            required
          >
            <option value="">{t.noData}</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select
            label={t.groups}
            value={newLink.group_id}
            onChange={(e) => setNewLink({ ...newLink, group_id: Number(e.target.value) })}
            required
          >
            <option value="">{t.noData}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t.cancel}</Button>
            <Button type="submit" loading={saving}>{t.save}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
