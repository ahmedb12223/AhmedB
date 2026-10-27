import React from 'react';
import { Video, Plus, UserCheck, ChevronDown, Settings } from 'lucide-react';
import { TeacherProfile } from '../types';

interface NavbarProps {
  activeTab: 'sessions' | 'classes' | 'history';
  onSelectTab: (tab: 'sessions' | 'classes' | 'history') => void;
  onOpenCreateSession: () => void;
  onOpenTeacherProfile: () => void;
  currentTeacher: TeacherProfile;
  allTeachers: TeacherProfile[];
  onSwitchTeacher: (teacherId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateSession,
  onOpenTeacherProfile,
  currentTeacher,
  allTeachers,
  onSwitchTeacher,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-6 h-16">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Video className="w-5 h-5" />
          </div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('sessions');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors"
          >
            بوابة تحضير زوم الذكية
          </a>
        </div>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onSelectTab('sessions')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'sessions'
                ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 py-5 -mb-px'
                : 'text-slate-600'
            }`}
          >
            الحصص والتحضير
          </button>

          <button
            onClick={() => onSelectTab('classes')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'classes'
                ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 py-5 -mb-px'
                : 'text-slate-600'
            }`}
          >
            الفصول وقوائم الطلاب
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'history'
                ? 'text-indigo-600 font-bold border-b-2 border-indigo-600 py-5 -mb-px'
                : 'text-slate-600'
            }`}
          >
            أرشيف الحضور
          </button>
        </nav>

        {/* Zone 3: Teacher Dropdown Selector + Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Teacher Dropdown Selector (دخول المعلم عبر القائمة المنسدلة) */}
          <div className="relative flex items-center bg-slate-50 border border-slate-300 hover:border-indigo-400 rounded-xl px-2.5 py-1.5 transition-all shadow-2xs">
            <UserCheck className="w-4 h-4 text-indigo-600 shrink-0 ml-1.5" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 font-medium leading-none">
                دخول المعلم (اختر اسمك)
              </span>
              <select
                value={currentTeacher.id}
                onChange={(e) => onSwitchTeacher(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-1 pl-4 appearance-none"
              >
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id} className="text-slate-900 font-normal">
                    {t.name} - {t.subject}
                  </option>
                ))}
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none mr-1" />
          </div>

          <button
            onClick={onOpenTeacherProfile}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="إعدادات حساب المعلم ورابط زوم الافتراضي"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCreateSession}
            className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>حصة جديدة</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-100 py-2 bg-slate-50/50 text-xs">
        <button
          onClick={() => onSelectTab('sessions')}
          className={`px-3 py-1 font-semibold ${activeTab === 'sessions' ? 'text-indigo-600' : 'text-slate-600'}`}
        >
          الحصص والتحضير
        </button>
        <button
          onClick={() => onSelectTab('classes')}
          className={`px-3 py-1 font-semibold ${activeTab === 'classes' ? 'text-indigo-600' : 'text-slate-600'}`}
        >
          الفصول والطلاب
        </button>
        <button
          onClick={() => onSelectTab('history')}
          className={`px-3 py-1 font-semibold ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-600'}`}
        >
          الأرشيف
        </button>
      </div>
    </header>
  );
};
