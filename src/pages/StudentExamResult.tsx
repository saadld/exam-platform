// src/pages/StudentExamResult.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  Award, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Clock, 
  Calendar,
  BarChart,
  MessageSquare,
  Percent,
  AlertCircle
} from 'lucide-react';

interface ExamResult {
  id: string;
  exam_id: string;
  total_points: number;
  max_points: number;
  percentage: number;
  teacher_comments: string | null;
  graded_at: string;
  session_id: string;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  open_date: string;
  close_date: string;
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

interface StudentAnswer {
  id: string;
  question_id: string;
  answer_text: string | null;
  selected_option_id: string | null;
  points_earned: number | null;
  is_correct: boolean | null;
}

export function StudentExamResult() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);

  // Get examId from URL
  const getExamIdFromUrl = () => {
    const path = window.location.pathname;
    const match = path.match(/\/result\/([^/]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const examId = getExamIdFromUrl();
    if (examId) {
      loadExamResult(examId);
    }
  }, []);

  const loadExamResult = async (examId: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Charger le résultat de l'examen
      const { data: resultData, error: resultError } = await supabase
        .from('exam_results')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', profile?.id)
        .single();

      if (resultError) {
        if (resultError.code === 'PGRST116') {
          setError('Results not available yet. Please wait for the teacher to grade your exam.');
        } else {
          throw new Error(`Failed to load results: ${resultError.message}`);
        }
        return;
      }

      setResult(resultData);

      // 2. Charger les détails de l'examen
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', resultData.exam_id)
        .single();

      if (examError) throw examError;
      setExam(examData);

      // 3. Charger les questions de l'examen
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          question_options (*)
        `)
        .eq('exam_id', resultData.exam_id)
        .order('order_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 4. Charger les réponses de l'étudiant pour cette session
      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', resultData.session_id);

      if (answersError) throw answersError;
      setAnswers(answersData || []);

    } catch (error: any) {
      console.error('Error loading exam result:', error);
      setError(error.message || 'Failed to load exam results.');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
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

  const getQuestionPoints = (questionId: string) => {
    const answer = answers.find(a => a.question_id === questionId);
    return answer?.points_earned || 0;
  };

  const getSelectedOptionText = (question: Question, selectedOptionId: string) => {
    const option = question.question_options?.find(opt => opt.id === selectedOptionId);
    if (!option) return 'Selected option not found';
    
    const optionIndex = question.question_options?.findIndex(opt => opt.id === selectedOptionId) ?? -1;
    const optionLetter = optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : '?';
    
    return `${optionLetter}. ${option.option_text}`;
  };

  const getCorrectOptionText = (question: Question) => {
    if (question.question_type === 'mcq' || question.question_type === 'true_false') {
      const correctOption = question.question_options?.find(opt => opt.is_correct);
      if (correctOption) {
        const optionIndex = question.question_options?.findIndex(opt => opt.id === correctOption.id) ?? -1;
        const optionLetter = optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : '?';
        return `${optionLetter}. ${correctOption.option_text}`;
      }
    }
    return question.correct_answer || '';
  };

  const handleBackToDashboard = () => {
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleBackToDashboard}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!result || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Results Found</h2>
          <p className="text-gray-600 mb-4">This exam hasn't been graded yet or results are not available.</p>
          <button
            onClick={handleBackToDashboard}
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
              onClick={handleBackToDashboard}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="text-sm text-gray-500">
              Exam Results - {exam.title}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Exam Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          <p className="text-gray-600 mb-6">{exam.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg mr-4">
                  <BarChart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Score</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {result.total_points.toFixed(1)} / {result.max_points.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">Points earned</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg mr-4">
                  <Percent className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Percentage</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {result.percentage.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">Overall score</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg mr-4">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Grade</h3>
                  <div className={`px-3 py-1 rounded-lg inline-block ${getGradeColor(result.percentage)}`}>
                    <p className="text-2xl font-bold">{getGradeLetter(result.percentage)}</p>
                  </div>
                  <p className="text-sm text-gray-500">Final grade</p>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-gray-600">
                <Clock className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <p className="font-medium">Duration</p>
                  <p className="text-sm">{exam.duration_minutes} minutes</p>
                </div>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <p className="font-medium">Graded on</p>
                  <p className="text-sm">{formatDate(result.graded_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher Comments */}
          {result.teacher_comments && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-5 h-5 text-blue-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Teacher's Comments</h2>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{result.teacher_comments}</p>
              </div>
            </div>
          )}

          {/* Detailed Results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Detailed Results</h2>
              <p className="text-sm text-gray-600">
                Review your answers for each question
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {questions.map((question, index) => {
                const answer = answers.find(a => a.question_id === question.id);
                const pointsEarned = getQuestionPoints(question.id);
                const maxPoints = question.points;
                const isCorrect = answer?.is_correct;

                return (
                  <div key={question.id} className="p-6">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-lg font-semibold text-gray-900 mr-3">
                            Question {index + 1}
                          </span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                            {question.question_type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            pointsEarned === maxPoints ? 'text-green-600' :
                            pointsEarned > 0 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {pointsEarned.toFixed(1)} / {maxPoints.toFixed(1)}
                          </div>
                          <div className="text-sm text-gray-500">Points</div>
                        </div>
                      </div>
                      
                      <p className="text-gray-900 font-medium mb-4">{question.question_text}</p>

                      {/* Correct Answer */}
                      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800 mb-1">Correct Answer:</p>
                        {question.question_type === 'mcq' || question.question_type === 'true_false' ? (
                          <p className="text-green-700">{getCorrectOptionText(question)}</p>
                        ) : (
                          <p className="text-green-700">{question.correct_answer || 'N/A'}</p>
                        )}
                      </div>

                      {/* Student's Answer */}
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-1">Your Answer:</p>
                        {answer?.answer_text ? (
                          <div>
                            <p className="text-blue-900 whitespace-pre-wrap">{answer.answer_text}</p>
                            <div className="mt-2 flex items-center">
                              {isCorrect ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Correct
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Incorrect
                                </span>
                              )}
                            </div>
                          </div>
                        ) : answer?.selected_option_id ? (
                          <div>
                            <div className={`flex items-center p-3 rounded-lg ${
                              isCorrect ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'
                            }`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}>
                                {String.fromCharCode(65 + (question.question_options?.findIndex(opt => opt.id === answer.selected_option_id) || 0))}
                              </div>
                              <div>
                                <p className={`font-medium ${
                                  isCorrect ? 'text-green-800' : 'text-red-800'
                                }`}>
                                  {getSelectedOptionText(question, answer.selected_option_id)}
                                </p>
                                <p className="text-sm mt-1">
                                  {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-blue-700 italic">No answer provided</p>
                        )}
                      </div>

                      {/* Points Breakdown */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-800 mb-2">Scoring:</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-600">Your score</p>
                            <p className="text-lg font-semibold text-gray-900">{pointsEarned.toFixed(1)} points</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-600">Maximum possible</p>
                            <p className="text-lg font-semibold text-gray-900">{maxPoints.toFixed(1)} points</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Correct Answers</h3>
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-600 h-4 rounded-full transition-all duration-500"
                      style={{
                        width: `${(answers.filter(a => a.is_correct === true).length / questions.length) * 100}%`
                      }}
                    ></div>
                  </div>
                  <span className="ml-3 font-semibold text-gray-900">
                    {answers.filter(a => a.is_correct === true).length} / {questions.length}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Score Distribution</h3>
                <div className="space-y-2">
                  {questions.map((question, index) => {
                    const pointsEarned = getQuestionPoints(question.id);
                    return (
                      <div key={question.id} className="flex items-center">
                        <div className="w-8 text-sm text-gray-600">Q{index + 1}</div>
                        <div className="flex-1 mx-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                pointsEarned === question.points ? 'bg-green-600' :
                                pointsEarned > 0 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(pointsEarned / question.points) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="w-16 text-right text-sm font-medium">
                          {pointsEarned.toFixed(1)}/{question.points.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleBackToDashboard}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}