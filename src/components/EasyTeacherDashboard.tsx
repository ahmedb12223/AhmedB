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
  Play
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { generateWhatsAppAbsenteeReport } from '../utils/whatsappFormatter';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface EasyTeacherDashboardProps {
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  activeSession: ClassSession | null;
  onSelectSession: (session: ClassSession) => void;
  onCreateSession: (classId: string, className: string, title: string, zoomUrl: string) => void;
  onUpdateSessionAttendance: (updated: ClassSession) => void;
  onOpenStudentGateway: (sessionId: string) => void;
}

export const EasyTeacherDashboard: React.FC<EasyTeacherDashboardProps> = ({
  currentTeacher,
  classes,
  students,
  sessions,
  activeSession,
  onSelectSession,
  onCreateSession,
  onUpdateSessionAttendance,
  onOpenStudentGateway,
}) => {
  // Setup Class State
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [zoomUrl, setZoomUrl] = useState(
    currentTeacher.defaultZoomLink || 'https://zoom.us/j/1112223333?pwd=mathRoom2026'
  );
  const [sessionTitle, setSessionTitle] = useState(
    `حصة ${currentTeacher.subject}`
  );

  // Modals & Feedback
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [activeTab, setActiveTab] = useState<'present' | 'absent'>('present');

  // Currently selected class object
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Active Session calculations
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

  const gatewayUrl = activeSession
    ? buildStudentAttendanceLink(activeSession, currentTeacher)
    : '';

  // Copy link
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

  // Copy WhatsApp report
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

  // Start new class
  const handleStartClass = (e: React.FormEvent) => {
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold mb-2 text-indigo-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentTeacher.subject} · {currentTeacher.schoolName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              أهلاً بك، {currentTeacher.name} 👋
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1 max-w-xl leading-relaxed">
              اختر الفصل بالأسفل ثم ابدأ الحصة لتوليد رابط التحضير التلقائي وتقرير الغياب للواتساب بنقرة واحدة.
            </p>
          </div>

          {activeSession && (
            <button
              onClick={() => onOpenStudentGateway(activeSession.id)}
              className="self-start sm:self-auto px-4 py-2 bg-white text-indigo-900 rounded-2xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-md flex items-center gap-1.5 shrink-0"
            >
              <span>تجربة شاشة الطالب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Choose Class & Start Class Box */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <span>الخطوة 1: اختر الفصل لبدء الحصة</span>
        </h3>

        {/* Big Class Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {classes.map((c) => {
            const isSelected = c.id === selectedClassId;
            const count = students.filter((s) => s.classId === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`py-3 px-3 rounded-2xl border text-center transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                }`}
              >
                <div className="text-base sm:text-lg font-black font-mono">{c.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{count} طالب</div>
              </button>
            );
          })}
        </div>

        {/* Quick Zoom Link Input & Start Button */}
        <form onSubmit={handleStartClass} className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex-1 relative">
            <input
              type="url"
              required
              value={zoomUrl}
              onChange={(e) => setZoomUrl(e.target.value)}
              placeholder="ضع رابط اجتماع زوم هنا (https://zoom.us/...)"
              className="w-full px-4 py-3 text-xs sm:text-sm font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left dir-ltr bg-slate-50/50"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>بدء الحصة وتوليد الرابط 🚀</span>
          </button>
        </form>
      </div>

      {/* 3. Active Session Management (If a session is active) */}
      {activeSession ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
          {/* Active Class Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-700">حصة جارية الآن ومفتوحة للطلاب</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-bold text-slate-900 font-mono">فصل {activeSession.className}</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                {activeSession.sessionTitle}
              </h3>
            </div>

            {/* Previous Sessions Dropdown if any */}
            {sessions.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>تغيير الحصة:</span>
                <select
                  value={activeSession.id}
                  onChange={(e) => {
                    const found = sessions.find((s) => s.id === e.target.value);
                    if (found) onSelectSession(found);
                  }}
                  className="bg-slate-100 font-bold text-slate-800 rounded-xl px-2.5 py-1.5 border border-slate-200 text-xs"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.className} - {s.sessionTitle.slice(0, 25)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Share Buttons Box */}
          <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-100/90 flex flex-wrap items-center justify-between gap-3">
            <div className="text-right">
              <span className="block text-xs font-bold text-indigo-950">
                شارك هذا الرابط مع الطلاب (في شات زوم أو واتساب):
              </span>
              <span className="text-[11px] text-indigo-700/80 truncate max-w-sm block font-mono dir-ltr text-left">
                {gatewayUrl}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'تم نسخ الرابط! ✅' : 'نسخ رابط الحصة'}</span>
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="px-3.5 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>رمز QR</span>
              </button>

              <a
                href={activeSession.zoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-blue-600" />
                <span>فتح زوم</span>
              </a>
            </div>
          </div>

          {/* Attendance Counters Strip */}
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setActiveTab('present')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activeTab === 'present'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-xs font-bold">الحاضرون الآن</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black font-mono text-emerald-950 tabular-nums">
                {presentCount}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">سجلوا حضورهم بنجاح</p>
            </div>

            <div
              onClick={() => setActiveTab('absent')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activeTab === 'absent'
                  ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-rose-800 mb-1">
                <span className="text-xs font-bold">الغائبون</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-3xl font-black font-mono text-rose-950 tabular-nums">
                {absentCount}
              </div>
              <p className="text-[11px] text-rose-700 mt-1">لم يسجلوا بعد في الكشف</p>
            </div>
          </div>

          {/* Big WhatsApp Absentee Report Button */}
          <button
            onClick={handleCopyWhatsApp}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              copiedWhatsApp
                ? 'bg-emerald-700 text-white ring-4 ring-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>
              {copiedWhatsApp
                ? 'تم نسخ تقرير الغياب للواتساب! الصقه في الجروب الآن 📋'
                : `نسخ رسالة الغياب للواتساب (${absentCount} طالب غائب)`}
            </span>
          </button>

          {/* Student Lists (Present vs Absent) */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {activeTab === 'present'
                  ? `قائمة الطلاب الحاضرين (${presentCount})`
                  : `قائمة الطلاب الغائبين (${absentCount})`}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('present')}
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                    activeTab === 'present'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  الحاضرون
                </button>
                <button
                  onClick={() => setActiveTab('absent')}
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                    activeTab === 'absent'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  الغائبون
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
              {activeTab === 'present' && (
                activeSession.attendance.length > 0 ? (
                  activeSession.attendance.map((rec, idx) => (
                    <div key={rec.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">
                            {rec.studentName}
                          </span>
                          {rec.matchedRosterName && rec.matchedRosterName !== rec.studentName && (
                            <span className="text-[11px] text-slate-400">
                              (مطابق لـ: {rec.matchedRosterName})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(rec.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    لم يسجل أي طالب حضوره حتى الآن. شارك الرابط مع الطلاب وسيظهرون هنا فوراً.
                  </div>
                )
              )}

              {activeTab === 'absent' && (
                absentStudents.length > 0 ? (
                  absentStudents.map((st, idx) => (
                    <div key={st.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          {st.name}
                        </span>
                      </div>

                      <button
                        onClick={() => handleManualCheckIn(st)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        title="تحضير يدوي للطالب"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>تحضير يدوي</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-emerald-700 font-bold">
                    ما شاء الله! جميع طلاب الفصل حاضرون بنسبة 100% 🎉
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-3xl p-8 text-center border border-slate-200">
          <p className="text-sm font-bold text-slate-700 mb-1">لا توجد حصة نشطة حالياً</p>
          <p className="text-xs text-slate-500">اختر الفصل بالأعلى واضغط على "بدء الحصة وتوليد الرابط" لبدء التحضير التلقائي.</p>
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
