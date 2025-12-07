import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StudentDashboard } from './pages/StudentDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { CreateExam } from './pages/CreateExam';
import { GradeExam } from './pages/GradeExam';
import { TakeExam } from './pages/TakeExam';
import { StudentExamResult } from './pages/StudentExamResult';
import { ExamDetails } from './pages/ExamDetails';
import { EditExam } from './pages/EditExam';

function Router() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Routes publiques
  if (currentPath === '/login') {
    if (user) {
      // Rediriger selon le rôle
      if (profile?.role === 'teacher' || profile?.role === 'admin') {
        window.location.href = '/teacher';
      } else {
        window.location.href = '/';
      }
      return null;
    }
    return <Login />;
  }

  if (currentPath === '/register') {
    if (user) {
      if (profile?.role === 'teacher' || profile?.role === 'admin') {
        window.location.href = '/teacher';
      } else {
        window.location.href = '/';
      }
      return null;
    }
    return <Register />;
  }

  // Routes étudiant
  if (currentPath.startsWith('/exam/')) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <TakeExam />
      </ProtectedRoute>
    );
  }

  if (currentPath.startsWith('/result/')) {
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <StudentExamResult />
      </ProtectedRoute>
    );
  }

  // Routes enseignant
  if (currentPath === '/teacher' || currentPath === '/teacher/') {
    return (
      <ProtectedRoute allowedRoles={['teacher', 'admin']}>
        <TeacherDashboard />
      </ProtectedRoute>
    );
  }

  if (currentPath === '/teacher/exams/create') {
    return (
      <ProtectedRoute allowedRoles={['teacher', 'admin']}>
        <CreateExam />
      </ProtectedRoute>
    );
  }

  if (currentPath.startsWith('/teacher/grade/')) {
    const sessionId = currentPath.replace('/teacher/grade/', '');
    return (
      <ProtectedRoute allowedRoles={['teacher', 'admin']}>
        <GradeExam sessionId={sessionId} />
      </ProtectedRoute>
    );
  }
  
  // Routes enseignant - View Exam Details
if (currentPath.startsWith('/teacher/exams/') && !currentPath.includes('/edit') && !currentPath.includes('/grade')) {
  return (
    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
      <ExamDetails />
    </ProtectedRoute>
  );
}

// Routes enseignant - Edit Exam
if (currentPath.startsWith('/teacher/exams/') && currentPath.includes('/edit')) {
  return (
    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
      <EditExam />
    </ProtectedRoute>
  );
}

  // Page d'accueil (redirection selon le rôle)
  if (currentPath === '/' || currentPath === '') {
    if (!user) {
      window.location.href = '/login';
      return null;
    }
    
    // Redirection automatique selon le rôle
    if (profile?.role === 'teacher' || profile?.role === 'admin') {
      window.location.href = '/teacher';
      return null;
    }
    
    return (
      <ProtectedRoute allowedRoles={['student']}>
        <StudentDashboard />
      </ProtectedRoute>
    );
  }

  // 404
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">404 - Page Not Found</h2>
        {user ? (
          <a href="/" className="text-blue-600 hover:text-blue-700">
            Return to Home
          </a>
        ) : (
          <a href="/login" className="text-blue-600 hover:text-blue-700">
            Go to Login
          </a>
        )}
      </div>
    </div>
  );
  
}

function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

export default App;