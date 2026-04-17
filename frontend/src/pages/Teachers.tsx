import React, { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import DataTable from '../components/DataTable';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import CsvImportButton from '../components/ui/CsvImportButton';
import { Plus, Pencil, Trash2, Library } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Teacher {
  id: number;
  full_name: string;
  employment_type: string;
  max_hours_per_week: number | null;
  department_id: number | null;
  department?: { name: string };
}

interface Department {
  id: number;
  name: string;
}

export default function Teachers() {
  const { t } = useLang();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<Partial<Teacher> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersData, deptsData] = await Promise.all([
        apiClient.get<Teacher[]>('/teachers'),
        apiClient.get<Department[]>('/departments'),
      ]);
      setTeachers(teachersData);
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
    setCurrentTeacher({
      full_name: '',
      employment_type: 'штатный',
      max_hours_per_week: 18,
      department_id: null,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t.confirmDeleteTeacher)) {
      try {
        await apiClient.delete(`/teachers/${id}`);
        fetchData();
      } catch (error) {
        console.error('Failed to delete teacher:', error);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeacher?.full_name) return;

    setSaving(true);
    try {
      const payload = {
        full_name: currentTeacher.full_name,
        employment_type: currentTeacher.employment_type,
        max_hours_per_week: currentTeacher.max_hours_per_week ? Number(currentTeacher.max_hours_per_week) : null,
        department_id: currentTeacher.department_id ? Number(currentTeacher.department_id) : null,
      };
      if (currentTeacher.id) {
        await apiClient.put(`/teachers/${currentTeacher.id}`, payload);
      } else {
        await apiClient.post('/teachers', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save teacher:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'full_name', header: t.teacherFullName },
    {
      key: 'department',
      header: t.teacherDepartment,
      render: (teacher: Teacher) => teacher.department?.name || t.teacherNoDepartment,
    },
    { key: 'employment_type', header: t.teacherEmploymentType, className: 'w-32' },
    { key: 'max_hours_per_week', header: t.teacherMaxHoursShort, className: 'w-24 text-center' },
    {
      key: 'actions',
      header: t.actions,
      render: (teacher: Teacher) => (
        <div className="flex gap-2">
          <Link to={`/admin/teacher-subjects/${teacher.id}`}>
            <Button variant="ghost" size="sm" title={t.teacherWorkloadBtn}>
              <Library className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(teacher)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-museum-danger" onClick={() => handleDelete(teacher.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'w-32 text-right',
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-museum-text">{t.teachersTitle}</h1>
        <div className="flex gap-2">
          <CsvImportButton endpoint="/teachers/import-csv" onSuccess={fetchData} />
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t.addTeacher}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={teachers} loading={loading} />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentTeacher?.id ? t.editTeacher : t.addTeacher}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t.teacherFullName}
            value={currentTeacher?.full_name || ''}
            onChange={(e) => setCurrentTeacher({ ...currentTeacher, full_name: e.target.value })}
            placeholder={t.teacherFullNamePlaceholder}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t.teacherEmploymentType}
              value={currentTeacher?.employment_type || 'штатный'}
              onChange={(e) => setCurrentTeacher({ ...currentTeacher, employment_type: e.target.value })}
              required
            >
              <option value="штатный">{t.teacherFullTime}</option>
              <option value="почасовой">{t.teacherPartTime}</option>
            </Select>
            <Input
              label={t.teacherMaxHoursShort}
              type="number"
              min="1"
              max="100"
              value={currentTeacher?.max_hours_per_week || 18}
              onChange={(e) => setCurrentTeacher({ ...currentTeacher, max_hours_per_week: Number(e.target.value) })}
            />
          </div>
          <Select
            label={t.teacherDepartment}
            value={currentTeacher?.department_id || ''}
            onChange={(e) => setCurrentTeacher({ ...currentTeacher, department_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{t.teacherNoDepartment}</option>
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
