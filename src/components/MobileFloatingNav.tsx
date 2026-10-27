import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Share2,
  Video,
  School,
  Users,
  MessageCircle,
  Sparkles,
  ChevronLeft,
  Check
} from 'lucide-react';
import { ClassSession, TeacherProfile } from '../types';
import { getSubjectColorTheme } from './SimpleNavbar';
import { TeacherPickerModal } from './TeacherPickerModal';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface MobileFloatingNavProps {
  activeTab: 'sessions' | 'classes' | 'settings';
  onTabChange: (tab: 'sessions' | 'classes' | 'settings') => void;
  onQuickAddClick: () => void;
  currentTeacher: TeacherProfile;
  allTeachers: TeacherProfile[];
  onSwitchTeacher: (id: string) => void;
  sessionsCount: number;
  classesCount: number;
  latestSession?: ClassSession | null;
  onOpenAiCopilot?: () => void;
}

export const MobileFloatingNav: React.FC<MobileFloatingNavProps> = ({
  activeTab,
  onTabChange,
  onQuickAddClick,
  currentTeacher,
  allTeachers,
  onSwitchTeacher,
  sessionsCount,
  classesCount,
  latestSession,
  onOpenAiCopilot,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const fabRef = useRef<HTMLDivElement>(null);

  const teacherTheme = getSubjectColorTheme(currentTeacher.subject);
  const teacherInitials =
    currentTeacher.name.replace(/^(مستر|مسيو|أ\.|\s)+/, '').slice(0, 2) ||
    currentTeacher.name.slice(0, 2);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Hide initial tooltip after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleWhatsAppShare = () => {
    if (latestSession) {
      const link = buildStudentAttendanceLink(latestSession, currentTeacher);
      const text = `📢 رابط حضور حصة ${latestSession.sessionTitle} مع المعلم ${currentTeacher.name}:\n${link}\n\nيرجى الدخول لتسجيل الحضور ثم الانتقال مباشرة لغرفة زوم.`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else {
      onQuickAddClick();
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop overlay when speed dial is open */}
      {isOpen && (
        <div
          role="presentation"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200"
        />
      )}

      {/* Floating Speed Dial Container (Anchored at bottom-left in RTL) */}
      <div
        ref={fabRef}
        className="fixed bottom-5 left-5 z-40 dir-rtl flex flex-col items-start select-none"
        aria-label="قائمة الإجراءات السريعة العائمة"
      >
        {/* Expanded Speed Dial Action Cards */}
        {isOpen && (
          <div className="mb-3 flex flex-col gap-2.5 items-start w-[calc(100vw-2.5rem)] max-w-xs sm:w-80 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200 origin-bottom-left">
            {/* Action 0: المساعد الذكي AI */}
            {onOpenAiCopilot && (
              <button
                type="button"
                onClick={() => {
                  onOpenAiCopilot();
                  setIsOpen(false);
                }}
                className="w-full p-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer border border-violet-400/30 active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-white">
                        المساعد الذكي (AI)
                      </span>
                      <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-md">
                        مصري 🇪🇬
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-100 font-medium">
                      تعديل الجدول والأوامر بالذكاء الاصطناعي
                    </div>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-white/80 group-hover:text-white transition-transform group-hover:-translate-x-1" />
              </button>
            )}

            {/* Action 1: إضافة حصة جديدة */}
            <button
              type="button"
              onClick={() => {
                onQuickAddClick();
                setIsOpen(false);
              }}
              className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer ring-1 ring-black/5 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    إضافة حصة جديدة
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    اختيار الفصل وتوليد الرابط فوراً
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:-translate-x-1" />
            </button>

            {/* Action 2: مشاركة واتساب للحصة */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full p-3 bg-white hover:bg-emerald-50/50 border border-emerald-200/90 rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer ring-1 ring-emerald-500/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                    مشاركة رابط واتساب
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold truncate max-w-[170px]">
                    {latestSession ? `حصة ${latestSession.className}` : 'إرسال رابط الحصة للطلاب'}
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-emerald-600 transition-transform group-hover:-translate-x-1" />
            </button>

            {/* Action 3: إدارة الفصول والطلاب */}
            <button
              type="button"
              onClick={() => {
                onTabChange('classes');
                setIsOpen(false);
              }}
              className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer ring-1 ring-black/5 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30 group-hover:scale-105 transition-transform shrink-0">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-sky-600 transition-colors">
                    إدارة الفصول والطلاب
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {classesCount} فصول دراسية معتمدة
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:-translate-x-1" />
            </button>

            {/* Action 4: الإعدادات الشاملة */}
            <button
              type="button"
              onClick={() => {
                onTabChange('settings');
                setIsOpen(false);
              }}
              className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer ring-1 ring-black/5 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
                  ⚙️
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    إعدادات المنصة
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    الجدول، واتساب، النطاق، المزامنة، القفل
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:-translate-x-1" />
            </button>

            {/* Action 5: تبديل المعلم */}
            <button
              type="button"
              onClick={() => {
                setShowTeacherModal(true);
                setIsOpen(false);
              }}
              className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xl flex items-center justify-between text-right transition-all group cursor-pointer ring-1 ring-black/5 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${teacherTheme.bg} text-white flex items-center justify-center font-black text-xs shadow-md shrink-0`}>
                  {teacherInitials}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    تبديل المعلم الحالي
                  </div>
                  <div className="text-[11px] text-slate-500 font-bold truncate max-w-[170px]">
                    {currentTeacher.name} ({currentTeacher.subject})
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>
        )}

        {/* The Main Circular Floating Action Button (FAB) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setShowTooltip(false);
            }}
            className={`w-14 h-14 sm:w-15 sm:h-15 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 cursor-pointer ring-4 ring-white active:scale-95 ${
              isOpen
                ? 'bg-slate-900 shadow-slate-900/40 rotate-90'
                : 'bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 shadow-indigo-600/40 hover:scale-105'
            }`}
            title="قائمة الإجراءات السريعة"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            {isOpen ? (
              <X className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Plus className="w-7 h-7 stroke-[2.5]" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600" />
              </div>
            )}
          </button>

          {/* Quick Helper Tooltip pill on initial load or closed state */}
          {!isOpen && showTooltip && (
            <div className="bg-slate-900 text-white text-xs font-black py-1.5 px-3 rounded-xl shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>إجراءات سريعة للجوال</span>
            </div>
          )}
        </div>
      </div>

      {/* Teacher Picker Modal */}
      <TeacherPickerModal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
        currentTeacher={currentTeacher}
        allTeachers={allTeachers}
        onSelectTeacher={onSwitchTeacher}
      />
    </>
  );
};
