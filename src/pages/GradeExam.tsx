import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, User, Award, AlertCircle, FileText, CheckCircle, XCircle } from 'lucide-react';

interface GradeExamProps {
  sessionId: string;
}

interface QuestionOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  order_number: number;
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

interface StudentAnswer {
  id: string;
  question_id: string;
  answer_text: string | null;
  selected_option_id: string | null;
  points_earned: number | null;
}

export function GradeExam({ sessionId }: GradeExamProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [grades, setGrades] = useState<{[key: string]: number}>({});
  const [comments, setComments] = useState<{[key: string]: string}>({});

  // Vérifiez d'abord si sessionId est défini
  useEffect(() => {
    console.log('GradeExam component mounted with sessionId:', sessionId);
    
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      setError(`Invalid session ID: "${sessionId}"`);
      setLoading(false);
      return;
    }
    
    if (!sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setError(`Invalid session ID format: "${sessionId}"`);
      setLoading(false);
      return;
    }
    
    loadExamData();
  }, [sessionId]);

  const loadExamData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== Loading exam data for session:', sessionId);

      // OPTIMISÉ: Utilisez la vue exam_student_progress qui fonctionne déjà
      const { data: sessionData, error: viewError } = await supabase
        .from('exam_student_progress')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (viewError || !sessionData) {
        console.error('View error:', viewError);
        throw new Error(`Session ${sessionId} not found in database`);
      }

      console.log('Data from exam_student_progress:', sessionData);

      // Utilisez les données de la vue qui fonctionnent
      setExamTitle(sessionData.exam_title || 'Exam');
      setStudentName(sessionData.student_name || 'Student');
      setStudentEmail(sessionData.student_email || '');

      // Chargez les questions avec options
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          question_options (*)
        `)
        .eq('exam_id', sessionData.exam_id)
        .order('order_number');

      if (questionsError) {
        console.error('Questions error:', questionsError);
        throw new Error(`Failed to load questions: ${questionsError.message}`);
      }

      console.log('Questions loaded:', questionsData?.length || 0);
      setQuestions(questionsData || []);

      // Chargez les réponses des étudiants
      console.log('Loading answers for session:', sessionId);
      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', sessionId);

      if (answersError) {
        console.warn('Answers load warning:', answersError);
        // Pas d'erreur, peut-être que l'étudiant n'a pas encore répondu
      }

      console.log('Answers found:', answersData?.length || 0);
      setAnswers(answersData || []);

      // Initialisez les notes avec auto-grading pour MCQ
      const initialGrades: {[key: string]: number} = {};
      const initialComments: {[key: string]: string} = {};
      
      (questionsData || []).forEach((question: Question) => {
        const answer = (answersData || []).find((a: StudentAnswer) => a.question_id === question.id);
        
        // Auto-grade pour MCQ
        let autoGrade = 0;
        if (answer?.selected_option_id && question.question_options) {
          const selectedOption = question.question_options.find(opt => opt.id === answer.selected_option_id);
          autoGrade = selectedOption?.is_correct ? question.points : 0;
        }
        
        initialGrades[question.id] = answer?.points_earned !== null && answer?.points_earned !== undefined 
          ? answer.points_earned 
          : autoGrade;
        
        initialComments[question.id] = '';
      });

      setGrades(initialGrades);
      setComments(initialComments);

      console.log('=== Data loaded successfully ===');
      console.log('Student:', sessionData.student_name, sessionData.student_email);
      console.log('Exam:', sessionData.exam_title);
      console.log('Questions:', questionsData?.length || 0);
      console.log('Answers:', answersData?.length || 0);
      
    } catch (error: any) {
      console.error('Error loading exam data:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (questionId: string, value: number) => {
    const question = questions.find(q => q.id === questionId);
    const maxPoints = question?.points || 0;
    const newValue = Math.max(0, Math.min(value, maxPoints));
    
    setGrades(prev => ({
      ...prev,
      [questionId]: newValue
    }));
  };

  const handleCommentChange = (questionId: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const calculateTotalPoints = () => {
    return Object.values(grades).reduce((sum, grade) => sum + grade, 0);
  };

  const calculateMaxPoints = () => {
    return questions.reduce((sum, question) => sum + question.points, 0);
  };

  const calculatePercentage = () => {
    const total = calculateTotalPoints();
    const max = calculateMaxPoints();
    return max > 0 ? (total / max) * 100 : 0;
  };

  const handleSubmitGrading = async () => {
    if (!profile) {
      setError('You must be logged in to grade exams');
      return;
    }

    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      setError(`Invalid session ID: "${sessionId}"`);
      return;
    }

    // Vérifiez que toutes les questions ont été notées
    const unansweredQuestions = questions.filter(q => grades[q.id] === undefined);
    if (unansweredQuestions.length > 0) {
      setError(`Please grade all questions. ${unansweredQuestions.length} question(s) remaining.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      console.log('Submitting grading for session:', sessionId);

      // Update student answers with grades
      const updatePromises = answers.map(answer => {
        const grade = grades[answer.question_id] || 0;
        
        // Déterminez si la réponse est correcte (pour MCQ)
        let is_correct = null;
        if (answer.selected_option_id) {
          const question = questions.find(q => q.id === answer.question_id);
          const selectedOption = question?.question_options?.find(opt => opt.id === answer.selected_option_id);
          is_correct = selectedOption?.is_correct || false;
        }
        
        return supabase
          .from('student_answers')
          .update({
            points_earned: grade,
            is_correct: is_correct
          })
          .eq('id', answer.id);
      });

      await Promise.all(updatePromises);

      // Créez le résultat de l'exam
      const totalPoints = calculateTotalPoints();
      const maxPoints = calculateMaxPoints();
      const percentage = calculatePercentage();

      // Obtenez les infos de session depuis la vue
      const { data: sessionData } = await supabase
        .from('exam_student_progress')
        .select('exam_id, student_id')
        .eq('id', sessionId)
        .single();

      if (!sessionData) {
        throw new Error('Could not load session data for result');
      }

      const resultData = {
        session_id: sessionId,
        exam_id: sessionData.exam_id,
        student_id: sessionData.student_id,
        total_points: totalPoints,
        max_points: maxPoints,
        percentage: percentage,
        graded_by: profile.id,
        teacher_comments: 'Grading completed',
        graded_at: new Date().toISOString()
      };

      console.log('Result data to insert:', resultData);

      // Vérifiez si le résultat existe déjà
      const { data: existingResult } = await supabase
        .from('exam_results')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingResult) {
        await supabase
          .from('exam_results')
          .update(resultData)
          .eq('id', existingResult.id);
      } else {
        await supabase
          .from('exam_results')
          .insert(resultData);
      }

      // Mettez à jour le statut de la session
      await supabase
        .from('exam_sessions')
        .update({ status: 'graded' })
        .eq('id', sessionId);

      alert('Grading submitted successfully!');
      window.location.href = '/teacher';

    } catch (error: any) {
      console.error('Error submitting grading:', error);
      setError(`Failed to submit grading: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGrade = () => {
    const newGrades = { ...grades };
    questions.forEach(question => {
      const answer = answers.find(a => a.question_id === question.id);
      
      if (question.question_type === 'mcq' && answer?.selected_option_id && question.question_options) {
        // MCQ: auto-grade basé sur l'option sélectionnée
        const selectedOption = question.question_options.find(opt => opt.id === answer.selected_option_id);
        newGrades[question.id] = selectedOption?.is_correct ? question.points : 0;
        
      } else if (question.question_type === 'true_false' && answer?.selected_option_id && question.question_options) {
        // True/False: similaire à MCQ
        const selectedOption = question.question_options.find(opt => opt.id === answer.selected_option_id);
        newGrades[question.id] = selectedOption?.is_correct ? question.points : 0;
        
      } else if ((question.question_type === 'short_answer' || question.question_type === 'long_answer') 
                 && answer?.answer_text) {
        // Short/Long Answer: Comparer avec la réponse du modèle
        if (question.correct_answer && answer.answer_text.trim()) {
          const studentAnswer = answer.answer_text.trim().toLowerCase();
          const modelAnswer = question.correct_answer.trim().toLowerCase();
          
          // Comparaison simple (vous pouvez ajouter une logique plus sophistiquée)
          if (studentAnswer === modelAnswer) {
            newGrades[question.id] = question.points; // Réponse exacte = points complets
          } else {
            // Option 1: Donner 0 points pour réponse incorrecte
            newGrades[question.id] = 0;
            
            // Option 2: Donner la moitié des points pour une réponse partiellement correcte
            // newGrades[question.id] = Math.floor(question.points / 2);
          }
        } else {
          // Pas de réponse correcte définie ou étudiant n'a pas répondu
          newGrades[question.id] = 0;
        }
        
      } else {
        newGrades[question.id] = 0;
      }
    });
    
    setGrades(newGrades);
    alert('Auto-grading applied! Please review and adjust as needed.');
  };

  const getSelectedOptionText = (questionId: string, selectedOptionId: string) => {
    const question = questions.find(q => q.id === questionId);
    const option = question?.question_options?.find(opt => opt.id === selectedOptionId);
    
    if (!option) {
      return `Option ID: ${selectedOptionId.substring(0, 8)}...`;
    }
    
    // Trouvez l'index pour afficher A, B, C, etc.
    const optionIndex = question?.question_options?.findIndex(opt => opt.id === selectedOptionId) ?? -1;
    const optionLetter = optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : '?';
    
    return `${optionLetter}. ${option.option_text} ${option.is_correct ? '✓' : ''}`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Session ID: {sessionId || 'undefined'}</p>
          <button
            onClick={() => window.location.href = '/teacher'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Teacher Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam data...</p>
          <p className="text-sm text-gray-400 mt-2">Session ID: {sessionId}</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Questions Found</h2>
          <p className="text-gray-600 mb-4">This exam doesn't have any questions to grade.</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.href = '/teacher'}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Teacher Dashboard
            </button>
            <button
              onClick={loadExamData}
              className="w-full px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/teacher'}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleAutoGrade}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                Auto-Grade
              </button>
              <button
                onClick={handleSubmitGrading}
                disabled={saving || Object.keys(grades).length !== questions.length}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Submit Grading
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success Banner si les données sont bien chargées */}
        

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Grade Exam</h1>
          
          {/* Exam and Student Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg mr-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Exam</h3>
                  <p className="text-gray-600">{examTitle}</p>
                  <p className="text-sm text-gray-500">
                    {questions.length} question{questions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg mr-4">
                  <User className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Student</h3>
                  <p className="text-gray-600">{studentName}</p>
                  <p className="text-sm text-gray-600">{studentEmail}</p>
                  <p className="text-sm text-gray-500">
                    {answers.length} answer{answers.length !== 1 ? 's' : ''} submitted
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grading Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Grading Summary</h2>
                <div className="flex items-center space-x-6">
                  <div>
                    <p className="text-sm text-gray-600">Total Points</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {calculateTotalPoints()} / {calculateMaxPoints()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Percentage</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {calculatePercentage().toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Award className="w-8 h-8 text-yellow-500 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Grade</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {calculatePercentage() >= 90 ? 'A' :
                         calculatePercentage() >= 80 ? 'B' :
                         calculatePercentage() >= 70 ? 'C' :
                         calculatePercentage() >= 60 ? 'D' : 'F'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Graded: {Object.keys(grades).length} of {questions.length} questions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Questions and Answers */}
        <div className="space-y-6">
          {questions.map((question, index) => {
            const answer = answers.find(a => a.question_id === question.id);
            const maxPoints = question.points;
            const grade = grades[question.id] || 0;
            const comment = comments[question.id] || '';

            // Trouvez l'option sélectionnée
            const selectedOption = answer?.selected_option_id 
              ? question.question_options?.find(opt => opt.id === answer.selected_option_id)
              : null;

            // CORRIGÉ: Gestion sécurisée de optionIndex
            const optionIndex = selectedOption && question.question_options
              ? question.question_options.findIndex(opt => opt.id === selectedOption.id)
              : -1;
            
            const optionLetter = optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : '?';

            return (
              <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-lg font-semibold text-gray-900 mr-3">
                        Question {index + 1}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {maxPoints} point{maxPoints !== 1 ? 's' : ''}
                      </span>
                      <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                        {question.question_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Question */}
                <div className="mb-6">
                  <p className="text-gray-900 font-medium mb-4">{question.question_text}</p>
                  
                  {/* Affichez toutes les options pour référence */}
                  {question.question_type === 'mcq' && question.question_options && (
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-800 mb-2">Options:</p>
                      <div className="space-y-2">
                        {question.question_options.map((option, optIndex) => (
                          <div
                            key={option.id}
                            className={`flex items-center p-2 rounded ${
                              option.is_correct
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-white border border-gray-200'
                            } ${selectedOption?.id === option.id ? 'ring-2 ring-blue-500' : ''}`}
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
                            {selectedOption?.id === option.id && (
                              <div className="flex items-center ml-2">
                                <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                                <span className="text-sm text-blue-600">Student's choice</span>
                              </div>
                            )}
                            {option.is_correct ? (
                              <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400 ml-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Correct Answer (for reference) pour les autres types */}
                  {question.question_type !== 'mcq' && question.correct_answer && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800 mb-1">Model Answer:</p>
                      <p className="text-green-700">{question.correct_answer}</p>
                    </div>
                  )}
                  
                  {/* Student's Answer */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Student's Answer:</p>
                    {answer?.answer_text ? (
                      <div>
                        <p className="text-blue-900 whitespace-pre-wrap">{answer.answer_text}</p>
                        {answer.points_earned !== null && (
                          <p className="text-sm text-blue-600 mt-2">
                            Previous grade: {answer.points_earned} points
                          </p>
                        )}
                      </div>
                    ) : answer?.selected_option_id ? (
                      <div>
                        {selectedOption ? (
                          <div className="flex items-center p-3 bg-white border border-blue-300 rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                              selectedOption.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {optionLetter}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${
                                selectedOption.is_correct ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {selectedOption.option_text}
                              </p>
                              <p className="text-xs mt-1">
                                <span className={selectedOption.is_correct ? 'text-green-600' : 'text-red-600'}>
                                  {selectedOption.is_correct ? '✓ Correct answer' : '✗ Incorrect answer'}
                                </span>
                              </p>
                            </div>
                            {selectedOption.is_correct ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        ) : (
                          <p className="text-blue-900">Selected option: {getSelectedOptionText(question.id, answer.selected_option_id)}</p>
                        )}
                        {answer.points_earned !== null && (
                          <p className="text-sm text-blue-600 mt-2">
                            Previous grade: {answer.points_earned} points
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-blue-700 italic">No answer provided</p>
                    )}
                  </div>
                </div>

                {/* Grading Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Points Awarded (0 - {maxPoints})
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          max={maxPoints}
                          step="0.5"
                          value={grade}
                          onChange={(e) => handleGradeChange(question.id, parseFloat(e.target.value))}
                          className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="ml-3 text-gray-600">/ {maxPoints}</span>
                      </div>
                      {selectedOption && (
                        <p className="text-sm mt-2">
                          {selectedOption.is_correct ? (
                            <span className="text-green-600 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Correct answer - suggest full points ({maxPoints})
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              Incorrect answer - suggest 0 points
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comments & Feedback
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => handleCommentChange(question.id, e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Provide feedback for this answer..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <button
              onClick={() => window.location.href = '/teacher'}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {Object.keys(grades).length === questions.length ? (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    All questions graded
                  </span>
                ) : (
                  <span className="text-yellow-600">
                    {questions.length - Object.keys(grades).length} questions remaining
                  </span>
                )}
              </div>
              <button
                onClick={handleSubmitGrading}
                disabled={saving || Object.keys(grades).length !== questions.length}
                className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Submit Final Grade
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}