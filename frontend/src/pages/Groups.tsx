import React, { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import DataTable from '../components/DataTable';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import CsvImportButton from '../components/ui/CsvImportButton';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Group {
  id: number;
  name: string;
  course: number;
  department_id: number;
  student_count: number;
  department?: { name: string };
}

interface Department {
  id: number;
  name: string;
}

export default function Groups() {
  const { t } = useLang();
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Partial<Group> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsData, deptsData] = await Promise.all([
        apiClient.get<Group[]>('/groups'),
        apiClient.get<Department[]>('/departments'),
      ]);
      setGroups(groupsData);
      setDepartments(deptsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setCurrentGroup({ name: '', course: 1, department_id: departments[0]?.id, student_count: 25 });
    setIsModalOpen(true);
  };

  const handleEdit = (group: Group) => {
    setCurrentGroup(group);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t.confirmDeleteGroup)) {
      try {
        await apiClient.delete(`/groups/${id}`);
        fetchData();
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup?.name || !currentGroup?.department_id) return;

    setSaving(true);
    try {
      const payload = {
        name: currentGroup.name,
        course: Number(currentGroup.course),
        department_id: Number(currentGroup.department_id),
        student_count: Number(currentGroup.student_count),
      };
      if (currentGroup.id) {
        await apiClient.put(`/groups/${currentGroup.id}`, payload);
      } else {
        await apiClient.post('/groups', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save group:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', header: t.groupName },
    { key: 'course', header: t.groupCourse, className: 'w-20' },
    {
      key: 'department',
      header: t.groupDepartment,
      render: (g: Group) => g.department?.name || t.noData,
    },
    { key: 'student_count', header: t.groupStudentCount, className: 'w-24 text-center' },
    {
      key: 'actions',
      header: t.actions,
      render: (g: Group) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-museum-danger" onClick={() => handleDelete(g.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'w-24 text-right',
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-museum-text">{t.groupsTitle}</h1>
        <div className="flex gap-2">
          <CsvImportButton endpoint="/groups/import-csv" onSuccess={fetchData} />
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t.addGroup}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={groups} loading={loading} />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentGroup?.id ? t.editGroup : t.addGroup}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t.groupName}
            value={currentGroup?.name || ''}
            onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
            placeholder="П-21-1"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.groupCourse}
              type="number"
              min="1"
              max="4"
              value={currentGroup?.course || 1}
              onChange={(e) => setCurrentGroup({ ...currentGroup, course: Number(e.target.value) })}
              required
            />
            <Input
              label={t.groupStudentCount}
              type="number"
              min="1"
              max="100"
              value={currentGroup?.student_count || 25}
              onChange={(e) => setCurrentGroup({ ...currentGroup, student_count: Number(e.target.value) })}
              required
            />
          </div>
          <Select
            label={t.groupDepartment}
            value={currentGroup?.department_id || ''}
            onChange={(e) => setCurrentGroup({ ...currentGroup, department_id: Number(e.target.value) })}
            required
          >
            <option value="">{t.groupSelectDepartment}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {t.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
