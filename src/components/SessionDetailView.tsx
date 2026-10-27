import React, { useState } from 'react';
import {
  ArrowRight,
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
  Edit2,
  Trash2,
  Share2,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { EditSessionModal } from './EditSessionModal';
import { ConfirmModal } from './ConfirmModal';
import { generateWhatsAppAbsenteeReport, generateRawAbsenteeNamesList } from '../utils/whatsappFormatter';
import { buildStudentAttendanceLink, ensureAbsoluteUrl } from '../utils/urlHelper';
import { normalizeText } from '../utils/arabicFuzzy';
import { recordAttendanceViaServer } from '../utils/apiSync';

interface SessionDetailViewProps {
  session: ClassSession;
  currentTeacher: TeacherProfile;
  students: Student[];
  classes?: SchoolClass[];
  onBackToSessions: () => void;
  onUpdateSessionAttendance: (updated: ClassSession) => void;
  onUpdateSessionZoom: (sessionId: string, newZoomUrl: string) => void;
  onUpdateSession?: (updated: {
    id: string;
    sessionTitle: string;
    classId: string;
    className: string;
    zoomUrl: string;
  }) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenStudentGateway: (sessionId: string) => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  currentTeacher,
  students,
  classes = [],
  onBackToSessions,
  onUpdateSessionAttendance,
  onUpdateSessionZoom,
  onUpdateSession,
  onDeleteSession,
  onOpenStudentGateway,
}) => {
  // Tabs: 'absent' | 'present' | 'roster'
  const [activeTab, setActiveTab] = useState<'absent' | 'present' | 'roster'>('absent');

  // Modals & Feedback
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedRawNames, setCopiedRawNames] = useState(false);
  const [absentTrackFilter, setAbsentTrackFilter] = useState<'all' | 'english' | 'arabic'>('all');

  // Edit Zoom Link State
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(session.zoomUrl || '');

  // Students belonging to this session's class & track
  const classStudents = students.filter((s) => {
    if (s.classId !== session.classId) return false;
    if (session.targetTrack && session.targetTrack !== 'all') {
      return s.track === session.targetTrack;
    }
    return true;
  });

  // Checked in students (matched by ID OR normalized Arabic name)
  const checkedInStudentIds = new Set(
    session.attendance.filter((r) => r.studentId).map((r) => r.studentId)
  );
  const checkedInNames = new Set(
    session.attendance
      .map((r) => normalizeText(r.matchedRosterName || r.studentName || ''))
      .filter(Boolean)
  );

  // Absent students
  const absentStudents = classStudents.filter(
    (s) => !checkedInStudentIds.has(s.id) && !checkedInNames.has(normalizeText(s.name))
  );

  const presentCount = session.attendance.length;
  const absentCount = absentStudents.length;
  const totalCount = classStudents.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const cleanZoomUrl = ensureAbsoluteUrl(session.zoomUrl);
  const gatewayUrl = buildStudentAttendanceLink(session, currentTeacher);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gatewayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      const text = generateWhatsAppAbsenteeReport(
        session,
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

  const handleCopyRawNames = async () => {
    try {
      const text = generateRawAbsenteeNamesList(absentStudents);
      await navigator.clipboard.writeText(text);
      setCopiedRawNames(true);
      setTimeout(() => setCopiedRawNames(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = classStudents.map((st, idx) => {
        const normName = normalizeText(st.name);
        const attRecord = session.attendance.find(
          (a) =>
            a.studentId === st.id ||
            normalizeText(a.matchedRosterName || '') === normName ||
            normalizeText(a.studentName || '') === normName
        );
        const isPresent = Boolean(attRecord);
        const joinCount = attRecord?.joinCount || (isPresent ? 1 : 0);

        return {
          'م': idx + 1,
          'اسم الطالب': st.name,
          'كود الطالب': st.studentCode || '-',
          'المسار': st.track === 'english' ? 'لغات (English)' : 'عربي (Arabic)',
          'حالة الحضور': isPresent ? 'حاضر' : 'غائب',
          'مرات الدخول': isPresent ? (joinCount > 1 ? `${joinCount} (أعاد الدخول)` : '1') : '-',
          'وقت أول دخول': attRecord ? new Date(attRecord.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-',
          'وقت آخر دخول': attRecord?.lastJoinedAt ? new Date(attRecord.lastJoinedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Set Right-to-Left (RTL) mode for Arabic display in Excel
      worksheet['!views'] = [{ rightToLeft: true }];

      // Define column widths for clean readability
      worksheet['!cols'] = [
        { wch: 6 },  // م
        { wch: 32 }, // اسم الطالب
        { wch: 15 }, // كود الطالب
        { wch: 20 }, // المسار
        { wch: 14 }, // حالة الحضور
        { wch: 18 }, // مرات الدخول
        { wch: 16 }, // وقت أول دخول
        { wch: 16 }, // وقت آخر دخول
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `فصل_${session.className}`);
      XLSX.writeFile(workbook, `سجل_حضور_${session.className}_${currentTeacher.name.replace(/\s+/g, '_')}.xlsx`);
    } catch (err) {
      console.warn('Excel export error:', err);
    }
  };

  const handleManualCheckIn = (student: Student) => {
    const nowIso = new Date().toISOString();
    const newRecord = {
      id: `att_manual_${Date.now()}`,
      sessionId: session.id,
      studentId: student.id,
      studentName: student.name,
      matchedRosterName: student.name,
      track: student.track,
      timestamp: nowIso,
      lastJoinedAt: nowIso,
      joinCount: 1,
      status: 'present' as const,
      confidenceScore: 1.0,
    };
    onUpdateSessionAttendance({
      ...session,
      attendance: [newRecord, ...session.attendance],
    });
    recordAttendanceViaServer(session.id, student.name, student, 1.0, {
      classId: session.classId,
      className: session.className,
      sessionTitle: session.sessionTitle,
      zoomUrl: session.zoomUrl,
      targetTrack: session.targetTrack,
      teacherId: session.teacherId,
    }).catch(() => {});
  };

  const handleSaveZoom = () => {
    const cleaned = zoomInput.trim() ? ensureAbsoluteUrl(zoomInput.trim()) : '';
    onUpdateSessionZoom(session.id, cleaned);
    setIsEditingZoom(false);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Top Breadcrumb Navigation: Back to Sessions Button            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToSessions}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs sm:text-sm font-bold border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-indigo-600" />
          <span>العودة إلى الصفحة الرئيسية لجميع الحصص</span>
        </button>

        <div className="flex items-center gap-2">
          {onDeleteSession && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="حذف الحصة"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">حذف الحصة</span>
            </button>
          )}

          <button
            onClick={() => onOpenStudentGateway(session.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
          >
            <span>معاينة شاشة الطالب</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Session Detail Card                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-indigo-600 text-white">
                فصل {session.className}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                حصة نشطة الآن
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalCount} طالب في الكشف
              </span>

              {/* Edit Session Trigger */}
              <button
                onClick={() => setShowEditSessionModal(true)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="تعديل تفاصيل الحصة"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {session.sessionTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              بإشراف المعلم: {currentTeacher.name} ({currentTeacher.subject})
            </p>
          </div>

          {/* Zoom link display with inline edit */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 w-full sm:w-auto min-w-0 sm:min-w-[240px] max-w-full">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-blue-600" />
                <span>رابط زوم المرتبط بهذه الحصة:</span>
              </span>
              <button
                onClick={() => setIsEditingZoom(!isEditingZoom)}
                className="text-indigo-600 hover:underline text-[10px]"
              >
                {isEditingZoom ? 'إلغاء' : 'تعديل'}
              </button>
            </div>

            {isEditingZoom ? (
              <div className="flex items-center gap-1">
                <input
                  type="url"
                  value={zoomInput}
                  onChange={(e) => setZoomInput(e.target.value)}
                  className="w-full text-xs font-mono p-1 border border-indigo-300 rounded bg-white dir-ltr text-left"
                />
                <button
                  onClick={handleSaveZoom}
                  className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-mono text-slate-600 truncate dir-ltr text-left flex-1 min-w-0 text-[11px]">
                  {cleanZoomUrl}
                </span>
                <a
                  href={cleanZoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-blue-600 hover:text-blue-800 shrink-0"
                  title="فتح زوم مباشرة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Dedicated Copyable Link Card (Fit to Screen, Zero Horizontal Scroll) */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-2xs space-y-3 max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
              <Share2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>رابط تحضير الطلاب المباشر لهذه الحصة:</span>
            </div>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
              جاهز للنسخ والإرسال للطلاب
            </span>
          </div>

          {/* Copyable Box tailored exactly to screen width */}
          <div className="w-full max-w-full bg-white rounded-xl border-2 border-indigo-200/90 p-1.5 sm:p-2 flex items-center gap-2 shadow-2xs focus-within:border-indigo-500 transition-all overflow-hidden">
            <input
              type="text"
              readOnly
              value={gatewayUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full flex-1 min-w-0 bg-transparent text-xs font-mono text-slate-700 dir-ltr text-left px-2 py-1 select-all outline-none truncate"
              aria-label="رابط الحضور المباشر"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`py-2 px-3 sm:px-4 rounded-lg font-black text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ! ✅' : 'نسخ الرابط'}</span>
            </button>
          </div>

          {/* 4 Primary Action Buttons in Responsive 2x2 on Mobile, 4x1 on Desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 w-full max-w-full">
            {/* 1. QR Code Button */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="w-full py-2.5 px-3 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="عرض رمز الاستجابة السريعة QR على شاشة الفصل"
            >
              <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">رمز QR للشاشة</span>
            </button>

            {/* 2. Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="تصدير كشف الحضور والغياب بصيغة إكسل رسمية (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">تصدير إكسل</span>
            </button>

            {/* 3. Student Gateway Preview */}
            <button
              type="button"
              onClick={() => onOpenStudentGateway(session.id)}
              className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="معاينة بوابة الطالب المباشرة"
            >
              <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">معاينة الطالب</span>
            </button>

            {/* 4. Direct Zoom Link */}
            <a
              href={cleanZoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all"
              title="دخول غرفة زوم مباشرة"
            >
              <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">دخول زوم</span>
            </a>
          </div>
        </div>

        {/* Attendance Counters Strip */}
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => setActiveTab('present')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'present'
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
              تم تحويلهم لغرفة زوم
            </div>
          </div>

          <div
            onClick={() => setActiveTab('absent')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'absent'
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

        {/* Dual Copy Buttons Bar for Absentees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={handleCopyWhatsApp}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
              copiedWhatsApp
                ? 'bg-emerald-700 text-white ring-4 ring-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {copiedWhatsApp
                ? 'تم نسخ التقرير المنسق! 📋'
                : `نسخ تقرير غياب فصل ${session.className} للواتساب`}
            </span>
          </button>

          <button
            onClick={handleCopyRawNames}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs border cursor-pointer ${
              copiedRawNames
                ? 'bg-indigo-700 text-white border-indigo-700'
                : 'bg-white hover:bg-slate-50 text-indigo-950 border-slate-200'
            }`}
          >
            <Copy className="w-4 h-4 text-indigo-600" />
            <span>
              {copiedRawNames
                ? 'تم نسخ أسماء الغائبين! ✅'
                : `نسخ أسماء الغائبين فقط (${absentCount} طالب)`}
            </span>
          </button>
        </div>

        {/* Detail Tabs Bar: Absent vs Present vs Class Roster */}
        <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('absent')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  activeTab === 'absent'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                كشف الغائبين ({absentCount})
              </button>

              <button
                onClick={() => setActiveTab('present')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  activeTab === 'present'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                كشف الحاضرين ({presentCount})
              </button>

              <button
                onClick={() => setActiveTab('roster')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  activeTab === 'roster'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                جميع طلاب فصل {session.className} ({totalCount})
              </button>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              نسبة الحضور: <b className="text-indigo-600">{attendanceRate}%</b>
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
            {/* TAB: Absent List */}
            {activeTab === 'absent' && (
              <div className="p-2 space-y-2">
                {/* Track Sub-filters if both tracks exist in absent list */}
                {absentStudents.some((s) => s.track === 'english') &&
                  absentStudents.some((s) => s.track === 'arabic') && (
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 text-xs">
                      <span className="text-slate-400 font-bold text-[11px]">تصفية المسار:</span>
                      <button
                        onClick={() => setAbsentTrackFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          absentTrackFilter === 'all'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        الكل ({absentCount})
                      </button>
                      <button
                        onClick={() => setAbsentTrackFilter('english')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          absentTrackFilter === 'english'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        لغات ({absentStudents.filter((s) => s.track === 'english').length})
                      </button>
                      <button
                        onClick={() => setAbsentTrackFilter('arabic')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          absentTrackFilter === 'arabic'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        عربي ({absentStudents.filter((s) => s.track === 'arabic').length})
                      </button>
                    </div>
                  )}

                {absentStudents.length > 0 ? (
                  absentStudents
                    .filter((s) => absentTrackFilter === 'all' || s.track === absentTrackFilter)
                    .map((st, i) => (
                      <div
                        key={st.id}
                        className="p-3 bg-white hover:bg-rose-50/40 rounded-xl border border-slate-100 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-sm truncate">{st.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                              st.track === 'english'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {st.track === 'english' ? 'لغات' : 'عربي'}
                          </span>
                        </div>

                        <button
                          onClick={() => handleManualCheckIn(st)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                          title="تحضير يدوي للطالب"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>تحضير يدوي</span>
                        </button>
                      </div>
                    ))
                ) : (
                  <div className="p-10 text-center text-xs text-emerald-700 font-bold">
                    ما شاء الله! جميع طلاب فصل {session.className} حاضرون ولا يوجد غياب 🎉
                  </div>
                )}
              </div>
            )}

            {/* TAB: Present List */}
            {activeTab === 'present' && (
              session.attendance.length > 0 ? (
                session.attendance.map((rec, i) => (
                  <div key={rec.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/70 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{rec.studentName}</span>
                          {rec.joinCount && rec.joinCount > 1 && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              <span>🔄 أعاد الدخول ({rec.joinCount}×)</span>
                            </span>
                          )}
                        </div>
                        {rec.matchedRosterName && rec.matchedRosterName !== rec.studentName && (
                          <span className="text-[11px] text-slate-400 block">(كشف: {rec.matchedRosterName})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 text-slate-500 font-mono text-[11px]">
                      <div className="flex items-center gap-1 text-emerald-700 font-bold" title="وقت أول دخول">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>أول: {new Date(rec.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {rec.lastJoinedAt && rec.lastJoinedAt !== rec.timestamp && (
                        <div className="flex items-center gap-1 text-amber-700 text-[10px]" title="وقت آخر إعادة دخول">
                          <span>آخر: {new Date(rec.lastJoinedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-xs text-slate-400">
                  لم يسجل أي طالب حضوره حتى الآن في هذه الحصة.
                </div>
              )
            )}

            {/* TAB: All Class Students */}
            {activeTab === 'roster' && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-bold text-slate-700 mb-2">
                  كشف أسماء الطلاب المسجلين رسمياً في فصل {session.className}:
                </div>
                <div className="divide-y divide-slate-100">
                  {classStudents.map((st, i) => (
                    <div key={st.id} className="py-2 px-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">{i + 1}.</span>
                        <span className="font-bold text-slate-900">{st.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {st.track === 'english' ? 'لغات' : 'عربي'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{st.studentCode || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <QRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          url={gatewayUrl}
          title={`رمز حضور فصل ${session.className}`}
          subtitle={session.sessionTitle}
        />
      )}

      {/* Edit Session Modal */}
      {showEditSessionModal && onUpdateSession && (
        <EditSessionModal
          isOpen={showEditSessionModal}
          onClose={() => setShowEditSessionModal(false)}
          session={session}
          classes={classes}
          onSave={(updated) => {
            onUpdateSession(updated);
            setShowEditSessionModal(false);
          }}
        />
      )}

      {/* Delete Session Confirmation Modal */}
      {showDeleteModal && onDeleteSession && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="حذف الحصة الدراسية"
          message={`هل أنت متأكد من رغبتك في حذف حصة "${session.sessionTitle}"؟ سيتم حذف بيانات الحضور والغياب المرتبطة بها نهائياً.`}
          confirmText="نعم، احذف الحصة"
          cancelText="تراجع"
          onConfirm={() => {
            onDeleteSession(session.id);
            setShowDeleteModal(false);
            onBackToSessions();
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};
