import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Clock, Calendar, CheckCircle, AlertTriangle, BookOpen, Trophy } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  open_date: string;
  close_date: string;
  anti_cheat_enabled: boolean;
}

interface ExamSession {
  id: string;
  exam_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  warning_count: number;
  is_locked: boolean;
}

interface ExamResult {
  id: string;
  exam_id: string;
  total_points: number;
  max_points: number;
  percentage: number;
  teacher_comments: string | null;
  graded_at: string | null;
}

interface ExamWithSession extends Exam {
  session?: ExamSession;
  result?: ExamResult;
}

export function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const [exams, setExams] = useState<ExamWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'completed'>('available');

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .order('open_date', { ascending: false });

      if (examsError) throw examsError;

      const { data: sessionsData } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('student_id', profile?.id);

      const { data: resultsData } = await supabase
        .from('exam_results')
        .select('*')
        .eq('student_id', profile?.id);

      const examsWithSessions = examsData?.map(exam => {
        const session = sessionsData?.find(s => s.exam_id === exam.id);
        const result = resultsData?.find(r => r.exam_id === exam.id);
        return { ...exam, session, result };
      }) || [];

      setExams(examsWithSessions);
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExamStatus = (exam: ExamWithSession) => {
    const now = new Date();
    const openDate = new Date(exam.open_date);
    const closeDate = new Date(exam.close_date);

    if (exam.session?.status === 'submitted' || exam.session?.status === 'auto_submitted') {
      return { status: 'completed', label: 'Completed', color: 'green' };
    }

    if (exam.session?.status === 'blocked') {
      return { status: 'blocked', label: 'Blocked', color: 'red' };
    }

    if (exam.session?.status === 'in_progress') {
      return { status: 'in_progress', label: 'In Progress', color: 'blue' };
    }

    if (now < openDate) {
      return { status: 'upcoming', label: 'Upcoming', color: 'gray' };
    }

    if (now > closeDate) {
      return { status: 'closed', label: 'Closed', color: 'red' };
    }

    return { status: 'available', label: 'Available', color: 'green' };
  };

  const filteredExams = exams.filter(exam => {
    const { status } = getExamStatus(exam);
    if (filter === 'available') {
      return status === 'available' || status === 'in_progress';
    }
    if (filter === 'completed') {
      return status === 'completed';
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartExam = (examId: string) => {
    window.location.href = `/exam/${examId}`;
  };

  const handleViewResult = (examId: string) => {
    window.location.href = `/result/${examId}`;
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
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <span className="ml-3 text-xl font-bold text-gray-900">ExamPlatform</span>
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
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Exams</h1>
          <p className="text-gray-600">View and take your assigned examinations</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('available')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                filter === 'available'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Available Exams
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                filter === 'completed'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              All Exams
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filteredExams.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No exams found</h3>
              <p className="text-gray-600">
                {filter === 'available'
                  ? 'There are no available exams at the moment.'
                  : filter === 'completed'
                  ? 'You haven\'t completed any exams yet.'
                  : 'No exams have been created yet.'}
              </p>
            </div>
          ) : (
            filteredExams.map(exam => {
              const { status, label, color } = getExamStatus(exam);
              const isAvailable = status === 'available';
              const isInProgress = status === 'in_progress';
              const isCompleted = status === 'completed';
              const isBlocked = status === 'blocked';

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 mr-3">
                          {exam.title}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-700`}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4">{exam.description}</p>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {exam.duration_minutes} minutes
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Opens: {formatDate(exam.open_date)}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Closes: {formatDate(exam.close_date)}
                        </div>
                        {exam.anti_cheat_enabled && (
                          <div className="flex items-center text-orange-600">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Anti-cheat enabled
                          </div>
                        )}
                      </div>

                      {exam.result && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <Trophy className="w-5 h-5 text-green-600 mr-2" />
                            <span className="font-semibold text-green-900">
                              Score: {exam.result.percentage.toFixed(2)}%
                            </span>
                            <span className="text-green-700 ml-2">
                              ({exam.result.total_points}/{exam.result.max_points} points)
                            </span>
                          </div>
                          {exam.result.teacher_comments && (
                            <p className="mt-2 text-sm text-green-800">
                              <strong>Teacher's comment:</strong> {exam.result.teacher_comments}
                            </p>
                          )}
                        </div>
                      )}

                      {isBlocked && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center text-red-700">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            This exam has been blocked due to too many warnings.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {isAvailable && !exam.session && (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Start Exam
                        </button>
                      )}
                      {isInProgress && (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Continue
                        </button>
                      )}
                      {isCompleted && exam.result && (
                        <button
                          onClick={() => handleViewResult(exam.id)}
                          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          View Result
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
