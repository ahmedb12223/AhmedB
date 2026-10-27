import React, { useState, useEffect } from 'react';
import { X, Check, GraduationCap, Globe, BookOpen } from 'lucide-react';
import { Student, SchoolClass } from '../types';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  classes: SchoolClass[];
  onSave: (updatedStudent: Student) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  classes,
  onSave,
}) => {
  const [name, setName] = useState(student.name);
  const [track, setTrack] = useState<'english' | 'arabic'>(student.track || 'english');
  const [classId, setClassId] = useState(student.classId);
  const [studentCode, setStudentCode] = useState(student.studentCode || '');

  useEffect(() => {
    setName(student.name);
    setTrack(student.track || 'english');
    setClassId(student.classId);
    setStudentCode(student.studentCode || '');
  }, [student?.id, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...student,
      name: name.trim(),
      track,
      classId,
      studentCode: studentCode.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in dir-rtl">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تعديل بيانات الطالب ونقله</h3>
              <p className="text-xs text-slate-500">تغيير الاسم أو المسار (لغات / عربي) أو الفصل</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              اسم الطالب الثلاثي أو الرباعي:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
            />
          </div>

          {/* Track Selection (English / Arabic) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              تحديد مسار الطالب (لغات / عربي):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTrack('english')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  track === 'english'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>مسار اللغات (English)</span>
              </button>

              <button
                type="button"
                onClick={() => setTrack('arabic')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  track === 'arabic'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>المسار العربي (Arabic)</span>
              </button>
            </div>
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              الفصل الدراسي:
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  فصل {c.name} - ({c.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Student Code */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              كود الطالب (اختياري):
            </label>
            <input
              type="text"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="مثال: ST-1002"
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
