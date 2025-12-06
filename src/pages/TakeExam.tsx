import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useExamTimer } from '../hooks/useExamTimer';
import { Clock, AlertTriangle, CheckCircle, Send, X } from 'lucide-react';

interface Question {
  id: string;
  question_type: 'mcq' | 'true_false' | 'short_answer' | 'long_answer';
  question_text: string;
  points: number;
  order_number: number;
  options?: QuestionOption[];
}

interface QuestionOption {
  id: string;
  option_text: string;
  order_number: number;
}

interface Answer {
  question_id: string;
  answer_text?: string;
  selected_option_id?: string;
}

interface ExamSession {
  id: string;
  exam_id: string;
  started_at: string;
  status: string;
  warning_count: number;
  is_locked: boolean;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  anti_cheat_enabled: boolean;
  max_warnings: number;
}

export function TakeExam() {
  const { profile } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const examId = window.location.pathname.split('/exam/')[1];

  const handleWarning = useCallback(async (count: number) => {
    if (session) {
      await supabase
        .from('exam_sessions')
        .update({
          warning_count: count,
          last_warning_at: new Date().toISOString(),
        })
        .eq('id', session.id);
    }
  }, [session]);

  const handleMaxWarnings = useCallback(async () => {
    if (session) {
      await supabase
        .from('exam_sessions')
        .update({
          status: 'auto_submitted',
          submitted_at: new Date().toISOString(),
          is_locked: true,
        })
        .eq('id', session.id);

      await submitExam(true);
    }
  }, [session]);

  const { warningCount, showWarningModal, closeWarningModal } = useAntiCheat({
    enabled: exam?.anti_cheat_enabled || false,
    maxWarnings: exam?.max_warnings || 2,
    onWarning: handleWarning,
    onMaxWarningsReached: handleMaxWarnings,
  });

  const handleTimeUp = useCallback(async () => {
    await submitExam(true);
  }, []);

  const { formattedTime, timeColor } = useExamTimer({
    durationMinutes: exam?.duration_minutes || 0,
    startedAt: session?.started_at || new Date().toISOString(),
    onTimeUp: handleTimeUp,
  });

  useEffect(() => {
    loadExam();
  }, [examId]);

  useEffect(() => {
    if (session && exam) {
      const interval = setInterval(() => {
        autoSaveAnswers();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [session, exam, answers]);

  const loadExam = async () => {
    try {
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;

      setExam(examData);

      let sessionData;
      const { data: existingSession } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', profile?.id)
        .maybeSingle();

      if (existingSession) {
        if (existingSession.is_locked || existingSession.status === 'submitted' || existingSession.status === 'auto_submitted') {
          window.location.href = '/';
          return;
        }
        sessionData = existingSession;
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('exam_sessions')
          .insert({
            exam_id: examId,
            student_id: profile?.id || '',
            status: 'in_progress',
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionData = newSession;
      }

      setSession(sessionData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_number');

      if (questionsError) throw questionsError;

      const questionsWithOptions = await Promise.all(
        questionsData.map(async (question) => {
          if (question.question_type === 'mcq' || question.question_type === 'true_false') {
            const { data: options } = await supabase
              .from('question_options')
              .select('*')
              .eq('question_id', question.id)
              .order('order_number');

            return { ...question, options: options || [] };
          }
          return question;
        })
      );

      setQuestions(questionsWithOptions);

      const { data: savedAnswers } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', sessionData.id);

      if (savedAnswers) {
        const answersMap: Record<string, Answer> = {};
        savedAnswers.forEach((answer) => {
          answersMap[answer.question_id] = {
            question_id: answer.question_id,
            answer_text: answer.answer_text || undefined,
            selected_option_id: answer.selected_option_id || undefined,
          };
        });
        setAnswers(answersMap);
      }
    } catch (error) {
      console.error('Error loading exam:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveAnswers = async () => {
    if (!session) return;

    setAutoSaveStatus('saving');

    try {
      for (const [questionId, answer] of Object.entries(answers)) {
        await supabase
          .from('student_answers')
          .upsert({
            session_id: session.id,
            question_id: questionId,
            answer_text: answer.answer_text || null,
            selected_option_id: answer.selected_option_id || null,
            last_saved_at: new Date().toISOString(),
          });
      }
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error auto-saving answers:', error);
      setAutoSaveStatus('idle');
    }
  };

  const submitExam = async (autoSubmit = false) => {
    if (!session) return;

    setSubmitting(true);

    try {
      await autoSaveAnswers();

      await supabase
        .from('exam_sessions')
        .update({
          status: autoSubmit ? 'auto_submitted' : 'submitted',
          submitted_at: new Date().toISOString(),
          is_locked: true,
        })
        .eq('id', session.id);

      window.location.href = '/';
    } catch (error) {
      console.error('Error submitting exam:', error);
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: Answer) => {
    setAnswers({
      ...answers,
      [questionId]: answer,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!exam || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam Not Found</h2>
          <a href="/" className="text-blue-600 hover:text-blue-700">Return to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">{profile?.full_name}</p>
            </div>

            <div className="flex items-center space-x-6">
              {autoSaveStatus === 'saved' && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved
                </div>
              )}
              {autoSaveStatus === 'saving' && (
                <div className="flex items-center text-blue-600 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Saving...
                </div>
              )}

              {exam.anti_cheat_enabled && (
                <div className="flex items-center text-orange-600">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium">
                    Warnings: {warningCount}/{exam.max_warnings}
                  </span>
                </div>
              )}

              <div className={`flex items-center ${timeColor} font-bold text-lg`}>
                <Clock className="w-5 h-5 mr-2" />
                {formattedTime}
              </div>

              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm mr-3">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium mb-1">{question.question_text}</p>
                  <p className="text-sm text-gray-500">{question.points} point{question.points > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="ml-11">
                {(question.question_type === 'mcq' || question.question_type === 'true_false') && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={answers[question.id]?.selected_option_id === option.id}
                          onChange={() =>
                            handleAnswerChange(question.id, {
                              question_id: question.id,
                              selected_option_id: option.id,
                            })
                          }
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-gray-900">{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.question_type === 'short_answer' && (
                  <input
                    type="text"
                    value={answers[question.id]?.answer_text || ''}
                    onChange={(e) =>
                      handleAnswerChange(question.id, {
                        question_id: question.id,
                        answer_text: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type your answer here..."
                  />
                )}

                {question.question_type === 'long_answer' && (
                  <textarea
                    value={answers[question.id]?.answer_text || ''}
                    onChange={(e) =>
                      handleAnswerChange(question.id, {
                        question_id: question.id,
                        answer_text: e.target.value,
                      })
                    }
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Type your answer here..."
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Send className="w-5 h-5 mr-2" />
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-3 mr-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Warning!</h2>
            </div>
            <p className="text-gray-700 mb-4">
              You have switched tabs or lost focus on the exam window. This is not allowed during the exam.
            </p>
            <p className="text-gray-900 font-semibold mb-4">
              Warning {warningCount} of {exam.max_warnings}
            </p>
            {warningCount >= exam.max_warnings ? (
              <p className="text-red-600 font-bold mb-4">
                Maximum warnings reached. Your exam will be submitted automatically.
              </p>
            ) : (
              <p className="text-orange-600 mb-4">
                If you receive {exam.max_warnings - warningCount} more warning(s), your exam will be automatically submitted.
              </p>
            )}
            <button
              onClick={closeWarningModal}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 rounded-full p-3 mr-4">
                <Send className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Submit Exam?</h2>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to submit your exam? You will not be able to make any changes after submission.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold flex items-center justify-center"
              >
                <X className="w-5 h-5 mr-2" />
                Cancel
              </button>
              <button
                onClick={() => submitExam(false)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="w-5 h-5 mr-2" />
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
