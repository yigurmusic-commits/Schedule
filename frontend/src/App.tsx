import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './layouts/AdminLayout';
import PublicLayout from './layouts/PublicLayout';
import ThemeSwitcher from './components/ThemeSwitcher';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicSchedule from './pages/PublicSchedule';
import ClassroomAvailability from './pages/ClassroomAvailability';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Teachers from './pages/Teachers';
import Groups from './pages/Groups';
import Subjects from './pages/Subjects';
import Classrooms from './pages/Classrooms';
import Departments from './pages/Departments';
import Semesters from './pages/Semesters';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import TeacherSubjects from './pages/TeacherSubjects';
import StudentDashboard from './pages/StudentDashboard';
import StudentSchedule from './pages/StudentSchedule';
import TeacherDashboard from './pages/TeacherDashboard';

function AppRoutes() {
  const { user, loading, isAdmin, isDispatcher, isManagement } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-museum-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-museum-accent border-t-transparent" />
      </div>
    );
  }

  const canAccessAdmin = isAdmin || isDispatcher || isManagement;

  return (
    <Routes>
      {/* Public routes wrapper */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicSchedule />} />
        <Route path="/classrooms" element={<ClassroomAvailability />} />
      </Route>

      {/* Auth routes (not wrapped in public layout for clean look) */}
      <Route path="/login" element={user ? <Navigate to={getHome(user.role)} replace /> : <Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected admin routes */}
      {canAccessAdmin && (
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/departments" element={<Departments />} />
          <Route path="/admin/groups" element={<Groups />} />
          <Route path="/admin/teachers" element={<Teachers />} />
          <Route path="/admin/classrooms" element={<Classrooms />} />
          <Route path="/admin/subjects" element={<Subjects />} />
          <Route path="/admin/semesters" element={<Semesters />} />
          <Route path="/admin/schedule" element={<Schedule />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          {isAdmin && (
            <>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/audit" element={<AuditLogs />} />
            </>
          )}
          <Route path="/admin/teacher-subjects/:teacherId" element={<TeacherSubjects />} />
        </Route>
      )}

      {/* Teacher routes */}
      {user?.role === 'TEACHER' && (
        <>
          <Route path="/my-schedule" element={<TeacherDashboard />} />
        </>
      )}

      {/* Student routes */}
      {user?.role === 'STUDENT' && (
        <>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/my-schedule" element={<StudentSchedule />} />
        </>
      )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function getHome(role: string) {
  if (role === 'STUDENT') return '/student';
  if (role === 'TEACHER') return '/my-schedule';
  return '/admin';
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
            <ThemeSwitcher />
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
