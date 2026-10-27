import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  CheckCircle2,
  Search,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { AttendanceRecord, ClassSession, Student, TeacherProfile } from '../types';
import { findBestMatch, normalizeText, matchesStudentSearch } from '../utils/arabicFuzzy';
import { getTrackLabel } from '../utils/whatsappFormatter';
import { ensureAbsoluteUrl } from '../utils/urlHelper';
import {
  recordAttendanceViaServer,
  fetchServerData,
  fetchSingleSessionFromServer,
  listenForServerEvents,
  listenForSyncEvents,
} from '../utils/apiSync';
import { DEFAULT_STUDENTS, enforceOfficialStudentTracks } from '../utils/storage';
import { TeacherAuthModal } from './TeacherAuthModal';

interface StudentGatewayProps {
  session: ClassSession;
  allStudents: Student[];
  teacher: TeacherProfile;
  onRecordAttendance: (
    sessionId: string,
    studentName: string,
    matchedStudent?: Student,
    confidenceScore?: number,
    serverRecord?: AttendanceRecord
  ) => void;
  onBackToDashboard?: () => void;
}

export const StudentGateway: React.FC<StudentGatewayProps> = ({
  session,
  allStudents,
  teacher,
  onRecordAttendance,
  onBackToDashboard,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyRegisteredMessage, setAlreadyRegisteredMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(2);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const redirectTriggeredRef = useRef(false);

  const [liveSession, setLiveSession] = useState<ClassSession>(session);
  const [activeStudents, setActiveStudents] = useState<Student[]>(
    allStudents && allStudents.length > 0 ? allStudents : DEFAULT_STUDENTS
  );

  useEffect(() => {
    setLiveSession((prev) => ({
      ...prev,
      ...session,
      id: session.id,
      zoomUrl: session.zoomUrl || prev.zoomUrl,
    }));
  }, [session]);

  const cleanZoomUrl = ensureAbsoluteUrl(
    liveSession.zoomUrl || session.zoomUrl || 'https://zoom.us/join'
  );

  // Sync ONLY the exact session (s.id === session.id) and official student list from server
  useEffect(() => {
    let isMounted = true;
    if (allStudents && allStudents.length > 0) {
      setActiveStudents(allStudents);
    }

    fetchSingleSessionFromServer(session.id)
      .then((remoteSes) => {
        if (isMounted && remoteSes && remoteSes.id === session.id) {
          setLiveSession((prev) => ({
            ...prev,
            ...remoteSes,
            id: session.id,
            zoomUrl: remoteSes.zoomUrl || prev.zoomUrl,
          }));
        }
      })
      .catch(() => {});

    fetchServerData()
      .then((data) => {
        if (!isMounted || !data) return;
        if (Array.isArray(data.students) && data.students.length > 0) {
          setActiveStudents(enforceOfficialStudentTracks(data.students));
        }
        if (Array.isArray(data.sessions)) {
          const exactSes = data.sessions.find((s) => s.id === session.id);
          if (exactSes) {
            setLiveSession((prev) => ({
              ...prev,
              ...exactSes,
              id: session.id,
              zoomUrl: exactSes.zoomUrl || prev.zoomUrl,
            }));
          }
        }
      })
      .catch(() => {});

    const unsubSSE = listenForServerEvents((msg) => {
      if (!isMounted || !msg || !msg.type) return;
      if (
        (msg.type === 'SESSION_UPSERTED' || msg.type === 'SESSION_CREATED_OR_UPDATED') &&
        msg.session &&
        msg.session.id === session.id
      ) {
        setLiveSession((prev) => ({
          ...prev,
          ...msg.session,
          id: session.id,
          zoomUrl: msg.session.zoomUrl || prev.zoomUrl,
        }));
      } else if (msg.type === 'ATTENDANCE_RECORDED' && msg.sessionId === session.id && msg.session) {
        setLiveSession((prev) => ({
          ...prev,
          ...msg.session,
          id: session.id,
          zoomUrl: msg.session.zoomUrl || prev.zoomUrl,
        }));
      } else if (msg.type === 'STATE_SYNCED') {
        if (Array.isArray(msg.students) && msg.students.length > 0) {
          setActiveStudents(enforceOfficialStudentTracks(msg.students));
        }
        if (Array.isArray(msg.sessions)) {
          const exactSes = msg.sessions.find((s: ClassSession) => s.id === session.id);
          if (exactSes) {
            setLiveSession((prev) => ({
              ...prev,
              ...exactSes,
              id: session.id,
              zoomUrl: exactSes.zoomUrl || prev.zoomUrl,
            }));
          }
        }
      }
    });

    const unsubLocal = listenForSyncEvents((msg) => {
      if (!isMounted || !msg || !msg.type) return;
      if (msg.type === 'SESSION_UPDATED' && msg.session && msg.session.id === session.id) {
        setLiveSession((prev) => ({
          ...prev,
          ...msg.session,
          id: session.id,
          zoomUrl: msg.session.zoomUrl || prev.zoomUrl,
        }));
      }
    });

    return () => {
      isMounted = false;
      unsubSSE();
      unsubLocal();
    };
  }, [session.id, allStudents]);

  // Strictly filter students belonging to this session's class and track
  let sessionStudents = activeStudents.filter((s) => {
    if (s.classId !== liveSession.classId && s.classId !== session.classId) return false;
    if (liveSession.targetTrack === 'all') return true;
    return s.track === liveSession.targetTrack;
  });

  if (sessionStudents.length === 0 && (liveSession.classId || liveSession.className)) {
    const cleanClassCode = (liveSession.className || '')
      .toLowerCase()
      .replace(/[\s\-_]+/g, '');
    sessionStudents = activeStudents.filter((s) => {
      const stCode = (s.classId || '').toLowerCase().replace(/[\s\-_]+/g, '');
      return stCode && cleanClassCode && stCode.includes(cleanClassCode);
    });
  }

  if (sessionStudents.length === 0) {
    sessionStudents = activeStudents;
  }

  const sortedClassStudents = [...sessionStudents].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' })
  );

  const filteredRoster = sortedClassStudents.filter((st) =>
    matchesStudentSearch(nameInput, st.name, st.studentCode)
  );

  // Auto-match if student typed their exact or near-exact full name from the class roster
  const resolvedStudent: Student | null = React.useMemo(() => {
    if (selectedStudent) return selectedStudent;
    const trimmed = nameInput.trim();
    if (trimmed.length < 5) return null;
    const exact = sortedClassStudents.find(
      (st) => normalizeText(st.name) === normalizeText(trimmed)
    );
    if (exact) return exact;
    const best = findBestMatch(
      trimmed,
      sortedClassStudents.map((st) => ({ id: st.id, name: st.name })),
      0.85
    );
    if (best) {
      return sortedClassStudents.find((st) => st.id === best.id) || null;
    }
    return null;
  }, [selectedStudent, nameInput, sortedClassStudents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerZoomRedirect = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const a = document.createElement('a');
      a.href = cleanZoomUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.assign(cleanZoomUrl);
    }
  }, [cleanZoomUrl]);

  useEffect(() => {
    if (!isSubmitted) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!redirectTriggeredRef.current) {
            redirectTriggeredRef.current = true;
            triggerZoomRedirect();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, triggerZoomRedirect]);

  const attendedStudentIds = new Set(
    (liveSession.attendance || []).map((r) => r.studentId).filter(Boolean)
  );

  const handleSubmitName = async (studentToSubmit?: Student) => {
    const targetStudent = studentToSubmit || resolvedStudent;
    if (!targetStudent || isSubmitting) return;

    setIsSubmitting(true);
    setSelectedStudent(targetStudent);
    setNameInput(targetStudent.name);
    const entered = targetStudent.name.trim();
    const nowIso = new Date().toISOString();

    const localRecord: AttendanceRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: liveSession.id,
      studentId: targetStudent.id,
      studentName: entered,
      matchedRosterName: targetStudent.name,
      track: targetStudent.track,
      timestamp: nowIso,
      lastJoinedAt: nowIso,
      joinCount: 1,
      status: 'present',
      confidenceScore: 1.0,
    };

    onRecordAttendance(liveSession.id, entered, targetStudent, 1.0, localRecord);
    setIsSubmitted(true);
    setIsSubmitting(false);
    setToast({ type: 'success', text: '✅ تم تسجيل حضورك والانتقال لزوم فوراً بنجاح!' });

    const serverPromise = recordAttendanceViaServer(
      liveSession.id,
      entered,
      targetStudent,
      1.0,
      {
        id: liveSession.id,
        classId: liveSession.classId,
        className: liveSession.className,
        sessionTitle: liveSession.sessionTitle,
        zoomUrl: cleanZoomUrl,
        targetTrack: liveSession.targetTrack,
        teacherId: 'teacher_ahmed_badawi',
      }
    )
      .then((result) => {
        if (result && result.success && result.alreadyRecorded) {
          setAlreadyRegisteredMessage(
            `أهلاً بعودتك يا ${targetStudent.name}! تم توثيق دخولك مجدداً (${result.record?.joinCount || 2}×).`
          );
        }
      })
      .catch(() => {});

    await Promise.race([serverPromise, new Promise((resolve) => setTimeout(resolve, 1200))]);

    if (!redirectTriggeredRef.current) {
      redirectTriggeredRef.current = true;
      triggerZoomRedirect();
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanZoomUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        return;
      }
    } catch {
      // fallback
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = cleanZoomUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/70 via-slate-50 to-white flex flex-col justify-between p-3 sm:p-6 dir-rtl font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-md w-full mx-auto flex items-center justify-between text-xs text-slate-500 py-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <GraduationCap className="w-4 h-4 text-indigo-600" />
          <span>{teacher.schoolName || 'مدرسة اللغات الحديثة'}</span>
        </div>
        {onBackToDashboard && (
          <>
            <button
              type="button"
              onClick={() => setShowTeacherAuthModal(true)}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="دخول المعلم المشرف (محمي برمز مرور)"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>المشرف</span>
            </button>

            <TeacherAuthModal
              isOpen={showTeacherAuthModal}
              onClose={() => setShowTeacherAuthModal(false)}
              onSuccess={() => {
                setShowTeacherAuthModal(false);
                onBackToDashboard();
              }}
              title="التحقق من هوية المعلم المشرف"
              description="هذه المنطقة مخصصة لمستر أحمد بدوي فقط. يرجى إدخال رمز المرور السري للدخول إلى لوحة التحكم."
            />
          </>
        )}
      </div>

      {toast && (
        <div className="max-w-md w-full mx-auto mb-3">
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                : 'bg-rose-50 text-rose-950 border border-rose-200'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 text-sm font-bold px-1.5 cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md w-full mx-auto my-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-5 sm:p-7 transition-all">
        {!isSubmitted ? (
          <div className="space-y-4 text-center">
            <div>
              <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/25">
                <Video className="w-7 h-7" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-1.5 border border-indigo-100">
                <span>فصل {liveSession.className}</span>
                {liveSession.targetTrack !== 'all' && (
                  <>
                    <span>·</span>
                    <span>{getTrackLabel(liveSession.targetTrack)}</span>
                  </>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                {liveSession.sessionTitle}
              </h1>

              <p className="text-xs text-slate-500 mt-1">
                حصة <span className="font-bold text-slate-700">الرياضيات (Math)</span> مع المعلم{' '}
                <span className="font-bold text-slate-700">مستر احمد بدوي</span>
              </p>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 text-right space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                ابحث واختر اسمك من كشف فصل {liveSession.className}:
              </label>

              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setSelectedStudent(null);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="ابدأ بكتابة اسمك للبحث في القائمة..."
                    className="w-full pr-10 pl-4 py-3 text-base sm:text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all text-slate-900 placeholder:text-slate-400 touch-manipulation"
                  />
                </div>

                {resolvedStudent && (
                  <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <div>
                        <div className="font-extrabold text-emerald-950">{resolvedStudent.name}</div>
                        <div className="text-[10px] text-emerald-700">
                          تم مطابقة اسمك بنجاح من الكشف الرسمي
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold ${
                        resolvedStudent.track === 'english'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {resolvedStudent.track === 'english' ? 'مسار لغات' : 'مسار عربي'}
                    </span>
                  </div>
                )}

                {isDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-h-60 overflow-y-auto divide-y divide-slate-100 text-right animate-in fade-in zoom-in-95">
                    <div className="p-2.5 bg-slate-50/90 text-[11px] font-bold text-slate-500 flex items-center justify-between sticky top-0 backdrop-blur-xs border-b border-slate-100">
                      <span>كشف طلاب فصل {liveSession.className} (مرتب أبجديًا):</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">
                        {filteredRoster.length} طالب
                      </span>
                    </div>

                    {filteredRoster.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        لم يتم العثور على اسم يطابق "{nameInput}". تأكد من كتابة الاسم كما هو في الكشف.
                      </div>
                    ) : (
                      filteredRoster.map((student) => {
                        const isSelected = resolvedStudent?.id === student.id;
                        const isAttended = attendedStudentIds.has(student.id);

                        return (
                          <div
                            key={student.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedStudent(student);
                              setNameInput(student.name);
                              setIsDropdownOpen(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setSelectedStudent(student);
                                setNameInput(student.name);
                                setIsDropdownOpen(false);
                              }
                            }}
                            className={`p-3 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-950 font-bold'
                                : 'hover:bg-indigo-50/80 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                              )}
                              <span className="font-bold">{student.name}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isAttended && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                                  مسجل مسبقاً
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                  student.track === 'english'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {student.track === 'english' ? 'لغات' : 'عربي'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {!resolvedStudent && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50/60 p-2 rounded-xl border border-indigo-100 text-right font-semibold">
                  ⚠️ يرجى اختيار اسمك من قائمة الفصل أعلاه أو كتابته بدقة لتسجيل حضورك.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSubmitName()}
              disabled={!resolvedStudent || isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-[0.98]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'جاري تسجيل حضورك...' : 'تسجيل الحضور والدخول لزوم'}</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-4 space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner shadow-emerald-600/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold mb-2 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تم تسجيل الحضور بنجاح</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                أهلاً بك، {nameInput}! 🚀
              </h2>
              {alreadyRegisteredMessage && (
                <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 font-medium">
                  {alreadyRegisteredMessage}
                </p>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-xs text-slate-600 font-medium mb-1">
                جاري فتح غرفة زوم في نافذة جديدة خلال
              </p>
              <div className="text-3xl font-black font-mono text-indigo-600 my-1 tabular-nums">
                {countdown} {countdown === 1 ? 'ثانية' : 'ثوانٍ'}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                إذا لم تفتح نافذة زوم تلقائياً، اضغط على الزر الأخضر بالأسفل
              </p>
            </div>

            <div className="space-y-2.5">
              <a
                href={cleanZoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  redirectTriggeredRef.current = true;
                }}
                className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-extrabold text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 group cursor-pointer touch-manipulation active:scale-[0.98]"
              >
                <span>الانتقال إلى زوم الآن (فتح مباشر)</span>
                <ExternalLink className="w-5 h-5 group-hover:translate-x-[-2px] transition-transform" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">تم نسخ رابط زوم المباشر للحافظة!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>نسخ رابط غرفة زوم مباشرة</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>تم توثيق وقت الحضور بدقة في سجل مستر احمد بدوي</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-slate-400 py-3 font-medium">
        بوابة تحضير زوم الذكية · مستر احمد بدوي (الرياضيات Math)
      </div>
    </div>
  );
};
