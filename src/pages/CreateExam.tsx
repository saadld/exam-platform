import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Plus, Trash2, FileText, Clock } from 'lucide-react';

interface Question {
  id?: string;
  question_type: 'mcq' | 'true_false' | 'short_answer' | 'long_answer';
  question_text: string;
  points: number;
  correct_answer: string;
  order_number: number;
  options: QuestionOption[];
}

interface QuestionOption {
  id?: string;
  option_text: string;
  is_correct: boolean;
  order_number: number;
}

export function CreateExam() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    duration_minutes: 60,
    open_date: new Date().toISOString().slice(0, 16),
    close_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    anti_cheat_enabled: true,
    max_warnings: 2,
    allow_review: false,
  });

  const [questions, setQuestions] = useState<Question[]>([
    {
      question_type: 'mcq',
      question_text: '',
      points: 1,
      correct_answer: '',
      order_number: 1,
      options: [
        { option_text: '', is_correct: true, order_number: 1 },
        { option_text: '', is_correct: false, order_number: 2 },
      ]
    }
  ]);

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      question_type: 'mcq',
      question_text: '',
      points: 1,
      correct_answer: '',
      order_number: questions.length + 1,
      options: [
        { option_text: '', is_correct: true, order_number: 1 },
        { option_text: '', is_correct: false, order_number: 2 },
      ]
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      const newQuestions = questions.filter((_, i) => i !== index);
      const reorderedQuestions = newQuestions.map((q, i) => ({
        ...q,
        order_number: i + 1
      }));
      setQuestions(reorderedQuestions);
    }
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex].option_text = value;
    setQuestions(newQuestions);
  };

  const handleCorrectOptionChange = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    // Set all options to false first
    newQuestions[questionIndex].options.forEach(opt => {
      opt.is_correct = false;
    });
    // Set selected option to true
    newQuestions[questionIndex].options[optionIndex].is_correct = true;
    setQuestions(newQuestions);
  };

  const handleAddOption = (questionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.push({
      option_text: '',
      is_correct: false,
      order_number: newQuestions[questionIndex].options.length + 1
    });
    setQuestions(newQuestions);
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].options.length > 2) {
      newQuestions[questionIndex].options.splice(optionIndex, 1);
      // Reorder options
      newQuestions[questionIndex].options = newQuestions[questionIndex].options.map((opt, i) => ({
        ...opt,
        order_number: i + 1
      }));
      setQuestions(newQuestions);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;
    
    setLoading(true);
    
    try {
      // Create exam
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          ...examData,
          teacher_id: profile.id,
        })
        .select()
        .single();

      if (examError) throw examError;

      // Create questions
      for (const question of questions) {
        const { data: createdQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            exam_id: exam.id,
            question_type: question.question_type,
            question_text: question.question_text,
            points: question.points,
            correct_answer: question.correct_answer,
            order_number: question.order_number,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Create options for MCQ
        if (question.question_type === 'mcq') {
          const optionsToInsert = question.options.map(opt => ({
            question_id: createdQuestion.id,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            order_number: opt.order_number,
          }));

          const { error: optionsError } = await supabase
            .from('question_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      }

      alert('Exam created successfully!');
      window.location.href = '/teacher';
      
    } catch (error: any) {
      console.error('Error creating exam:', error);
      alert(`Failed to create exam: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Exam
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Exam</h1>
          <p className="text-gray-600">Configure exam settings and add questions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Exam Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Exam Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  value={examData.title}
                  onChange={(e) => setExamData({...examData, title: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Midterm Exam - Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    required
                    min="1"
                    value={examData.duration_minutes}
                    onChange={(e) => setExamData({...examData, duration_minutes: parseInt(e.target.value)})}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opens At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={examData.open_date}
                    onChange={(e) => setExamData({...examData, open_date: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Closes At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={examData.close_date}
                    onChange={(e) => setExamData({...examData, close_date: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={examData.description}
                  onChange={(e) => setExamData({...examData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Exam description and instructions..."
                />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((question, qIndex) => (
                <div key={qIndex} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <span className="text-lg font-semibold text-gray-900 mr-3">
                        Question {qIndex + 1}
                      </span>
                      <select
                        value={question.question_type}
                        onChange={(e) => handleQuestionChange(qIndex, 'question_type', e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="mcq">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                      </select>
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question Text *
                      </label>
                      <textarea
                        required
                        value={question.question_text}
                        onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your question here..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Points *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={question.points}
                        onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Options for MCQ */}
                    {question.question_type === 'mcq' && (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <label className="block text-sm font-medium text-gray-700">
                            Options *
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIndex)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Option
                          </button>
                        </div>

                        <div className="space-y-3">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-3">
                              <input
                                type="radio"
                                name={`question-${qIndex}-correct`}
                                checked={option.is_correct}
                                onChange={() => handleCorrectOptionChange(qIndex, oIndex)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <input
                                type="text"
                                required
                                value={option.option_text}
                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter option text..."
                              />
                              {question.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(qIndex, oIndex)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Correct Answer for other types */}
                    {question.question_type !== 'mcq' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Correct Answer
                        </label>
                        <textarea
                          value={question.correct_answer}
                          onChange={(e) => handleQuestionChange(qIndex, 'correct_answer', e.target.value)}
                          rows={question.question_type === 'long_answer' ? 4 : 2}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter the correct answer..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}