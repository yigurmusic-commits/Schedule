import React, { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import DataTable from '../components/DataTable';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Department {
  id: number;
  name: string;
}

export default function Departments() {
  const { t } = useLang();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDept, setCurrentDept] = useState<Partial<Department> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Department[]>('/departments');
      setDepartments(data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = () => {
    setCurrentDept({ name: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (dept: Department) => {
    setCurrentDept(dept);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t.confirmDeleteDepartment)) {
      try {
        await apiClient.delete(`/departments/${id}`);
        fetchDepartments();
      } catch (error) {
        console.error('Failed to delete department:', error);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDept?.name) return;

    setSaving(true);
    try {
      if (currentDept.id) {
        await apiClient.put(`/departments/${currentDept.id}`, { name: currentDept.name });
      } else {
        await apiClient.post('/departments', { name: currentDept.name });
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (error) {
      console.error('Failed to save department:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', header: t.departmentName },
    {
      key: 'actions',
      header: t.actions,
      render: (dept: Department) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(dept)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-museum-danger" onClick={() => handleDelete(dept.id)}>
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
        <h1 className="text-2xl font-bold text-museum-text">{t.departmentsTitle}</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t.addDepartment}
        </Button>
      </div>

      <DataTable columns={columns} data={departments} loading={loading} />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentDept?.id ? t.editDepartment : t.addDepartment}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label={t.departmentName}
            value={currentDept?.name || ''}
            onChange={(e) => setCurrentDept({ ...currentDept, name: e.target.value })}
            placeholder={t.departmentNamePlaceholder}
            required
          />
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
