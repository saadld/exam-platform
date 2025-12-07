// src/pages/ExamDetails.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  CheckCircle, 
  Clock, 
  BarChart3,
  Calendar,
  AlertTriangle,
  Download,
  Copy,
  Edit
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  open_date: string;
  close_date: string;
  anti_cheat_enabled: boolean;
  created_at: string;
}

interface Question {
  id: string;
  question_text: string;
  points: number;
  order_number: number;
  question_type: string;
  correct_answer?: string;
  question_options?: QuestionOption[];
}

interface QuestionOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  order_number: number;
}

interface SessionStats {
  total_sessions: number;
  completed_sessions: number;
  in_progress_sessions: number;
  average_score: number | null;
  graded_results: number;
}

export function ExamDetails() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'sessions'>('overview');

  // Get examId from URL
  const getExamIdFromUrl = () => {
    const path = window.location.pathname;
    const match = path.match(/\/teacher\/exams\/([^/]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const examId = getExamIdFromUrl();
    if (examId) {
      loadExamDetails(examId);
    }
  }, []);

  const loadExamDetails = async (examId: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Load exam details
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExam(examData);

      // 2. Load questions with options
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          question_options (*)
        `)
        .eq('exam_id', examId)
        .order('order_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 3. Load session statistics
      const { data: statsData, error: statsError } = await supabase
        .from('teacher_exam_stats')
        .select('*')
        .eq('exam_id', examId)
        .single();

      if (!statsError && statsData) {
        setSessionStats({
          total_sessions: statsData.total_sessions,
          completed_sessions: statsData.completed_sessions,
          in_progress_sessions: statsData.in_progress_sessions,
          average_score: statsData.average_score,
          graded_results: statsData.graded_results
        });
      } else {
        setSessionStats({
          total_sessions: 0,
          completed_sessions: 0,
          in_progress_sessions: 0,
          average_score: null,
          graded_results: 0
        });
      }

    } catch (error: any) {
      console.error('Error loading exam details:', error);
      setError(error.message || 'Failed to load exam details.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateTotalPoints = () => {
    return questions.reduce((sum, question) => sum + question.points, 0);
  };

  const handleBack = () => {
    window.location.href = '/teacher';
  };

  const handleEditExam = () => {
    const examId = getExamIdFromUrl();
    if (examId) {
      window.location.href = `/teacher/exams/${examId}/edit`;
    }
  };

  const handleDuplicateExam = async () => {
    if (!exam) return;
    
    const confirmDuplicate = window.confirm('Duplicate this exam? This will create a new exam with the same questions.');
    if (!confirmDuplicate) return;

    try {
      // Create new exam with same properties
      const { data: newExam, error: examError } = await supabase
        .from('exams')
        .insert({
          title: `${exam.title} (Copy)`,
          description: exam.description,
          duration_minutes: exam.duration_minutes,
          open_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
          close_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
          anti_cheat_enabled: exam.anti_cheat_enabled,
          created_by: profile?.id
        })
        .select()
        .single();

      if (examError) throw examError;

      // Duplicate questions
      for (const question of questions) {
        const { data: newQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            exam_id: newExam.id,
            question_text: question.question_text,
            points: question.points,
            order_number: question.order_number,
            question_type: question.question_type,
            correct_answer: question.correct_answer
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Duplicate question options if they exist
        if (question.question_options && question.question_options.length > 0) {
          const optionsToInsert = question.question_options.map(option => ({
            question_id: newQuestion.id,
            option_text: option.option_text,
            is_correct: option.is_correct,
            order_number: option.order_number
          }));

          const { error: optionsError } = await supabase
            .from('question_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      }

      alert('Exam duplicated successfully!');
      window.location.href = `/teacher/exams/${newExam.id}`;
    } catch (error: any) {
      console.error('Error duplicating exam:', error);
      alert(`Failed to duplicate exam: ${error.message}`);
    }
  };

  const handleExportResults = () => {
    alert('Export functionality would be implemented here.');
    // You would implement CSV/Excel export here
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam details...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Exam not found'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleDuplicateExam}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </button>
              <button
                onClick={handleExportResults}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </button>
              <button
                onClick={handleEditExam}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Exam
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'questions'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Questions ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'sessions'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Student Sessions ({sessionStats?.total_sessions || 0})
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Exam Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          <p className="text-gray-600 mb-6">{exam.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg mr-4">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Duration</h3>
                  <p className="text-2xl font-bold text-gray-900">{exam.duration_minutes} min</p>
                  <p className="text-sm text-gray-500">Time limit</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg mr-4">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Total Points</h3>
                  <p className="text-2xl font-bold text-gray-900">{calculateTotalPoints()}</p>
                  <p className="text-sm text-gray-500">{questions.length} questions</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg mr-4">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Students</h3>
                  <p className="text-2xl font-bold text-gray-900">{sessionStats?.total_sessions || 0}</p>
                  <p className="text-sm text-gray-500">Total participants</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg mr-4">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Avg. Score</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessionStats?.average_score ? `${sessionStats.average_score.toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500">{sessionStats?.graded_results || 0} graded</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Exam Schedule */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Schedule</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                    <div>
                      <p className="font-medium">Opens</p>
                      <p className="text-sm">{formatDate(exam.open_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                    <div>
                      <p className="font-medium">Closes</p>
                      <p className="text-sm">{formatDate(exam.close_date)}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg mr-4 ${
                      exam.anti_cheat_enabled ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <AlertTriangle className={`w-6 h-6 ${
                        exam.anti_cheat_enabled ? 'text-red-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Anti-Cheat</h3>
                      <p className="text-sm text-gray-500">
                        {exam.anti_cheat_enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{sessionStats?.completed_sessions || 0}</p>
                  <p className="text-sm text-blue-600">Completed</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700">{sessionStats?.in_progress_sessions || 0}</p>
                  <p className="text-sm text-yellow-600">In Progress</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{sessionStats?.graded_results || 0}</p>
                  <p className="text-sm text-green-600">Graded</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700">
                    {questions.length}
                  </p>
                  <p className="text-sm text-purple-600">Questions</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-6">
            {questions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Questions</h3>
                <p className="text-gray-600 mb-4">This exam doesn't have any questions yet.</p>
                <button
                  onClick={handleEditExam}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Questions
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-lg font-semibold text-gray-900 mr-3">
                          Question {index + 1}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {question.points} point{question.points !== 1 ? 's' : ''}
                        </span>
                        <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                          {question.question_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-900 font-medium mb-4">{question.question_text}</p>
                    
                    {/* Question Options */}
                    {question.question_type === 'mcq' && question.question_options && (
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm font-medium text-gray-800 mb-2">Options:</p>
                        <div className="space-y-2">
                          {question.question_options.map((option, optIndex) => (
                            <div
                              key={option.id}
                              className={`flex items-center p-2 rounded ${
                                option.is_correct
                                  ? 'bg-green-50 border border-green-200'
                                  : 'bg-white border border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                                option.is_correct ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <span className={`flex-1 ${
                                option.is_correct ? 'text-green-800 font-medium' : 'text-gray-700'
                              }`}>
                                {option.option_text}
                              </span>
                              {option.is_correct && (
                                <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Correct Answer for other types */}
                    {question.question_type !== 'mcq' && question.correct_answer && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800 mb-1">Correct Answer:</p>
                        <p className="text-green-700">{question.correct_answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Student Sessions</h2>
              <p className="text-sm text-gray-600">
                View and manage student exam sessions
              </p>
            </div>
            <div className="p-6 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Student Sessions List</h3>
              <p className="text-gray-600 mb-4">
                This would show a list of all student sessions for this exam.
              </p>
              <p className="text-sm text-gray-500">
                {sessionStats?.total_sessions || 0} total sessions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}