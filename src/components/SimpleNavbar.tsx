import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Video,
  Check,
  Search,
  School,
  X,
  Users,
  BookOpen,
  Sparkles,
  CloudOff,
  WifiOff,
  Lock,
  KeyRound,
  ShieldCheck,
  MessageCircle,
  Calendar,
  Cloud,
} from 'lucide-react';
import { TeacherProfile } from '../types/index.ts';
import { isOnline, hasPendingOfflineChanges } from '../utils/apiSync';
import { isAhmedBadawi } from '../utils/storage';

interface SimpleNavbarProps {
  currentTeacher: TeacherProfile;
  allTeachers: TeacherProfile[];
  onSwitchTeacher: (id: string) => void;
  onOpenRosterModal: () => void;
  onResetData: () => void;
  onGoHome?: () => void;
  currentClassName?: string;
  activeMainTab?: 'sessions' | 'classes' | 'settings';
  onTabChange?: (tab: 'sessions' | 'classes' | 'settings') => void;
  onLockDashboard?: () => void;
  onOpenPasswordModal?: () => void;
  onManualSync?: () => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  onOpenMasterSyncModal?: () => void;
  onOpenWhatsAppHub?: () => void;
  onOpenScheduleModal?: () => void;
}

// Subject-themed styling for avatars & badges
export function getSubjectColorTheme(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes('رياض') || s.includes('math')) {
    return {
      bg: 'bg-gradient-to-br from-blue-600 to-indigo-700',
      lightBg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      label: 'رياضيات',
    };
  }
  if (s.includes('علوم') || s.includes('science')) {
    return {
      bg: 'bg-gradient-to-br from-emerald-600 to-teal-700',
      lightBg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      label: 'علوم',
    };
  }
  if (s.includes('إنجليز') || s.includes('english')) {
    return {
      bg: 'bg-gradient-to-br from-purple-600 to-pink-700',
      lightBg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      label: 'إنجليزي',
    };
  }
  if (s.includes('عرب') || s.includes('arabic')) {
    return {
      bg: 'bg-gradient-to-br from-amber-600 to-orange-700',
      lightBg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      label: 'عربي',
    };
  }
  if (s.includes('إسلام') || s.includes('قرآن') || s.includes('فقه') || s.includes('islamic')) {
    return {
      bg: 'bg-gradient-to-br from-teal-600 to-emerald-800',
      lightBg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      label: 'إسلاميات',
    };
  }
  if (s.includes('حاسب') || s.includes('ict') || s.includes('تكنولوجيا')) {
    return {
      bg: 'bg-gradient-to-br from-cyan-600 to-blue-800',
      lightBg: 'bg-cyan-50',
      text: 'text-cyan-700',
      border: 'border-cyan-200',
      label: 'حاسب آلي',
    };
  }
  if (s.includes('دراسات') || s.includes('social') || s.includes('تاريخ')) {
    return {
      bg: 'bg-gradient-to-br from-rose-600 to-red-700',
      lightBg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      label: 'دراسات',
    };
  }
  return {
    bg: 'bg-gradient-to-br from-indigo-600 to-violet-700',
    lightBg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    label: 'مادة أساسية',
  };
}

export const SimpleNavbar: React.FC<SimpleNavbarProps> = ({
  currentTeacher,
  allTeachers,
  onSwitchTeacher,
  onResetData,
  onGoHome,
  currentClassName,
  activeMainTab = 'sessions',
  onTabChange,
  onLockDashboard,
  onOpenPasswordModal,
  onManualSync,
  syncStatus = 'idle',
  onOpenMasterSyncModal,
  onOpenWhatsAppHub,
  onOpenScheduleModal,
}) => {
  const isOwner = isAhmedBadawi(currentTeacher);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [hasPending, setHasPending] = useState(hasPendingOfflineChanges());

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    const checkStatus = () => {
      setIsOffline(!isOnline());
      setHasPending(hasPendingOfflineChanges());
    };
    const interval = setInterval(checkStatus, 3000);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', checkStatus);
    window.addEventListener('offline', checkStatus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', checkStatus);
      window.removeEventListener('offline', checkStatus);
    };
  }, []);

  const currentTheme = getSubjectColorTheme(currentTeacher.subject);
  const currentInitials =
    currentTeacher.name.replace(/^(مستر|مسيو|أ\.|\s)+/, '').slice(0, 2) ||
    currentTeacher.name.slice(0, 2);

  const filteredTeachers = allTeachers.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-40 shadow-xs dir-rtl w-full overflow-hidden sm:overflow-visible">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1 sm:gap-3 w-full">
        {/* Brand & Home Link */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onGoHome}
            type="button"
            className="flex items-center gap-1.5 sm:gap-2.5 text-right hover:opacity-95 transition-opacity cursor-pointer group min-w-0"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform shrink-0">
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="text-xs sm:text-base font-extrabold text-slate-900 leading-tight truncate max-w-[100px] xs:max-w-[140px] sm:max-w-none">
                  تحضير زوم الذكي
                </h1>
                {currentClassName && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hidden md:inline-block shrink-0">
                    فصل {currentClassName}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden lg:block truncate">
                إدارة الفصول والروابط والتحضير المباشر
              </p>
            </div>
          </button>
        </div>

        {/* Center: Polished Teacher Selector Dropdown */}
        <div ref={dropdownRef} className="relative shrink min-w-0">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 sm:gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 rounded-xl py-1 sm:py-1.5 px-1.5 sm:px-2.5 transition-all shadow-2xs cursor-pointer text-right group max-w-[105px] xs:max-w-[150px] sm:max-w-xs min-w-0"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            {/* Teacher Avatar with Gradient */}
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl ${currentTheme.bg} text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-xs shrink-0`}
            >
              {currentInitials}
            </div>

            <div className="flex flex-col text-right overflow-hidden min-w-0">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium leading-none mb-0.5 hidden sm:block">
                المعلم الحالي
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">
                {currentTeacher.name}
              </span>
            </div>

            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${currentTheme.lightBg} ${currentTheme.text} ${currentTheme.border} border hidden md:inline-block truncate max-w-[80px]`}
            >
              {currentTheme.label}
            </span>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                isDropdownOpen ? 'rotate-180 text-indigo-600' : 'group-hover:text-slate-600'
              }`}
            />
          </button>

          {/* Polished Dropdown Menu (Optimized for RTL & Mobile) */}
          {isDropdownOpen && (
            <>
              {/* Backdrop for mobile devices */}
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-200"
                onClick={() => setIsDropdownOpen(false)}
              />

              <div className="fixed top-16 inset-x-3 max-w-sm mx-auto z-50 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-96 sm:max-w-sm sm:mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right flex flex-col max-h-[80vh] sm:max-h-[32rem]">
                {/* Dropdown Header */}
                <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200/80 shrink-0">
                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>قائمة المعلمين ({allTeachers.length})</span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      تبديل فوري
                    </span>
                  </div>

                  {/* Search Input with RTL alignment */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم المعلم أو المادة..."
                      autoFocus
                      className="w-full pr-8 pl-8 py-2 sm:py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Teacher List */}
                <div className="overflow-y-auto divide-y divide-slate-100 p-1.5 grow">
                  {filteredTeachers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-medium">
                      لا يوجد معلم مطابق للبحث "{searchQuery}"
                    </div>
                  ) : (
                    filteredTeachers.map((teacher) => {
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
                            onSwitchTeacher(teacher.id);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onSwitchTeacher(teacher.id);
                              setIsDropdownOpen(false);
                            }
                          }}
                          className={`p-3 sm:p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all my-0.5 touch-manipulation ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Teacher Colored Avatar */}
                            <div
                              className={`w-8 h-8 rounded-xl ${theme.bg} text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}
                            >
                              {initials}
                            </div>

                            <div className="overflow-hidden text-right">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {teacher.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-normal truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[200px]">
                                {teacher.subject}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 mr-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${theme.lightBg} ${theme.text} border ${theme.border}`}
                            >
                              {theme.label}
                            </span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer Tip & Badawi Password Button */}
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
                  <span>المدرسة: {currentTeacher.schoolName}</span>
                  {isOwner && onOpenPasswordModal ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenPasswordModal();
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>تعديل كلمة المرور</span>
                    </button>
                  ) : (
                    <span className="text-indigo-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      حساب معتمد
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Left Side: Navigation & Reset */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {onTabChange && (
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Sessions & Classes Pill Group */}
              <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => onTabChange('sessions')}
                  title="الحصص"
                  aria-label="الحصص"
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    activeMainTab === 'sessions'
                      ? 'bg-white text-indigo-950 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('classes')}
                  title="الفصول"
                  aria-label="الفصول"
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    activeMainTab === 'classes'
                      ? 'bg-white text-emerald-950 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                </button>
              </div>

              {/* Standalone Header Badge for Settings ⚙️ */}
              <button
                type="button"
                onClick={() => onTabChange('settings')}
                className={`flex items-center justify-center p-1.5 sm:p-2 text-xs font-black rounded-lg sm:rounded-xl border transition-all cursor-pointer shadow-2xs ${
                  activeMainTab === 'settings'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-indigo-300'
                }`}
                title="الإعدادات"
                aria-label="الإعدادات"
              >
                <span className="text-xs sm:text-sm leading-none">⚙️</span>
              </button>
            </div>
          )}

          {/* Cloud Sync Status Badge & Action (Mirrors Laptop & Phone seamlessly) */}
          {onManualSync && (
            <button
              type="button"
              onClick={onManualSync}
              disabled={syncStatus === 'syncing'}
              title="مزامنة فورية مع السحابة (لاب توب & هاتف)"
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                syncStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : syncStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 hover:border-indigo-200'
              }`}
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  syncStatus === 'syncing'
                    ? 'animate-spin text-amber-600'
                    : syncStatus === 'synced'
                    ? 'text-emerald-600'
                    : 'text-indigo-600'
                }`}
              />
              <span className="hidden sm:inline font-bold">
                {syncStatus === 'syncing'
                  ? 'مزامنة...'
                  : syncStatus === 'synced'
                  ? 'السحابة متزامنة'
                  : 'مزامنة السحابة'}
              </span>
            </button>
          )}

          {/* Offline / Pending Sync Indicator Badge */}
          {(isOffline || hasPending) && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-1.5 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black shadow-2xs animate-pulse">
              <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
              <span className="hidden md:inline">
                {isOffline ? 'غير متصل (وضع أُفلاين)' : 'جاري مزامنة التغييرات...'}
              </span>
            </div>
          )}
          {/* Reset Demo Data Button */}
          <button
            type="button"
            onClick={onResetData}
            className="p-1 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
            title="استعادة البيانات الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
