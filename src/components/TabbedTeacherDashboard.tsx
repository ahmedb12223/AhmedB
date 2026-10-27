import React, { useState } from 'react';
import {
  Video,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  MessageCircle,
  UserCheck,
  UserX,
  PlusCircle,
  Clock,
  Sparkles,
  Users,
  Play,
  Share2,
  Layers,
  FileText,
  AlertCircle,
  Trash2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Plus,
  CopyCheck
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { generateWhatsAppAbsenteeReport } from '../utils/whatsappFormatter';
import { parseHierarchicalText } from '../utils/excelParser';
import { getSubjectColorTheme } from './SimpleNavbar';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface TabbedTeacherDashboardProps {
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  activeSession: ClassSession | null;
  activeNavTab: 'live' | 'new-session' | 'roster' | 'history';
  onSelectNavTab: (tab: 'live' | 'new-session' | 'roster' | 'history') => void;
  onSelectSession: (session: ClassSession) => void;
  onCreateSession: (classId: string, className: string, title: string, zoomUrl: string) => void;
  onUpdateSessionAttendance: (updated: ClassSession) => void;
  onOpenStudentGateway: (sessionId: string) => void;
  onSaveRoster: (newClasses: SchoolClass[], newStudents: Student[]) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const TabbedTeacherDashboard: React.FC<TabbedTeacherDashboardProps> = ({
  currentTeacher,
  classes,
  students,
  sessions,
  activeSession,
  activeNavTab,
  onSelectNavTab,
  onSelectSession,
  onCreateSession,
  onUpdateSessionAttendance,
  onOpenStudentGateway,
  onSaveRoster,
  onDeleteSession,
}) => {
  // Setup Class State for Tab 2
  const [newSessionClassId, setNewSessionClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [newSessionTitle, setNewSessionTitle] = useState(
    `حصة ${currentTeacher.subject}`
  );
  const [newSessionZoomUrl, setNewSessionZoomUrl] = useState(
    currentTeacher.defaultZoomLink || 'https://zoom.us/j/1112223333?pwd=mathRoom2026'
  );

  // Sub-tab inside Live: Present vs Absent
  const [liveSubTab, setLiveSubTab] = useState<'absent' | 'present'>('absent');

  // Modals & Feedback
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Duplicate Modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetClassId, setDuplicateTargetClassId] = useState<string>(
    classes.find((c) => c.id !== activeSession?.classId)?.id || classes[0]?.id || ''
  );

  // Roster Text Editor state for Tab 3
  const generateInitialRosterText = () => {
    let text = '';
    classes.forEach((c, idx) => {
      text += `${c.name}\n`;
      const classStudents = students.filter((s) => s.classId === c.id);
      classStudents.forEach((st) => {
        text += `${st.name}\n`;
      });
      if (idx < classes.length - 1) text += '\n';
    });
    return text.trim();
  };

  const [rosterInputText, setRosterInputText] = useState(generateInitialRosterText);
  const [rosterSavedNotice, setRosterSavedNotice] = useState(false);
  const [rosterErrorNotice, setRosterErrorNotice] = useState<string | null>(null);

  // Active Session computations
  const targetedStudents = activeSession
    ? students.filter((s) => s.classId === activeSession.classId)
    : [];

  const checkedInStudentIds = new Set(
    activeSession ? activeSession.attendance.filter((r) => r.studentId).map((r) => r.studentId) : []
  );

  const absentStudents = targetedStudents.filter(
    (s) => !checkedInStudentIds.has(s.id)
  );

  const presentCount = activeSession ? activeSession.attendance.length : 0;
  const absentCount = absentStudents.length;
  const totalCount = targetedStudents.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const gatewayUrl = activeSession
    ? buildStudentAttendanceLink(activeSession, currentTeacher)
    : '';

  const teacherTheme = getSubjectColorTheme(currentTeacher.subject);

  // Handlers
  const handleCopyLink = async () => {
    if (!gatewayUrl) return;
    try {
      await navigator.clipboard.writeText(gatewayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!activeSession) return;
    try {
      const text = generateWhatsAppAbsenteeReport(
        activeSession,
        absentStudents,
        currentTeacher.name,
        currentTeacher.subject
      );
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualCheckIn = (student: Student) => {
    if (!activeSession) return;
    const newRecord = {
      id: `att_manual_${Date.now()}`,
      sessionId: activeSession.id,
      studentId: student.id,
      studentName: student.name,
      matchedRosterName: student.name,
      track: student.track,
      timestamp: new Date().toISOString(),
      status: 'present' as const,
      confidenceScore: 1.0,
    };
    onUpdateSessionAttendance({
      ...activeSession,
      attendance: [newRecord, ...activeSession.attendance],
    });
  };

  const handleStartNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = classes.find((c) => c.id === newSessionClassId) || classes[0];
    if (!targetClass) return;

    onCreateSession(
      targetClass.id,
      targetClass.name,
      newSessionTitle.trim() || `حصة ${currentTeacher.subject}`,
      newSessionZoomUrl.trim() || 'https://zoom.us'
    );
    // Switch to live monitor tab
    onSelectNavTab('live');
  };

  // Duplicate current active session for another class
  const handleConfirmDuplicate = () => {
    if (!activeSession) return;
    const targetClass = classes.find((c) => c.id === duplicateTargetClassId);
    if (!targetClass) return;

    onCreateSession(
      targetClass.id,
      targetClass.name,
      activeSession.sessionTitle,
      activeSession.zoomUrl
    );
    setShowDuplicateModal(false);
    onSelectNavTab('live');
  };

  // Batch create sessions for all classes
  const handleBatchCreateAllClasses = () => {
    const defaultZoom = currentTeacher.defaultZoomLink || 'https://zoom.us/j/1112223333?pwd=mathRoom2026';
    const title = `حصة ${currentTeacher.subject}`;

    classes.forEach((cls) => {
      onCreateSession(cls.id, cls.name, `${title} - ${cls.name}`, defaultZoom);
    });

    setBatchNotice(`تم إنشاء ${classes.length} حصص بنجاح لجميع فصولك!`);
    setTimeout(() => {
      setBatchNotice(null);
      onSelectNavTab('live');
    }, 1500);
  };

  const handleSaveRosterText = () => {
    if (!rosterInputText.trim()) return;
    const parsed = parseHierarchicalText(rosterInputText);
    if (parsed.rows.length === 0) {
      setRosterErrorNotice('لم يتم العثور على أي أسماء طلاب. تأكد من كتابة اسم الفصل ثم أسماء الطلاب.');
      return;
    }
    setRosterErrorNotice(null);

    const newClasses: SchoolClass[] = parsed.detectedClasses.map((className) => {
      const existing = classes.find((c) => c.name.toUpperCase() === className.toUpperCase());
      return (
        existing || {
          id: `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: className,
          gradeLevel: 'المرحلة الدراسية',
          createdAt: new Date().toISOString(),
        }
      );
    });

    const newStudents: Student[] = parsed.rows.map((row, i) => {
      const cls = newClasses.find((c) => c.name.toUpperCase() === row.className.toUpperCase());
      return {
        id: `st_${Date.now()}_${i}`,
        name: row.name,
        classId: cls ? cls.id : newClasses[0]?.id || 'class_default',
        track: row.track,
        studentCode: row.studentCode,
      };
    });

    onSaveRoster(newClasses, newStudents);
    setRosterSavedNotice(true);
    setTimeout(() => setRosterSavedNotice(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Teacher Profile Summary Card                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl ${teacherTheme.bg} text-white flex items-center justify-center font-bold text-sm shadow-xs`}
          >
            {currentTeacher.name.replace(/^(مستر|مسيو|أ\.|\s)+/, '').slice(0, 2) || currentTeacher.name.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{currentTeacher.name}</h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${teacherTheme.lightBg} ${teacherTheme.text} border ${teacherTheme.border}`}>
                {currentTeacher.subject}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentTeacher.schoolName} · {classes.length} فصول مسجلة · {students.length} طالب · {sessions.length} حصص منشأة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectNavTab('new-session')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة حصة جديدة</span>
          </button>

          {activeSession && (
            <button
              onClick={() => onOpenStudentGateway(activeSession.id)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/70 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>تجربة ما يراه الطالب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: LIVE ACTIVE SESSION & ATTENDANCE                       */}
      {/* ------------------------------------------------------------- */}
      {activeNavTab === 'live' && (
        <div className="space-y-4">
          {/* Multiple Sessions Bar (شريط التبديل بين الحصص المتعددة) */}
          {sessions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-2 px-1">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-indigo-600" />
                  <span>حصصك المتاحة اليوم ({sessions.length}):</span>
                  <span className="text-[11px] text-slate-400 font-normal">انقر على أي حصة للتحكم برابطها وحضورها</span>
                </span>

                <button
                  onClick={() => onSelectNavTab('new-session')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة حصة أخرى</span>
                </button>
              </div>

              {/* Scrollable list of session pills */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                {sessions.map((s) => {
                  const isCurrent = s.id === activeSession?.id;
                  const sTargeted = students.filter((st) => st.classId === s.classId).length;
                  const sPresent = s.attendance.length;

                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelectSession(s)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/30'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-emerald-300 animate-pulse' : 'bg-slate-300'}`} />
                      <span className="font-mono">فصل {s.className}</span>
                      <span className="truncate max-w-[140px] font-normal">{s.sessionTitle}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          isCurrent ? 'bg-indigo-700 text-white' : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {sPresent}/{sTargeted} حاضر
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeSession ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
              {/* Header of Active Session */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-700">حصة جارية الآن ومفتوحة للتحضير</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-bold font-mono text-slate-800">فصل {activeSession.className}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {activeSession.sessionTitle}
                  </h3>
                </div>

                {/* Duplicate / Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDuplicateModal(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    title="تكرار نفس الحصة لفصل آخر بنقرة واحدة"
                  >
                    <CopyCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تكرار لفصل آخر</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف حصة "${activeSession.sessionTitle}"؟`)) {
                        onDeleteSession(activeSession.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="حذف هذه الحصة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Student Share Box */}
              <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/50 rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-2.5 text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-indigo-600" />
                    <span>رابط التحضير المباشر لطلاب فصل {activeSession.className}:</span>
                  </span>
                  <span className="text-[11px] font-normal text-indigo-600 hidden sm:inline">
                    ينقل الطالب لزوم فورياً بعد تسجيل اسمه
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleCopyLink}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'تم نسخ الرابط! الصقه في الشات ✅' : 'نسخ رابط الحصة للطلاب'}</span>
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="py-3 px-4 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span>كود QR للشاشة</span>
                  </button>

                  <a
                    href={activeSession.zoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <span>دخول زوم</span>
                  </a>
                </div>
              </div>

              {/* Attendance Statistics Strip */}
              <div className="grid grid-cols-2 gap-4">
                {/* Present Card */}
                <div
                  onClick={() => setLiveSubTab('present')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    liveSubTab === 'present'
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-800 mb-1">
                    <span className="text-xs font-bold">الحاضرون الآن</span>
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-950 tabular-nums">
                    {presentCount}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1 font-medium">
                    سجلوا حضورهم بنجاح
                  </div>
                </div>

                {/* Absent Card */}
                <div
                  onClick={() => setLiveSubTab('absent')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    liveSubTab === 'absent'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-800 mb-1">
                    <span className="text-xs font-bold">الغائبون</span>
                    <UserX className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-rose-950 tabular-nums">
                    {absentCount}
                  </div>
                  <div className="text-xs text-rose-700 mt-1 font-medium">
                    لم يسجلوا في الكشف بعد
                  </div>
                </div>
              </div>

              {/* The Golden WhatsApp Button */}
              <button
                onClick={handleCopyWhatsApp}
                className={`w-full py-4 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer ${
                  copiedWhatsApp
                    ? 'bg-emerald-700 text-white ring-4 ring-emerald-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                <span>
                  {copiedWhatsApp
                    ? 'تم نسخ رسالة الغياب! الصقها في واتساب أولياء الأمور الآن 📋'
                    : `نسخ تقرير غياب فصل ${activeSession.className} للواتساب (${absentCount} طالب غائب)`}
                </span>
              </button>

              {/* Students Lists Table */}
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLiveSubTab('absent')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                        liveSubTab === 'absent'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      قائمة الغائبين ({absentCount})
                    </button>

                    <button
                      onClick={() => setLiveSubTab('present')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                        liveSubTab === 'present'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      قائمة الحاضرين ({presentCount})
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    نسبة الحضور: <b className="text-indigo-600">{attendanceRate}%</b>
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                  {/* Absent List */}
                  {liveSubTab === 'absent' && (
                    absentStudents.length > 0 ? (
                      absentStudents.map((st, i) => (
                        <div key={st.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/70">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px] flex items-center justify-center font-mono">
                              {i + 1}
                            </span>
                            <span className="font-bold text-slate-800 text-sm">{st.name}</span>
                          </div>

                          <button
                            onClick={() => handleManualCheckIn(st)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="تحضير يدوي للطالب"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>تحضير يدوي</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-xs text-emerald-700 font-bold">
                        رائع! جميع طلاب فصل {activeSession.className} حاضرون بنسبة 100% 🎉
                      </div>
                    )
                  )}

                  {/* Present List */}
                  {liveSubTab === 'present' && (
                    activeSession.attendance.length > 0 ? (
                      activeSession.attendance.map((rec, i) => (
                        <div key={rec.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/70">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center font-mono">
                              {i + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">{rec.studentName}</span>
                              {rec.matchedRosterName && rec.matchedRosterName !== rec.studentName && (
                                <span className="text-[11px] text-slate-400">(كشف: {rec.matchedRosterName})</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(rec.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-xs text-slate-400">
                        لم يسجل أي طالب حضوره حتى الآن في هذه الحصة.
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Video className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                لا توجد حصص مضافة حالياً
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                اضغط على زر "بدء وتجهيز حصة جديدة" لإضافة حصتك الأولى، أو أضف حصص متعددة لجميع فصولك بنقرة واحدة.
              </p>
              <button
                onClick={() => onSelectNavTab('new-session')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة حصة جديدة الآن</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: START NEW SESSION / BATCH SESSIONS                     */}
      {/* ------------------------------------------------------------- */}
      {activeNavTab === 'new-session' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {batchNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{batchNotice}</span>
            </div>
          )}

          {/* Quick Option: Batch Create for All Classes */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50/60 rounded-3xl border border-emerald-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 mb-1">
                ميزة سريعة للمعلمين
              </span>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                إنشاء حصص لجميع فصولك ({classes.length} فصول) بنقرة واحدة ⚡
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                توليد حصة مستقلة ورابط منفصل لكل فصل دراسي فوراً: ({classes.map((c) => c.name).join(' ، ')})
              </p>
            </div>

            <button
              type="button"
              onClick={handleBatchCreateAllClasses}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>إنشاء لكل الفصول دفعة واحدة</span>
            </button>
          </div>

          {/* Regular Single Session Form */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>إضافة حصة مخصصة جديدة</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                اختر الفصل الدراسي واكتب موضوع الحصة وضع رابط زوم
              </p>
            </div>

            <form onSubmit={handleStartNewSession} className="space-y-5">
              {/* 1. Pick Class */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  ١. اختر الفصل الدراسي:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {classes.map((c) => {
                    const isSelected = c.id === newSessionClassId;
                    const count = students.filter((s) => s.classId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewSessionClassId(c.id)}
                        className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                        }`}
                      >
                        <div className="text-base font-black font-mono">{c.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{count} طالب</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Session Title */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ٢. عنوان أو موضوع الحصة:
                </label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="مثال: مراجعة شاملة للوحدة الأولى"
                  className="w-full px-4 py-3 text-xs sm:text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* 3. Zoom URL */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ٣. رابط اجتماع زوم (Zoom Meeting URL):
                </label>
                <input
                  type="url"
                  required
                  value={newSessionZoomUrl}
                  onChange={(e) => setNewSessionZoomUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-4 py-3 text-xs sm:text-sm font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-left bg-slate-50/50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  سيتم تحويل الطلاب تلقائياً إلى هذا الاجتماع فور تسجيل حضورهم.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>حفظ الحصة وبدء التحضير المباشر 🚀</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: CLASSES & ROSTERS                                      */}
      {/* ------------------------------------------------------------- */}
      {activeNavTab === 'roster' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>إدارة كشوف الأسماء والفصول</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                الصق كشف الأسماء مباشرة (اسم الفصل في سطر، يليه أسماء الطلاب) وسيقوم النظام بتحديث الفصول تلقائياً
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700">
                {classes.length} فصول · {students.length} طالب
              </span>
            </div>
          </div>

          {/* Direct Textarea Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-800">
                محتوى الكشف النصي:
              </label>
              <button
                type="button"
                onClick={() => {
                  const sample = `GR4 - A
احمد عبدالله حليمه
احمد حسام الدين عبد المعز عبد
اياد احمد محمد علم الدين
عمر طارق فاروق
مريم كريم حسن

GR4 - B
يوسف محمد صبحي شحاته
سيف الدين احمد محمد محمود ابراهيم
حمزة شريف الشناوي
فاطمة إبراهيم الشناوي`;
                  setRosterInputText(sample);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تعبئة نموذج تجريبي جاهز</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={rosterInputText}
              onChange={(e) => setRosterInputText(e.target.value)}
              placeholder={`GR4 - A\nاحمد عبدالله حليمه\nاحمد حسام الدين عبد المعز عبد\nاياد احمد محمد علم الدين\n\nGR4 - B\nيوسف محمد صبحي شحاته\nسيف الدين احمد محمد محمود ابراهيم`}
              className="w-full p-4 text-xs sm:text-sm font-mono leading-relaxed border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
            />

            <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <b>طريقة التنسيق:</b> اكتب اسم الفصل أولاً في سطر مستقل (مثل <b>GR4 - A</b>) ثم اضغط Enter واكتب أسماء الطلاب، وعند بدء فصل آخر اكتب اسمه (مثل <b>GR4 - B</b>) وتحته طلابه.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveRosterText}
              className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                rosterSavedNotice
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{rosterSavedNotice ? 'تم حفظ وتحديث الكشف بنجاح! ✅' : 'حفظ الكشف وتحديث الفصول والطلاب'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: SESSIONS HISTORY                                       */}
      {/* ------------------------------------------------------------- */}
      {activeNavTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <span>أرشيف وسجل الحصص المنشأة ({sessions.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                جميع الحصص المضافة مع نسب الحضور وإمكانية فتح أي منها أو حذفها
              </p>
            </div>

            <button
              onClick={() => onSelectNavTab('new-session')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حصة جديدة</span>
            </button>
          </div>

          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => {
                const sTargeted = students.filter((s) => s.classId === session.classId).length;
                const sPresent = session.attendance.length;
                const sRate = sTargeted > 0 ? Math.round((sPresent / sTargeted) * 100) : 0;
                const isSelected = activeSession?.id === session.id;

                return (
                  <div
                    key={session.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white">
                          فصل {session.className}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف حصة "${session.sessionTitle}"؟`)) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف الحصة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 mb-1 line-clamp-1">
                        {session.sessionTitle}
                      </h4>
                      <p className="text-xs text-slate-400 mb-3 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{session.scheduledTime || new Date(session.createdAt).toLocaleDateString('ar-EG')}</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="text-xs font-mono">
                        <span className="text-slate-500">الحضور: </span>
                        <b className="text-slate-900">{sPresent}/{sTargeted}</b> ({sRate}%)
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            onSelectSession(session);
                            onSelectNavTab('live');
                          }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          فتح ومتابعة
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">
              لا توجد حصص سابقة مسجلة.
            </div>
          )}
        </div>
      )}

      {/* Duplicate Session Modal */}
      {showDuplicateModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CopyCheck className="w-5 h-5 text-indigo-600" />
              <span>تكرار الحصة لفصل آخر</span>
            </h3>
            <p className="text-xs text-slate-500">
              سيتم إنشاء حصة جديدة بنفس الموضوع ورابط زوم للفصل الذي تختاره أدناه:
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اختر الفصل المستهدف:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setDuplicateTargetClassId(cls.id)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      duplicateTargetClassId === cls.id
                        ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-950'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono text-sm">{cls.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-sm"
              >
                تأكيد التكرار وبدء الحصة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {activeSession && (
        <QRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          url={gatewayUrl}
          title={`رمز حضور فصل ${activeSession.className}`}
          subtitle={activeSession.sessionTitle}
        />
      )}
    </div>
  );
};
