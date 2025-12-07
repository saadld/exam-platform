// src/pages/EditExam.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  open_date: string;
  close_date: string;
  anti_cheat_enabled: boolean;
}

interface Question {
  id?: string;
  question_text: string;
  points: number;
  order_number: number;
  question_type: string;
  correct_answer?: string;
  question_options?: QuestionOption[];
}

interface QuestionOption {
  id?: string;
  option_text: string;
  is_correct: boolean;
  order_number: number;
}

export function EditExam() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam>({
    id: '',
    title: '',
    description: '',
    duration_minutes: 60,
    open_date: new Date().toISOString().slice(0, 16),
    close_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    anti_cheat_enabled: false
  });
  const [questions, setQuestions] = useState<Question[]>([{
    question_text: '',
    points: 10,
    order_number: 1,
    question_type: 'mcq',
    question_options: [
      { option_text: '', is_correct: false, order_number: 1 },
      { option_text: '', is_correct: false, order_number: 2 },
      { option_text: '', is_correct: false, order_number: 3 },
      { option_text: '', is_correct: false, order_number: 4 }
    ]
  }]);

  // Get examId from URL
  const getExamIdFromUrl = () => {
    const path = window.location.pathname;
    const match = path.match(/\/teacher\/exams\/([^/]+)\/edit/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const examId = getExamIdFromUrl();
    if (examId) {
      if (examId === 'create') {
        setLoading(false);
      } else {
        loadExamData(examId);
      }
    }
  }, []);

  const loadExamData = async (examId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExam({
        ...examData,
        open_date: examData.open_date.slice(0, 16),
        close_date: examData.close_date.slice(0, 16)
      });

      // Load questions with options
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

    } catch (error: any) {
      console.error('Error loading exam data:', error);
      setError(error.message || 'Failed to load exam data.');
    } finally {
      setLoading(false);
    }
  };

  const handleExamChange = (field: keyof Exam, value: any) => {
    setExam(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleOptionChange = (qIndex: number, oIndex: number, field: keyof QuestionOption, value: any) => {
    setQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex].question_options) {
        updated[qIndex].question_options![oIndex] = {
          ...updated[qIndex].question_options![oIndex],
          [field]: value
        };
      }
      return updated;
    });
  };

  const handleOptionCorrectChange = (qIndex: number, oIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex].question_options) {
        // For MCQ and True/False, only one option can be correct
        if (updated[qIndex].question_type === 'mcq' || updated[qIndex].question_type === 'true_false') {
          updated[qIndex].question_options = updated[qIndex].question_options!.map((opt, idx) => ({
            ...opt,
            is_correct: idx === oIndex
          }));
        } else {
          updated[qIndex].question_options![oIndex].is_correct = !updated[qIndex].question_options![oIndex].is_correct;
        }
      }
      return updated;
    });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      points: 10,
      order_number: questions.length + 1,
      question_type: 'mcq',
      question_options: [
        { option_text: '', is_correct: false, order_number: 1 },
        { option_text: '', is_correct: false, order_number: 2 },
        { option_text: '', is_correct: false, order_number: 3 },
        { option_text: '', is_correct: false, order_number: 4 }
      ]
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('Exam must have at least one question.');
      return;
    }
    if (window.confirm('Delete this question?')) {
      const updated = questions.filter((_, i) => i !== index);
      // Reorder questions
      updated.forEach((q, i) => q.order_number = i + 1);
      setQuestions(updated);
    }
  };

  const addOption = (qIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex].question_options) {
        updated[qIndex].question_options!.push({
          option_text: '',
          is_correct: false,
          order_number: updated[qIndex].question_options!.length + 1
        });
      }
      return updated;
    });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      if (updated[qIndex].question_options && updated[qIndex].question_options!.length > 2) {
        updated[qIndex].question_options = updated[qIndex].question_options!.filter((_, i) => i !== oIndex);
        // Reorder options
        updated[qIndex].question_options!.forEach((opt, i) => opt.order_number = i + 1);
      }
      return updated;
    });
  };

  const validateExam = () => {
    if (!exam.title.trim()) {
      setError('Exam title is required.');
      return false;
    }
    if (!exam.description.trim()) {
      setError('Exam description is required.');
      return false;
    }
    if (exam.duration_minutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return false;
    }
    if (new Date(exam.close_date) <= new Date(exam.open_date)) {
      setError('Close date must be after open date.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1}: Text is required.`);
        return false;
      }
      if (q.points <= 0) {
        setError(`Question ${i + 1}: Points must be greater than 0.`);
        return false;
      }
      if (q.question_type === 'mcq' && q.question_options) {
        const hasCorrect = q.question_options.some(opt => opt.is_correct);
        if (!hasCorrect) {
          setError(`Question ${i + 1}: At least one option must be marked as correct.`);
          return false;
        }
        for (let j = 0; j < q.question_options.length; j++) {
          if (!q.question_options[j].option_text.trim()) {
            setError(`Question ${i + 1}: Option ${j + 1} text is required.`);
            return false;
          }
        }
      }
      if ((q.question_type === 'short_answer' || q.question_type === 'long_answer') && !q.correct_answer?.trim()) {
        setError(`Question ${i + 1}: Correct answer is required for short/long answer questions.`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateExam()) return;

    setSaving(true);
    setError(null);

    try {
      const examId = getExamIdFromUrl();
      const isUpdate = examId && examId !== 'create';

      // 1. Save/Update exam
      let finalExamId = exam.id;
      if (isUpdate) {
        const { error: examError } = await supabase
          .from('exams')
          .update({
            title: exam.title,
            description: exam.description,
            duration_minutes: exam.duration_minutes,
            open_date: exam.open_date,
            close_date: exam.close_date,
            anti_cheat_enabled: exam.anti_cheat_enabled
          })
          .eq('id', examId);

        if (examError) throw examError;
        finalExamId = examId;
      } else {
        const { data: newExam, error: examError } = await supabase
          .from('exams')
          .insert({
            title: exam.title,
            description: exam.description,
            duration_minutes: exam.duration_minutes,
            open_date: exam.open_date,
            close_date: exam.close_date,
            anti_cheat_enabled: exam.anti_cheat_enabled,
            created_by: profile?.id
          })
          .select()
          .single();

        if (examError) throw examError;
        finalExamId = newExam.id;
      }

      // 2. Delete existing questions if updating
      if (isUpdate) {
        const { error: deleteError } = await supabase
          .from('questions')
          .delete()
          .eq('exam_id', finalExamId);

        if (deleteError) throw deleteError;
      }

      // 3. Save questions
      for (const question of questions) {
        const { data: savedQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            exam_id: finalExamId,
            question_text: question.question_text,
            points: question.points,
            order_number: question.order_number,
            question_type: question.question_type,
            correct_answer: question.correct_answer
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // 4. Save question options if they exist
        if (question.question_options && question.question_options.length > 0) {
          const optionsToInsert = question.question_options.map(option => ({
            question_id: savedQuestion.id,
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

      alert(isUpdate ? 'Exam updated successfully!' : 'Exam created successfully!');
      window.location.href = `/teacher/exams/${finalExamId}`;

    } catch (error: any) {
      console.error('Error saving exam:', error);
      setError(`Failed to save exam: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    const examId = getExamIdFromUrl();
    if (examId && examId !== 'create') {
      window.location.href = `/teacher/exams/${examId}`;
    } else {
      window.location.href = '/teacher';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam data...</p>
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
              Cancel
            </button>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Exam
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
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getExamIdFromUrl() === 'create' ? 'Create New Exam' : 'Edit Exam'}
          </h1>
          <p className="text-gray-600">Configure exam settings and questions</p>
        </div>

        {/* Exam Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam Title *
              </label>
              <input
                type="text"
                value={exam.title}
                onChange={(e) => handleExamChange('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter exam title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) *
              </label>
              <input
                type="number"
                value={exam.duration_minutes}
                onChange={(e) => handleExamChange('duration_minutes', parseInt(e.target.value) || 60)}
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={exam.description}
                onChange={(e) => handleExamChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter exam description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Open Date *
              </label>
              <input
                type="datetime-local"
                value={exam.open_date}
                onChange={(e) => handleExamChange('open_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Close Date *
              </label>
              <input
                type="datetime-local"
                value={exam.close_date}
                onChange={(e) => handleExamChange('close_date', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="anti-cheat"
                  checked={exam.anti_cheat_enabled}
                  onChange={(e) => handleExamChange('anti_cheat_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="anti-cheat" className="ml-2 text-sm text-gray-700">
                  Enable anti-cheat protection
                </label>
                <AlertTriangle className="w-4 h-4 text-orange-500 ml-2" />
                <span className="text-xs text-gray-500 ml-2">
                  (Warns students if they switch tabs or windows during the exam)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Questions ({questions.length})</h2>
            <button
              onClick={addQuestion}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((question, qIndex) => (
              <div key={qIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900 mr-4">
                      Question {qIndex + 1}
                    </span>
                    <button
                      onClick={() => removeQuestion(qIndex)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div>
                      <label className="text-sm text-gray-700 mr-2">Type:</label>
                      <select
                        value={question.question_type}
                        onChange={(e) => handleQuestionChange(qIndex, 'question_type', e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="mcq">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-700 mr-2">Points:</label>
                      <input
                        type="number"
                        value={question.points}
                        onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-20 px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter the question text"
                  />
                </div>

                {/* Options for MCQ */}
                {(question.question_type === 'mcq' || question.question_type === 'true_false') && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Options *
                      </label>
                      <button
                        onClick={() => addOption(qIndex)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Add Option
                      </button>
                    </div>
                    <div className="space-y-3">
                      {question.question_options?.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center space-x-3">
                          <button
                            onClick={() => handleOptionCorrectChange(qIndex, oIndex)}
                            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                              option.is_correct
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {option.is_correct ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={option.option_text}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, 'option_text', e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Option ${oIndex + 1}`}
                          />
                          {question.question_options!.length > 2 && (
                            <button
                              onClick={() => removeOption(qIndex, oIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Correct Answer for Short/Long Answer */}
                {(question.question_type === 'short_answer' || question.question_type === 'long_answer') && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Correct Answer *
                    </label>
                    {question.question_type === 'short_answer' ? (
                      <input
                        type="text"
                        value={question.correct_answer || ''}
                        onChange={(e) => handleQuestionChange(qIndex, 'correct_answer', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter the correct answer"
                      />
                    ) : (
                      <textarea
                        value={question.correct_answer || ''}
                        onChange={(e) => handleQuestionChange(qIndex, 'correct_answer', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter the correct answer"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Exam
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}