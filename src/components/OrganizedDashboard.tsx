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
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { generateWhatsAppAbsenteeReport } from '../utils/whatsappFormatter';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface OrganizedDashboardProps {
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  activeSession: ClassSession | null;
  onSelectSession: (session: ClassSession) => void;
  onCreateSession: (classId: string, className: string, title: string, zoomUrl: string) => void;
  onUpdateSessionAttendance: (updated: ClassSession) => void;
  onOpenStudentGateway: (sessionId: string) => void;
  onOpenRosterModal: () => void;
}

export const OrganizedDashboard: React.FC<OrganizedDashboardProps> = ({
  currentTeacher,
  classes,
  students,
  sessions,
  activeSession,
  onSelectSession,
  onCreateSession,
  onUpdateSessionAttendance,
  onOpenStudentGateway,
  onOpenRosterModal,
}) => {
  // Class selection state for new session
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [zoomUrl, setZoomUrl] = useState(
    currentTeacher.defaultZoomLink || 'https://zoom.us/j/1112223333?pwd=mathRoom2026'
  );
  const [sessionTitle, setSessionTitle] = useState(
    `حصة ${currentTeacher.subject}`
  );

  // Tab for Present vs Absent
  const [activeTab, setActiveTab] = useState<'present' | 'absent'>('absent');

  // Modals & UI Feedback
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Selected class
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Active session computations
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

  // Copy Gateway Link
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

  // Copy WhatsApp message
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

  // Manual Check-in
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

  // Form submit to start session
  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass) return;
    onCreateSession(
      currentClass.id,
      currentClass.name,
      sessionTitle.trim() || `حصة ${currentTeacher.subject}`,
      zoomUrl.trim() || 'https://zoom.us'
    );
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Header Info Strip: Teacher Name & Quick Status               */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentTeacher.name.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{currentTeacher.name}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {currentTeacher.subject}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentTeacher.schoolName} · {classes.length} فصول مسجلة · {students.length} طالب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSession && (
            <button
              onClick={() => onOpenStudentGateway(activeSession.id)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/70 transition-colors flex items-center gap-1.5"
            >
              <span>تجربة شاشة الطالب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onOpenRosterModal}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>كشف الأسماء</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Grid: 2 Clean Sections (Setup Class VS Live Monitor)    */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right Column 1: Setup & Launch (4 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Start New Class */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                ١
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                إعداد وبدء الحصة (Start Class)
              </h3>
            </div>

            <form onSubmit={handleStartSession} className="space-y-4">
              {/* Select Class */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الفصل الدراسي:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {classes.map((c) => {
                    const isSelected = c.id === selectedClassId;
                    const studentCount = students.filter((s) => s.classId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClassId(c.id)}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-500'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="text-sm font-bold font-mono">{c.name}</div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {studentCount} طالب
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان أو موضوع الحصة:
                </label>
                <input
                  type="text"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="مثال: مراجعة الوحدة الأولى"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* Zoom Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رابط اجتماع زوم (Zoom URL):
                </label>
                <input
                  type="url"
                  required
                  value={zoomUrl}
                  onChange={(e) => setZoomUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-left bg-slate-50/50"
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>بدء الحصة وتوليد الرابط الآن</span>
              </button>
            </form>
          </div>

          {/* Card 2: Previous Sessions List */}
          {sessions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>سجل الحصص المنشأة ({sessions.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">انقر للتنقل بينها</span>
              </h4>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {sessions.map((s) => {
                  const isActive = activeSession?.id === s.id;
                  const sTargeted = students.filter((st) => st.classId === s.classId).length;
                  const sPresent = s.attendance.length;

                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectSession(s)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="truncate max-w-[190px]">
                        <span className="font-mono font-bold ml-1.5 text-indigo-600">[{s.className}]</span>
                        <span>{s.sessionTitle}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 shrink-0">
                        {sPresent}/{sTargeted} حاضر
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Left/Right Column 2: Live Monitor & Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeSession ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
              {/* Header of Active Session */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-700">حصة جارية الآن ومفتوحة للتحضير</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-bold font-mono text-slate-800">فصل {activeSession.className}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {activeSession.sessionTitle}
                  </h3>
                </div>

                <div className="text-left text-xs text-slate-500 font-mono">
                  {totalCount} طالب في الكشف
                </div>
              </div>

              {/* Section 2: Student Share Box */}
              <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100">
                <div className="flex items-center justify-between gap-2 mb-2 text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-indigo-600" />
                    <span>رابط التحضير المباشر للطلاب:</span>
                  </span>
                  <span className="text-[11px] font-normal text-indigo-600">ينقل الطالب فورياً لزوم بعد تسجيل اسمه</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'تم نسخ الرابط بنجاح! ✅' : 'نسخ رابط الحصة للطلاب'}</span>
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="py-2.5 px-3.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span>رمز QR للشاشة</span>
                  </button>

                  <a
                    href={activeSession.zoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <span>دخول زوم</span>
                  </a>
                </div>
              </div>

              {/* Section 3: Live Attendance Numbers Strip */}
              <div className="grid grid-cols-2 gap-3">
                {/* Present Card */}
                <div
                  onClick={() => setActiveTab('present')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    activeTab === 'present'
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-800 mb-1">
                    <span className="text-xs font-bold">الحاضرون الآن</span>
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-black font-mono text-emerald-950 tabular-nums">
                    {presentCount}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    تم تحويلهم لغرفة زوم
                  </div>
                </div>

                {/* Absent Card */}
                <div
                  onClick={() => setActiveTab('absent')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    activeTab === 'absent'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-800 mb-1">
                    <span className="text-xs font-bold">الغائبون</span>
                    <UserX className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-3xl font-black font-mono text-rose-950 tabular-nums">
                    {absentCount}
                  </div>
                  <div className="text-[11px] text-rose-700 mt-1">
                    لم يسجلوا في الكشف بعد
                  </div>
                </div>
              </div>

              {/* Section 4: WhatsApp Absentee Button */}
              <button
                onClick={handleCopyWhatsApp}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  copiedWhatsApp
                    ? 'bg-emerald-700 text-white ring-4 ring-emerald-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                <span>
                  {copiedWhatsApp
                    ? 'تم نسخ رسالة الغياب! الصقها في واتساب أولياء الأمور 📋'
                    : `نسخ تقرير الغياب للواتساب (${absentCount} طالب غائب)`}
                </span>
              </button>

              {/* Section 5: Student Detailed Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('absent')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        activeTab === 'absent'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      كشف الغائبين ({absentCount})
                    </button>

                    <button
                      onClick={() => setActiveTab('present')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        activeTab === 'present'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      كشف الحاضرين ({presentCount})
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    نسبة الحضور: {attendanceRate}%
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {/* Absent List */}
                  {activeTab === 'absent' && (
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
                            className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            title="تحضير يدوي للطالب"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>تحضير يدوي</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-emerald-700 font-bold">
                        رائع! جميع طلاب الفصل حاضرون ولا يوجد غياب 🎉
                      </div>
                    )
                  )}

                  {/* Present List */}
                  {activeTab === 'present' && (
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
                      <div className="p-8 text-center text-xs text-slate-400">
                        لم يسجل أي طالب حضوره حتى الآن. شارك رابط الحصة وسيبدأ الطلاب بالظهور هنا فوراً.
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Video className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                لا توجد حصة جارية حالياً
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                اختر الفصل من القائمة بالجانب، واضغط على "بدء الحصة وتوليد الرابط" لفتح بوابة الحضور المباشرة.
              </p>
            </div>
          )}
        </div>
      </div>

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
