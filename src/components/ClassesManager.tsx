import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Users,
  Search,
  Check,
  X,
  Layers,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { SchoolClass, Student, LanguageTrack } from '../types';

interface ClassesManagerProps {
  classes: SchoolClass[];
  students: Student[];
  onAddClass: (name: string, gradeLevel: string, description?: string) => void;
  onUpdateClass: (id: string, name: string, gradeLevel: string) => void;
  onDeleteClass: (id: string) => void;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onDeleteStudent: (id: string) => void;
  onOpenExcelUpload: () => void;
}

export const ClassesManager: React.FC<ClassesManagerProps> = ({
  classes,
  students,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onAddStudent,
  onDeleteStudent,
  onOpenExcelUpload,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState<'all' | 'english' | 'arabic'>('all');

  // New class modal state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('الصف الأول الإعدادي (Prep 1)');

  // New student inline form
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentTrack, setNewStudentTrack] = useState<'english' | 'arabic'>('english');
  const [newStudentCode, setNewStudentCode] = useState('');

  // Editing class state
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassGrade, setEditClassGrade] = useState('');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const classStudents = students.filter(
    (s) => s.classId === (currentClass ? currentClass.id : '')
  );

  const filteredStudents = classStudents.filter((student) => {
    const matchesTrack = trackFilter === 'all' || student.track === trackFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentCode && student.studentCode.includes(searchQuery));
    return matchesTrack && matchesSearch;
  });

  const englishCount = classStudents.filter((s) => s.track === 'english').length;
  const arabicCount = classStudents.filter((s) => s.track === 'arabic').length;

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    onAddClass(newClassName.trim(), newClassGrade);
    setNewClassName('');
    setShowAddClassModal(false);
  };

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !currentClass) return;

    onAddStudent({
      name: newStudentName.trim(),
      classId: currentClass.id,
      track: newStudentTrack,
      studentCode: newStudentCode.trim() || undefined,
    });

    setNewStudentName('');
    setNewStudentCode('');
    setShowAddStudentForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Primary Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>إدارة الفصول وقوائم الطلاب (Roster Management)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تنظيم كشوف الفصول، مسارات اللغات والعربي، ورفع كشوف الإكسيل التلقائية
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenExcelUpload}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>إدخال ولصق كشف الأسماء (نصي / Excel)</span>
          </button>
          <button
            onClick={() => setShowAddClassModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فصل جديد</span>
          </button>
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {classes.map((c) => {
          const isSelected = c.id === (currentClass?.id || '');
          const count = students.filter((s) => s.classId === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
              className={`px-4 py-3 rounded-xl border text-right transition-all flex items-center gap-3 shrink-0 ${
                isSelected
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {c.name}
              </div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>فصل {c.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-normal">
                  {count} طالب · {c.gradeLevel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Class Overview & Students List */}
      {currentClass ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          {/* Class top toolbar */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    كشف طلاب فصل {currentClass.name}
                  </h3>
                  <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                    {currentClass.gradeLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  إجمالي {classStudents.length} طالب (مسار اللغات: {englishCount} · المسار العربي: {arabicCount})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddStudentForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>إضافة طالب يدوياً</span>
              </button>
              <button
                onClick={() => {
                  setEditingClassId(currentClass.id);
                  setEditClassName(currentClass.name);
                  setEditClassGrade(currentClass.gradeLevel);
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                title="تعديل اسم الفصل"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {classes.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف فصل ${currentClass.name} وجميع طلابه؟`)) {
                      onDeleteClass(currentClass.id);
                    }
                  }}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف الفصل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Inline Edit Class modal/box */}
          {editingClassId && (
            <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  placeholder="اسم الفصل (مثال: 7A)"
                  className="px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={editClassGrade}
                  onChange={(e) => setEditClassGrade(e.target.value)}
                  placeholder="المرحلة (مثال: Prep 1)"
                  className="px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white flex-1"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (editClassName.trim()) {
                      onUpdateClass(editingClassId, editClassName.trim(), editClassGrade.trim());
                      setEditingClassId(null);
                    }
                  }}
                  className="p-1.5 bg-emerald-600 text-white rounded-md text-xs"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingClassId(null)}
                  className="p-1.5 bg-slate-200 text-slate-700 rounded-md text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Add Student Inline Form */}
          {showAddStudentForm && (
            <form
              onSubmit={handleCreateStudent}
              className="p-4 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center gap-2.5 text-xs"
            >
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="اسم الطالب بالكامل (ثلاثي أو رباعي بالعربي أو بالإنجليزي)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                />
              </div>
              <div className="w-36">
                <select
                  value={newStudentTrack}
                  onChange={(e) => setNewStudentTrack(e.target.value as any)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                >
                  <option value="english">مسار اللغات (English)</option>
                  <option value="arabic">المسار العربي (Arabic)</option>
                </select>
              </div>
              <div className="w-28">
                <input
                  type="text"
                  value={newStudentCode}
                  onChange={(e) => setNewStudentCode(e.target.value)}
                  placeholder="كود الطالب"
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                >
                  إضافة للطالب
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStudentForm(false)}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar & Search */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الطالب أو الكود..."
                className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Track Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setTrackFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  trackFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({classStudents.length})
              </button>
              <button
                onClick={() => setTrackFilter('english')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  trackFilter === 'english'
                    ? 'bg-white text-blue-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مسار اللغات ({englishCount})
              </button>
              <button
                onClick={() => setTrackFilter('arabic')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  trackFilter === 'arabic'
                    ? 'bg-white text-amber-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المسار العربي ({arabicCount})
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto">
            {filteredStudents.length > 0 ? (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">اسم الطالب في الكشف الرسمي</th>
                    <th className="p-3">المسار التعليمي</th>
                    <th className="p-3">كود الطالب</th>
                    <th className="p-3 w-16 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-900 text-sm">
                          {student.name}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                            student.track === 'english'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200/60'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          }`}
                        >
                          {student.track === 'english' ? 'مسار اللغات (English)' : 'المسار العربي (Arabic)'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {student.studentCode || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onDeleteStudent(student.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="حذف الطالب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-10 text-center">
                <p className="text-slate-500 text-sm mb-3">
                  {searchQuery
                    ? 'لم يتم العثور على طالب يطابق البحث.'
                    : 'لا يوجد طلاب مسجلون في هذا الفصل حتى الآن.'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={onOpenExcelUpload}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                  >
                    رفع ملف إكسيل
                  </button>
                  <button
                    onClick={() => setShowAddStudentForm(true)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                  >
                    إضافة طالب يدوياً
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-4">لا يوجد أي فصول مسجلة حالياً.</p>
          <button
            onClick={() => setShowAddClassModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
          >
            إضافة أول فصل دراسي
          </button>
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">إضافة فصل دراسي جديد</h3>
              <button
                onClick={() => setShowAddClassModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم الفصل أو الشعبة (مثال: 7A, 8B, Grade 9)
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="مثال: 7C أو Grade 8"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  المرحلة الدراسية
                </label>
                <input
                  type="text"
                  required
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  placeholder="مثال: الصف الأول الإعدادي (Prep 1)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  حفظ الفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
