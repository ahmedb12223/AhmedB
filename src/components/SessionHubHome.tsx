import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Video,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Users,
  ArrowLeft,
  Sparkles,
  Trash2,
  Clock,
  ChevronUp,
  Edit2,
  School,
  UserCheck,
  Share2,
  ClipboardPaste,
  X,
  FileSpreadsheet,
  Globe,
  BookOpen,
  CheckSquare,
  Square,
  RotateCcw,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile, LanguageTrack } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { EditSessionModal } from './EditSessionModal';
import { ConfirmModal } from './ConfirmModal';
import {
  buildStudentAttendanceLink,
  ensureAbsoluteUrl,
  getPublishedDomain,
  setPublishedDomain,
  DEFAULT_PUBLISHED_DOMAIN
} from '../utils/urlHelper';
import { generateCombinedTeacherAbsenteeReport } from '../utils/whatsappFormatter';
import { normalizeText } from '../utils/arabicFuzzy';
import { isAhmedBadawi } from '../utils/storage';
import { buildWhatsAppReminderMessage, buildWhatsAppChatUrl } from '../utils/whatsappHelper';

interface SessionHubHomeProps {
  currentTeacher: TeacherProfile;
  allTeachers?: TeacherProfile[];
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  onEnterSession: (sessionId: string) => void;
  onOpenPasswordModal?: () => void;
  onCreateSession: (
    classId: string,
    className: string,
    title: string,
    zoomUrl: string,
    targetTrack?: LanguageTrack,
    customSessionId?: string
  ) => ClassSession | void;
  onUpdateSession: (updated: {
    id: string;
    sessionTitle: string;
    classId: string;
    className: string;
    zoomUrl: string;
  }) => void;
  onDeleteSession: (sessionId: string) => void;
  onBatchDeleteSessions?: (sessionIds: string[]) => void;
  onResetAttendance?: (teacherId?: string) => void;
  onOpenStudentGateway?: (sessionId: string) => void;
  onSwitchToClassesTab?: () => void;
  onOpenWhatsAppHub?: () => void;
  onOpenScheduleModal?: () => void;
  onGenerateTodaySessions?: () => void;
  onCreateDemoClass?: (customTime?: string, link?: string) => void;
}

export const SessionHubHome: React.FC<SessionHubHomeProps> = ({
  currentTeacher,
  allTeachers = [],
  classes,
  students,
  sessions,
  onEnterSession,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onBatchDeleteSessions,
  onResetAttendance,
  onOpenStudentGateway,
  onSwitchToClassesTab,
  onOpenPasswordModal,
  onOpenWhatsAppHub,
  onOpenScheduleModal,
  onGenerateTodaySessions,
  onCreateDemoClass,
}) => {
  // Demo class modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoCustomTime, setDemoCustomTime] = useState(() => {
    const now = new Date();
    const future = new Date(now.getTime() + 5 * 60000);
    const h = String(future.getHours()).padStart(2, '0');
    const m = String(future.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [demoGroupLink, setDemoGroupLink] = useState('https://chat.whatsapp.com/JqCig3jD6jp07eUExpFQXS');
  const [genNotice, setGenNotice] = useState<string | null>(null);
  // Collapsible Quick Add Bar State (Compact by default, opens on demand)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // New Session Form State
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [sessionTitle, setSessionTitle] = useState('');

  // Target Track Selection: 'all' | 'english' | 'arabic'
  const [targetTrack, setTargetTrack] = useState<LanguageTrack>('all');

  // Zoom URL: starts completely EMPTY without default mock link
  const [zoomUrl, setZoomUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(`smart_zoom_${currentTeacher.id}`) || '';
    } catch {
      return '';
    }
  });

  // Batch selection for multi-delete & reset
  const [selectedForBatchDelete, setSelectedForBatchDelete] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showResetAttendanceModal, setShowResetAttendanceModal] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const mySessions = sessions.filter(
    (s) => !s.teacherId || s.teacherId === 'teacher_guest' || s.teacherId === currentTeacher.id
  );

  const isAllSelected =
    mySessions.length > 0 &&
    mySessions.every((s) => selectedForBatchDelete.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedForBatchDelete([]);
    } else {
      setSelectedForBatchDelete(mySessions.map((s) => s.id));
    }
  };

  const handleToggleSelectSession = (sessionId: string) => {
    setSelectedForBatchDelete((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleConfirmBatchDelete = () => {
    if (selectedForBatchDelete.length > 0 && onBatchDeleteSessions) {
      onBatchDeleteSessions(selectedForBatchDelete);
      setSelectedForBatchDelete([]);
    }
    setShowBatchDeleteModal(false);
  };

  const handleConfirmResetAttendance = () => {
    if (onResetAttendance) {
      onResetAttendance(currentTeacher.id);
    }
    setShowResetAttendanceModal(false);
  };

  // Modals & Feedback
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string; subtitle: string } | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<ClassSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ClassSession | null>(null);

  // Copied feedback
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [copiedAllAbsentees, setCopiedAllAbsentees] = useState(false);
  const [justCreatedSession, setJustCreatedSession] = useState<ClassSession | null>(null);

  // Initialize selected class if none
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Published domain state & configuration
  const [publishedDomain, setPublishedDomainState] = useState<string>(() => getPublishedDomain());
  const [isEditingDomainBanner, setIsEditingDomainBanner] = useState(false);
  const [domainInputValue, setDomainInputValue] = useState<string>(() => getPublishedDomain());

  // Check student tracks for the selected class
  const activeClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const activeClassStudents = students.filter((s) => s.classId === activeClass?.id);
  const englishTrackCount = activeClassStudents.filter((s) => s.track === 'english').length;
  const arabicTrackCount = activeClassStudents.filter((s) => s.track === 'arabic').length;
  const isMixedTrackClass = englishTrackCount > 0 && arabicTrackCount > 0;

  // Smart Title Generation based on Teacher, Class, and Track
  useEffect(() => {
    const classNameStr = activeClass ? ` - فصل ${activeClass.name}` : '';
    let trackSuffix = '';
    if (targetTrack === 'english') trackSuffix = ' (لغات)';
    if (targetTrack === 'arabic') trackSuffix = ' (عربي)';

    const generatedTitle = `حصة ${currentTeacher.subject}${classNameStr}${trackSuffix}`;
    setSessionTitle((prev) => (prev !== generatedTitle ? generatedTitle : prev));
  }, [currentTeacher.subject, activeClass?.name, targetTrack]);

  // Strictly filter sessions to show ONLY current teacher's sessions
  const displayedSessions = mySessions;

  // Real-time check for upcoming sessions within 0-10 minutes
  const [upcomingAlert, setUpcomingAlert] = useState<{
    session: ClassSession;
    diffMinutes: number;
  } | null>(null);

  useEffect(() => {
    const checkUpcoming = () => {
      const now = new Date();
      const saudiTime = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
      const currentMins = saudiTime.getHours() * 60 + saudiTime.getMinutes();
      const teacherSessions = sessions.filter((s) => s.teacherId === currentTeacher.id);

      for (const s of teacherSessions) {
        if (!s.isActive || !s.scheduledTime) continue;
        const match = s.scheduledTime.match(/(\d{1,2}):(\d{2})\s*(am|pm|ص|م)?/i);
        if (!match) continue;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = (match[3] || '').toLowerCase();
        if ((ampm === 'pm' || ampm === 'م') && h < 12) h += 12;
        if ((ampm === 'am' || ampm === 'ص') && h === 12) h = 0;
        const sessionMins = h * 60 + m;
        const diff = sessionMins - currentMins;
        if (diff >= 0 && diff <= 10) {
          setUpcomingAlert((prev) => {
            if (prev?.session.id === s.id && prev?.diffMinutes === diff) return prev;
            return { session: s, diffMinutes: diff };
          });
          return;
        }
      }
      setUpcomingAlert((prev) => (prev === null ? null : null));
    };

    checkUpcoming();
    const timer = setInterval(checkUpcoming, 15000);
    return () => clearInterval(timer);
  }, [sessions, currentTeacher.id]);

  const handleCopyLink = async (session: ClassSession) => {
    const link = buildStudentAttendanceLink(session, currentTeacher);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWhatsApp = (session: ClassSession) => {
    const targetClass = classes.find((c) => c.id === session.classId);
    const message = buildWhatsAppReminderMessage({
      session,
      schoolClass: targetClass,
      teacher: currentTeacher,
      appUrl: publishedDomain,
    });
    const recipient = targetClass?.whatsappRecipient || '';
    const waUrl = buildWhatsAppChatUrl(recipient, message);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenQr = (session: ClassSession) => {
    const link = buildStudentAttendanceLink(session, currentTeacher);
    setQrModalData({
      url: link,
      title: `رمز حضور فصل ${session.className}`,
      subtitle: session.sessionTitle,
    });
  };

  const handlePasteZoom = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = text.trim();
        setZoomUrl(cleaned);
        try {
          localStorage.setItem(`smart_zoom_${currentTeacher.id}`, cleaned);
        } catch {
          // ignore
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = classes.find((c) => c.id === selectedClassId) || classes[0];
    if (!targetClass) return;

    const safeZoom = zoomUrl.trim() ? ensureAbsoluteUrl(zoomUrl.trim()) : '';
    const finalTitle = sessionTitle.trim() || `حصة ${currentTeacher.subject} - فصل ${targetClass.name}`;

    // Smart Save or Clear Zoom URL for this teacher
    try {
      if (zoomUrl.trim()) {
        localStorage.setItem(`smart_zoom_${currentTeacher.id}`, zoomUrl.trim());
      } else {
        localStorage.removeItem(`smart_zoom_${currentTeacher.id}`);
      }
    } catch {
      // ignore
    }

    const deterministicSessionId = `ses_${Date.now()}`;
    const createdSessionResult = onCreateSession(
      targetClass.id,
      targetClass.name,
      finalTitle,
      safeZoom,
      targetTrack,
      deterministicSessionId
    );

    const createdSession: ClassSession = createdSessionResult || {
      id: deterministicSessionId,
      teacherId: currentTeacher.id,
      classId: targetClass.id,
      className: targetClass.name,
      sessionTitle: finalTitle,
      zoomUrl: safeZoom,
      targetTrack,
      createdAt: new Date().toISOString(),
      scheduledTime: 'مباشر الآن',
      isActive: true,
      attendance: [],
    };
    setJustCreatedSession(createdSession);
    setIsAddFormOpen(false);
  };

  const handleToggleAddForm = () => {
    setIsAddFormOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 150);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------
  // SMART FEATURE: نسخ جميع الطلاب الغائبين في حصصي دفعة واحدة
  // -----------------------------------------------------------------
  const handleCopyAllAbsentees = async () => {
    if (mySessions.length === 0) return;

    const report = generateCombinedTeacherAbsenteeReport(
      currentTeacher.name,
      currentTeacher.subject,
      mySessions,
      students
    );

    try {
      await navigator.clipboard.writeText(report);
      setCopiedAllAbsentees(true);
      setTimeout(() => setCopiedAllAbsentees(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareAllAbsenteesWhatsApp = () => {
    if (mySessions.length === 0) return;

    const report = generateCombinedTeacherAbsenteeReport(
      currentTeacher.name,
      currentTeacher.subject,
      mySessions,
      students
    );

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(report)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3.5 dir-rtl font-sans">
      {/* ------------------------------------------------------------- */}
      {/* Security & Password Admin Banner (Only for Mr. Ahmed Badawi) */}
      {/* ------------------------------------------------------------- */}
      {isAhmedBadawi(currentTeacher) && onOpenPasswordModal && (
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50/50 to-indigo-50 border border-indigo-200/90 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                <span>أمان لوحة التحكم (مستر أحمد بدوي)</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md hidden xs:inline-block">
                  المشرف العام
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                كلمة المرور الحالية تحمي لوحة التحكم وتمنع دخول الطلاب. يمكنك تغييرها في أي وقت.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPasswordModal}
            className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-indigo-600/20"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>تعديل كلمة السر</span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* 2. SMART CONSOLIDATED ABSENTEE REPORT ACTION (نسخ غياب جميع حصصي) */}

      <div
        id="quick-add-session-card"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
      >
        {/* Sleek 1-Row Collapsed Header Bar */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggleAddForm}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleToggleAddForm();
          }}
          className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              {isAddFormOpen ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
            </div>
            <div className="truncate">
              <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                <span>إضافة حصة جديدة واختيار الفصل</span>
                {!isAddFormOpen && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded-md hidden xs:inline-block">
                    سريع وذكي
                  </span>
                )}
              </div>
              {!isAddFormOpen && (
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  اختر الفصل ومسار الطلاب (لغات / عربي) وضع رابط زوم
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAddForm();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                isAddFormOpen
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
            >
              {isAddFormOpen ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>إغلاق</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>حصة جديدة</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Form Drawer */}
        {isAddFormOpen && (
          <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-2 duration-150">
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {/* 1. Class Selection: ONLY CLASS NAME, NO STUDENT COUNT */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  ١. اختر الفصل الدراسي:
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                  {classes.map((cls) => {
                    const isSelected = cls.id === selectedClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border select-none ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-102'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>فصل {cls.name}</span>
                      </button>
                    );
                  })}
                  {onSwitchToClassesTab && (
                    <button
                      type="button"
                      onClick={onSwitchToClassesTab}
                      className="shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:text-indigo-600 bg-white border border-dashed border-slate-300"
                    >
                      + فصل جديد
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Target Track Selection (الاختيار بين طلاب العربي أو اللغات أو كلاهما) */}
              <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="text-xs font-black text-slate-800">
                    ٢. تحديد فئة الطلاب المستهدفة للحصة:
                  </label>
                  {isMixedTrackClass ? (
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                      فصل مشترك ({englishTrackCount} لغات · {arabicTrackCount} عربي)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                      {activeClassStudents.length > 0
                        ? `إجمالي طلاب الفصل: ${activeClassStudents.length}`
                        : 'اختر الفئة المستهدفة'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTargetTrack('all')}
                    className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      targetTrack === 'all'
                        ? 'bg-white text-indigo-950 shadow-2xs font-extrabold ring-1 ring-indigo-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>كلاهما (الجميع)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetTrack('english')}
                    className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      targetTrack === 'english'
                        ? 'bg-blue-600 text-white shadow-2xs font-extrabold ring-1 ring-blue-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>طلاب اللغات ({englishTrackCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetTrack('arabic')}
                    className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      targetTrack === 'arabic'
                        ? 'bg-amber-600 text-white shadow-2xs font-extrabold ring-1 ring-amber-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>طلاب العربي ({arabicTrackCount})</span>
                  </button>
                </div>
              </div>

              {/* 3. Title & Clean Zoom Input (NO DEFAULT URL) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    عنوان وموضوع الحصة:
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    required
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="مثال: مراجعة العلوم - الحصة الأولى"
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      رابط زوم (اختياري - ضع الرابط أو اتركه فارغاً):
                    </label>
                    <div className="flex items-center gap-2">
                      {zoomUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setZoomUrl('');
                            try {
                              localStorage.removeItem(`smart_zoom_${currentTeacher.id}`);
                            } catch {}
                          }}
                          className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>مسح</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handlePasteZoom}
                        className="text-[10px] text-indigo-600 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>لصق من الحافظة</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={zoomUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setZoomUrl(val);
                      try {
                        if (val.trim()) {
                          localStorage.setItem(`smart_zoom_${currentTeacher.id}`, val.trim());
                        } else {
                          localStorage.removeItem(`smart_zoom_${currentTeacher.id}`);
                        }
                      } catch {}
                    }}
                    placeholder="ضع رابط زوم هنا... https://zoom.us/j/..."
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-left"
                  />
                </div>
              </div>

              {/* Submit / Cancel Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>بدء الحصة وتوليد الرابط فوراً 🚀</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Immediate Share Feedback Banner */}
        {justCreatedSession && (
          <div className="p-3 bg-emerald-50 border-t border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>تمت إضافة الحصة! شارك الرابط الآن:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(justCreatedSession)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-black text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyLink(justCreatedSession)}
                className="px-2.5 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                <span>نسخ</span>
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SMART CONSOLIDATED ABSENTEE REPORT ACTION (نسخ غياب جميع حصصي) */}
      {/* ------------------------------------------------------------- */}
      {mySessions.length > 0 && (
        <div className="p-2.5 sm:p-3 bg-linear-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-right">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <span>تقرير الغياب المجمع لجميع حصصي</span>
                <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.2 rounded-md">
                  كشف موحد
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                تجميع أسماء جميع الطلاب الغائبين في كافة حصصك بنقرة واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyAllAbsentees}
              className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                copiedAllAbsentees
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-900 shadow-2xs'
              }`}
            >
              {copiedAllAbsentees ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>تم نسخ كشف الغياب! ✅</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>نسخ جميع الغائبين دفعة واحدة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareAllAbsenteesWhatsApp}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              title="إرسال التقرير المجمع للواتساب"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">واتساب</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5-Min Smart WhatsApp Reminder Alert Banner */}
      {/* ------------------------------------------------------------- */}
      {upcomingAlert && (
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-2 border border-emerald-500">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <span className="text-xl animate-bounce">🔔</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-white">
                  تذكير موعد الحصة: {upcomingAlert.session.className}
                </span>
                <span className="text-[10px] bg-emerald-950/70 text-emerald-200 font-extrabold px-2 py-0.5 rounded-md border border-emerald-400/40">
                  {upcomingAlert.diffMinutes === 0 ? 'تبدأ الآن!' : `تبدأ خلال ${upcomingAlert.diffMinutes} دقائق`}
                </span>
              </div>
              <p className="text-xs text-emerald-100 truncate mt-0.5">
                {upcomingAlert.session.sessionTitle} · الموعد: {upcomingAlert.session.scheduledTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleShareWhatsApp(upcomingAlert.session)}
              className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>إرسال التذكير لواتساب فوراً (1-Click)</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. LIVE SESSIONS LIST (حصص المعلم الحالي فقط - بدون "الكل")   */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              حصص المعلم: {currentTeacher.name} ({displayedSessions.length})
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Select All Toggle Button */}
            {displayedSessions.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{isAllSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
              </button>
            )}

            {/* Batch Delete Selected Button */}
            {selectedForBatchDelete.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(true)}
                className="px-3 py-1 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition-all shadow-xs cursor-pointer animate-in fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المحدد ({selectedForBatchDelete.length})</span>
              </button>
            )}

            {/* Instant Manual Reset Button */}
            <button
              type="button"
              onClick={() => setShowResetAttendanceModal(true)}
              className="px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="تصفير سجلات الغياب فوراً"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">تصفير الغياب الآن</span>
              <span className="sm:hidden">تصفير الغياب</span>
            </button>

            {/* Prominent Button: توليد حصص اليوم الآن */}
            {onGenerateTodaySessions && (
              <button
                type="button"
                onClick={() => {
                  onGenerateTodaySessions();
                  setGenNotice('تم توليد حصص اليوم تلقائياً بناءً على مواعيد الجدول المحددة! 🚀');
                  setTimeout(() => setGenNotice(null), 5000);
                }}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex items-center gap-1 sm:gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer animate-pulse shrink-0"
                title="توليد وتنشيط حصص اليوم تلقائياً بناءً على مواعيد الجدول الأسبوعي للمدرس"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="hidden sm:inline">توليد حصص اليوم الآن</span>
                <span className="sm:hidden">حصص اليوم</span>
              </button>
            )}

            {/* Quick Demo Test Class Button */}
            {onCreateDemoClass && (
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="إنشاء فصل تجريبي باختيار الوقت لرؤية وتجربة الإرسال التلقائي للواتساب"
              >
                <span className="shrink-0">🧪</span>
                <span className="hidden sm:inline">فصل تجريبي</span>
                <span className="sm:hidden">تجريبي</span>
              </button>
            )}

            {onOpenScheduleModal && (
              <button
                type="button"
                onClick={onOpenScheduleModal}
                className="px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="قراءة وإدارة الجدول الأسبوعي بالذكاء الاصطناعي"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="hidden sm:inline">الجدول الذكي</span>
                <span className="sm:hidden">الجدول</span>
              </button>
            )}

            {onOpenWhatsAppHub && (
              <button
                type="button"
                onClick={onOpenWhatsAppHub}
                className="px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="إعدادات وتفاصيل ربط حساب الواتساب"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">إعدادات الواتساب</span>
                <span className="sm:hidden">الواتساب</span>
              </button>
            )}

            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono shrink-0 hidden xs:flex">
              <Clock className="w-3 h-3 text-indigo-600" />
              تصفير 12:00 ص 🇸🇦
            </span>
          </div>
        </div>

        {/* Compact Sessions Cards Grid */}
        {displayedSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {displayedSessions.map((session) => {
              const isSelectedForBatch = selectedForBatchDelete.includes(session.id);

              // Targeted students according to session track
              const sessionStudents = students.filter((s) => {
                if (s.classId !== session.classId) return false;
                if (session.targetTrack === 'all') return true;
                return s.track === session.targetTrack;
              });

              const presentCount = session.attendance.length;
              const totalCount = sessionStudents.length;
              const absentCount = Math.max(0, totalCount - presentCount);
              const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
              const isCopied = copiedSessionId === session.id;

              const trackBadge =
                session.targetTrack === 'english' ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    لغات
                  </span>
                ) : session.targetTrack === 'arabic' ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    عربي
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                    الكل
                  </span>
                );

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl border transition-all p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 group ${
                    isSelectedForBatch
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row: Class Tag + Track Tag + Title + Select/Edit/Delete */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectSession(session.id);
                          }}
                          className="p-0.5 cursor-pointer shrink-0"
                          title={isSelectedForBatch ? 'إلغاء التحديد' : 'تحديد الحصة'}
                        >
                          {isSelectedForBatch ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                        <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600 text-white shrink-0">
                          فصل {session.className}
                        </span>
                        {trackBadge}
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {session.sessionTitle}
                        </h4>
                      </div>

                      {/* Quiet Edit/Delete Icons */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToEdit(session);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                          title="تعديل الحصة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="حذف الحصة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Compact Attendance Summary Bar */}
                    <div className="flex items-center justify-between text-[11px] py-1 px-2.5 bg-slate-50 rounded-xl border border-slate-100 font-mono mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-bold">🟢 {presentCount} حاضر</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-rose-700 font-bold">🔴 {absentCount} غائب</span>
                      </div>
                      <span className="text-slate-500 font-bold">
                        {attendanceRate}% ({totalCount} طالب)
                      </span>
                    </div>

                    {/* Compact Zoom Info */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                      <span className="flex items-center gap-1 truncate font-mono dir-ltr text-left max-w-[200px]">
                        <Video className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate">{session.zoomUrl}</span>
                      </span>
                      <a
                        href={ensureAbsoluteUrl(session.zoomUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
                      >
                        <span>فتح زوم</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Schedule Time & WhatsApp 5-Min Reminder Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] pt-1.5 px-0.5">
                      {session.scheduledTime ? (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-600" />
                          <span>الموعد: {session.scheduledTime}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">حصة فورية</span>
                      )}

                      {session.whatsappReminderSent ? (
                        <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          <span>أُرسل تذكير الواتساب (قبل 5 د)</span>
                        </span>
                      ) : session.scheduledTime ? (
                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>تذكير واتساب مجدول قبل 5 د</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Bottom Row: 2 Big Primary Actions (Enter + Share/Copy) */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    {/* Primary Enter Details Button */}
                    <button
                      type="button"
                      onClick={() => onEnterSession(session.id)}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>دخول التحضير</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* WhatsApp Direct Share Button */}
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(session)}
                      className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                      title="إرسال الرابط للواتساب فوراً"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden xs:inline">واتساب</span>
                    </button>

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(session)}
                      className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title={isCopied ? 'تم النسخ!' : 'نسخ رابط الطالب'}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {/* QR Code */}
                    <button
                      type="button"
                      onClick={() => handleOpenQr(session)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
                      title="رمز QR"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>

                    {/* Student Gateway Preview */}
                    {onOpenStudentGateway && (
                      <button
                        type="button"
                        onClick={() => onOpenStudentGateway(session.id)}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl cursor-pointer"
                        title="معاينة تجربة الطالب"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-2xs">
            <p className="text-xs sm:text-sm font-bold text-slate-700 mb-1">
              لا توجد حصص مضافة باسم {currentTeacher.name} حتى الآن
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              اضغط على شريط "إضافة حصة جديدة" بالأعلى لاختيار الفصل وتحديد الطلاب المستهدفين.
            </p>
            <button
              type="button"
              onClick={handleToggleAddForm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة حصة الآن</span>
            </button>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrModalData && (
        <QRCodeModal
          isOpen={!!qrModalData}
          onClose={() => setQrModalData(null)}
          url={qrModalData.url}
          title={qrModalData.title}
          subtitle={qrModalData.subtitle}
          onDomainChanged={() => setPublishedDomainState(getPublishedDomain())}
        />
      )}

      {/* Edit Session Modal */}
      {sessionToEdit && (
        <EditSessionModal
          isOpen={!!sessionToEdit}
          onClose={() => setSessionToEdit(null)}
          session={sessionToEdit}
          classes={classes}
          onSave={(updated) => {
            onUpdateSession(updated);
            setSessionToEdit(null);
          }}
        />
      )}

      {/* Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <ConfirmModal
          isOpen={!!sessionToDelete}
          title="حذف الحصة الدراسية"
          message={`هل أنت متأكد من رغبتك في حذف حصة "${sessionToDelete.sessionTitle}"؟ سيتم حذف بيانات الحضور المرتبطة بها نهائياً.`}
          confirmText="نعم، احذف الحصة"
          cancelText="تراجع"
          onConfirm={() => {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }}
          onCancel={() => setSessionToDelete(null)}
        />
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <ConfirmModal
          isOpen={showBatchDeleteModal}
          title="حذف الحصص المحددة دفعة واحدة"
          message={`هل أنت متأكد من رغبتك في حذف (${selectedForBatchDelete.length}) حصة من حصصك المحددة؟ سيتم مسحها نهائياً مع بيانات الحضور المرتبطة بها.`}
          confirmText={`نعم، احذف (${selectedForBatchDelete.length}) حصة`}
          cancelText="تراجع"
          isDestructive={true}
          onConfirm={handleConfirmBatchDelete}
          onCancel={() => setShowBatchDeleteModal(false)}
        />
      )}

      {/* Instant Attendance Reset Confirmation Modal */}
      {showResetAttendanceModal && (
        <ConfirmModal
          isOpen={showResetAttendanceModal}
          title="تصفير كشف الحضور والغياب فوراً"
          message={`هل أنت متأكد من رغبتك في تصفير سجلات الغياب فوراً لجميع حصص المعلم (${currentTeacher.name})؟ سيتم تفريغ كشف الحاضرين والبدء بكشف غياب جديد (تتم هذه العملية تلقائياً يومياً الساعة 12:00 ص بتوقيت السعودية).`}
          confirmText="نعم، تصفير كشف الغياب"
          cancelText="تراجع"
          isDestructive={false}
          onConfirm={handleConfirmResetAttendance}
          onCancel={() => setShowResetAttendanceModal(false)}
        />
      )}

      {/* Generation Toast Notice */}
      {genNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 dir-rtl font-bold text-xs">
          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
          <span>{genNotice}</span>
        </div>
      )}

      {/* Interactive Demo Test Class Setup Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm sm:text-base">
                <span className="text-xl">🧪</span>
                <span>إنشاء فصل تجريبي وموعد الحصة</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم إنشاء فصل تجريبي وتعيين موعد للحصة لاختبار التذكيرات التلقائية عبر الواتساب وكأنها حصة فعلية.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  موعد الحصة المجدولة (HH:MM بتوقيت السعودية):
                </label>
                <input
                  type="time"
                  value={demoCustomTime}
                  onChange={(e) => setDemoCustomTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono dir-ltr text-center font-bold bg-slate-50 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  💡 اضبط الوقت بعد 5 دقائق من الوقت الحالي للتجربة التلقائية الفورية.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  رابط الجروب أو رقم الواتساب المربوط:
                </label>
                <input
                  type="text"
                  value={demoGroupLink}
                  onChange={(e) => setDemoGroupLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/... أو 966501234567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono dir-ltr text-left"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCreateDemoClass) {
                    onCreateDemoClass(demoCustomTime, demoGroupLink);
                  }
                  setShowDemoModal(false);
                  setGenNotice(`تم إنشاء الفصل التجريبي وتعيين الموعد (${demoCustomTime}) بنجاح! 🧪`);
                  setTimeout(() => setGenNotice(null), 5000);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>إنشاء وتوليد الحصة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
