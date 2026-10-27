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
  Plus
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { generateWhatsAppAbsenteeReport } from '../utils/whatsappFormatter';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface ClassDetailViewProps {
  currentClass: SchoolClass;
  currentTeacher: TeacherProfile;
  students: Student[];
  session: ClassSession;
  onBackToClasses: () => void;
  onUpdateSessionAttendance: (updated: ClassSession) => void;
  onUpdateClassZoom: (classId: string, newZoomUrl: string) => void;
  onOpenStudentGateway: (sessionId: string) => void;
  onAddStudentToClass: (student: Omit<Student, 'id'>) => void;
  onDeleteStudent: (studentId: string) => void;
}

export const ClassDetailView: React.FC<ClassDetailViewProps> = ({
  currentClass,
  currentTeacher,
  students,
  session,
  onBackToClasses,
  onUpdateSessionAttendance,
  onUpdateClassZoom,
  onOpenStudentGateway,
  onAddStudentToClass,
  onDeleteStudent,
}) => {
  // Tabs for view: 'absent' | 'present' | 'roster'
  const [activeTab, setActiveTab] = useState<'absent' | 'present' | 'roster'>('absent');

  // Modals & Feedback
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Edit Zoom Link State
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(currentClass.zoomUrl || session.zoomUrl || '');

  // Add new student inline form
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentTrack, setNewStudentTrack] = useState<'english' | 'arabic'>('english');

  // Students belonging to this class
  const classStudents = students.filter((s) => s.classId === currentClass.id);

  // Checked in students
  const checkedInStudentIds = new Set(
    session.attendance.filter((r) => r.studentId).map((r) => r.studentId)
  );

  // Absent students
  const absentStudents = classStudents.filter(
    (s) => !checkedInStudentIds.has(s.id)
  );

  const presentCount = session.attendance.length;
  const absentCount = absentStudents.length;
  const totalCount = classStudents.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

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

  const handleManualCheckIn = (student: Student) => {
    const newRecord = {
      id: `att_manual_${Date.now()}`,
      sessionId: session.id,
      studentId: student.id,
      studentName: student.name,
      matchedRosterName: student.name,
      track: student.track,
      timestamp: new Date().toISOString(),
      status: 'present' as const,
      confidenceScore: 1.0,
    };
    onUpdateSessionAttendance({
      ...session,
      attendance: [newRecord, ...session.attendance],
    });
  };

  const handleSaveZoom = () => {
    if (zoomInput.trim()) {
      onUpdateClassZoom(currentClass.id, zoomInput.trim());
      setIsEditingZoom(false);
    }
  };

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudentToClass({
      name: newStudentName.trim(),
      classId: currentClass.id,
      track: newStudentTrack,
    });
    setNewStudentName('');
    setShowAddStudentForm(false);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Breadcrumb Navigation: Back to Classes Button                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToClasses}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs sm:text-sm font-bold border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-indigo-600" />
          <span>العودة إلى قائمة جميع الفصول</span>
        </button>

        <button
          onClick={() => onOpenStudentGateway(session.id)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
        >
          <span>معاينة شاشة الطالب</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Class Card Header                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-indigo-600 text-white">
                فصل {currentClass.name}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                {currentClass.gradeLevel}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalCount} طالب مقيد
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              تفاصيل وتحضير فصل {currentClass.name} - مادة {currentTeacher.subject}
            </h2>
          </div>

          {/* Zoom link display with inline edit */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 min-w-[240px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-blue-600" />
                <span>رابط زوم المرتبط بهذا الفصل:</span>
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
                  className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-mono text-slate-600 truncate dir-ltr text-left flex-1 text-[11px]">
                  {currentClass.zoomUrl || session.zoomUrl}
                </span>
                <a
                  href={currentClass.zoomUrl || session.zoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Share Link Strip */}
        <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/50 rounded-2xl p-4 sm:p-5 border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-bold text-indigo-950">
              رابط تحضير الطلاب الخاص بفصل {currentClass.name}:
            </span>
            <span className="text-[11px] text-indigo-700/80 truncate block font-mono dir-ltr text-left">
              {gatewayUrl}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم نسخ الرابط! ✅' : 'نسخ رابط الحضور'}</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="py-2.5 px-3.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-indigo-600" />
              <span>رمز QR</span>
            </button>

            <a
              href={currentClass.zoomUrl || session.zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>دخول زوم</span>
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
              ? 'تم نسخ رسالة الغياب! الصقها في واتساب أولياء الأمور 📋'
              : `نسخ تقرير غياب فصل ${currentClass.name} للواتساب (${absentCount} طالب غائب)`}
          </span>
        </button>

        {/* Detail Tabs Bar: Absent vs Present vs Roster */}
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
                جميع طلاب الفصل ({totalCount})
              </button>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              نسبة الحضور: <b className="text-indigo-600">{attendanceRate}%</b>
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
            {/* TAB: Absent List */}
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
                  ما شاء الله! جميع طلاب فصل {currentClass.name} حاضرون ولا يوجد غياب 🎉
                </div>
              )
            )}

            {/* TAB: Present List */}
            {activeTab === 'present' && (
              session.attendance.length > 0 ? (
                session.attendance.map((rec, i) => (
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
                  لم يسجل أي طالب حضوره حتى الآن في هذا الفصل.
                </div>
              )
            )}

            {/* TAB: Roster of this class */}
            {activeTab === 'roster' && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    قائمة الطلاب المسجلين رسمياً في فصل {currentClass.name}:
                  </span>
                  <button
                    onClick={() => setShowAddStudentForm(!showAddStudentForm)}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة طالب لهذا الفصل</span>
                  </button>
                </div>

                {showAddStudentForm && (
                  <form onSubmit={handleCreateStudent} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      required
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="اسم الطالب بالكامل"
                      className="flex-1 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                    <select
                      value={newStudentTrack}
                      onChange={(e) => setNewStudentTrack(e.target.value as any)}
                      className="p-2 border border-slate-300 rounded-lg bg-white font-bold"
                    >
                      <option value="english">مسار اللغات</option>
                      <option value="arabic">المسار العربي</option>
                    </select>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">
                      إضافة
                    </button>
                  </form>
                )}

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
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف الطالب ${st.name}؟`)) {
                            onDeleteStudent(st.id);
                          }
                        }}
                        className="text-slate-300 hover:text-rose-600 p-1"
                        title="حذف الطالب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          title={`رمز حضور فصل ${currentClass.name}`}
          subtitle={`بوابة تحضير مادة ${currentTeacher.subject}`}
        />
      )}
    </div>
  );
};
