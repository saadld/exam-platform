import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  LogOut, BookOpen, Users, CheckCircle, Clock, AlertTriangle, 
  BarChart3, Eye, FileText, PlusCircle
} from 'lucide-react';

interface ExamStats {
  exam_id: string;
  exam_title: string;
  total_sessions: number;
  completed_sessions: number;
  in_progress_sessions: number;
  graded_results: number;
  average_score: number;
}

interface ExamSession {
  id: string; // <-- CHANGÉ DE session_id À id
  exam_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  warning_count: number;
  total_points: number | null;
  max_points: number | null;
  percentage: number | null;
  graded_at: string | null;
  teacher_comments: string | null;
}

export function TeacherDashboard() {
  const { profile, signOut } = useAuth();
  const [examStats, setExamStats] = useState<ExamStats[]>([]);
  const [recentSessions, setRecentSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'exams' | 'grading'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Charger les stats des exams
      const { data: statsData, error: statsError } = await supabase
        .from('teacher_exam_stats')
        .select('*');

      if (statsError) throw statsError;
      setExamStats(statsData || []);

      // Charger les sessions récentes
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('exam_student_progress')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;
      setRecentSessions(sessionsData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreateExam = () => {
    window.location.href = '/teacher/exams/create';
  };

  const handleViewExam = (examId: string) => {
    window.location.href = `/teacher/exams/${examId}`;
  };

  const handleGradeSession = (sessionId: string) => {
    window.location.href = `/teacher/grade/${sessionId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <span className="ml-3 text-xl font-bold text-gray-900">ExamPlatform - Teacher</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
          {/* Onglets */}
          <div className="flex space-x-2 border-t border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'exams'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              My Exams
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'grading'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Grading
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header avec bouton créer */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Dashboard</h1>
            <p className="text-gray-600">Manage exams and grade student submissions</p>
          </div>
          <button
            onClick={handleCreateExam}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Create New Exam
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Exams</p>
                    <p className="text-2xl font-bold text-gray-900">{examStats.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {examStats.reduce((sum, exam) => sum + exam.total_sessions, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {examStats.reduce((sum, exam) => sum + exam.completed_sessions, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Avg. Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {examStats.filter(e => e.average_score).length > 0
                        ? `${(examStats.filter(e => e.average_score).reduce((sum, exam) => sum + (exam.average_score || 0), 0) / examStats.filter(e => e.average_score).length).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Submissions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Submissions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50"> {/* CHANGÉ DE session_id À id */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{session.student_name}</p>
                            <p className="text-sm text-gray-600">{session.student_email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-900">Exam #{session.exam_id.substring(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            session.status === 'submitted' 
                              ? 'bg-green-100 text-green-700'
                              : session.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {session.status.replace('_', ' ')}
                          </span>
                          {session.warning_count > 0 && (
                            <div className="flex items-center mt-1 text-xs text-orange-600">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {session.warning_count} warning(s)
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {session.submitted_at ? formatDate(session.submitted_at) : 'Not submitted'}
                        </td>
                        <td className="px-6 py-4">
                          {session.percentage !== null ? (
                            <div className="flex items-center">
                              <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                                <div 
                                  className={`h-2 rounded-full ${
                                    session.percentage >= 70 ? 'bg-green-600' :
                                    session.percentage >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                                  }`}
                                  style={{ width: `${session.percentage}%` }}
                                ></div>
                              </div>
                              <span className="font-medium">{session.percentage.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">Not graded</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {session.status === 'submitted' && session.percentage === null ? (
                            <button
                              onClick={() => handleGradeSession(session.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Grade
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewExam(session.exam_id)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                              <Eye className="w-4 h-4 inline mr-1" />
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'exams' && (
          <div className="space-y-6">
            {examStats.map((exam) => (
              <div key={exam.exam_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{exam.exam_title}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        {exam.total_sessions} students
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {exam.completed_sessions} completed
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {exam.in_progress_sessions} in progress
                      </div>
                      {exam.average_score && (
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Avg: {exam.average_score.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleViewExam(exam.exam_id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => window.location.href = `/teacher/exams/${exam.exam_id}/edit`}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}