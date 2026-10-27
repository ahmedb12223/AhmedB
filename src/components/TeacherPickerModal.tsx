import React, { useState } from 'react';
import { X, Search, Check, Users, Sparkles } from 'lucide-react';
import { TeacherProfile } from '../types';
import { getSubjectColorTheme } from './SimpleNavbar';

interface TeacherPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeacher: TeacherProfile;
  allTeachers: TeacherProfile[];
  onSelectTeacher: (id: string) => void;
}

export const TeacherPickerModal: React.FC<TeacherPickerModalProps> = ({
  isOpen,
  onClose,
  currentTeacher,
  allTeachers,
  onSelectTeacher,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTeachers = allTeachers.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in dir-rtl">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                اختيار المعلم الحالي
              </h3>
              <p className="text-xs text-slate-500">
                اختر حساب المعلم لتحديث الحصص والفصول المعروضة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3.5 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المعلم أو المادة..."
              className="w-full pr-10 pl-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-right font-medium"
            />
          </div>
        </div>

        {/* List of Teachers */}
        <div className="p-3.5 overflow-y-auto space-y-2 flex-1">
          {filteredTeachers.map((teacher) => {
            const isSelected = teacher.id === currentTeacher.id;
            const theme = getSubjectColorTheme(teacher.subject);
            const initials =
              teacher.name.replace(/^(مستر|مسيو|أ\.|\s)+/, '').slice(0, 2) ||
              teacher.name.slice(0, 2);

            return (
              <div
                key={teacher.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelectTeacher(teacher.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSelectTeacher(teacher.id);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-2xl cursor-pointer flex items-center justify-between transition-all border ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 font-bold shadow-xs ring-2 ring-indigo-500/10'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl ${theme.bg} text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0`}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>{teacher.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {teacher.subject}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl ${theme.lightBg} ${theme.text} border ${theme.border}`}
                  >
                    {theme.label}
                  </span>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          المدرسة المعتمدة: <span className="font-bold text-slate-700">{currentTeacher.schoolName}</span>
        </div>
      </div>
    </div>
  );
};
