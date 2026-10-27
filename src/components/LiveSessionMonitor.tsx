import React, { useState } from 'react';
import {
  Copy,
  Check,
  QrCode,
  ExternalLink,
  MessageCircle,
  FileSpreadsheet,
  Users,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  PlusCircle,
  RefreshCw
} from 'lucide-react';
import { ClassSession, LanguageTrack, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { generateWhatsAppAbsenteeReport, getTrackLabel } from '../utils/whatsappFormatter';
import { exportAttendanceToCSV } from '../utils/excelParser';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface LiveSessionMonitorProps {
  session: ClassSession;
  allStudents: Student[];
  teacher: TeacherProfile;
  onBackToList: () => void;
  onUpdateSessionAttendance: (updatedSession: ClassSession) => void;
  onOpenStudentGatewayTest: (sessionId: string) => void;
}

export const LiveSessionMonitor: React.FC<LiveSessionMonitorProps> = ({
  session,
  allStudents,
  teacher,
  onBackToList,
  onUpdateSessionAttendance,
  onOpenStudentGatewayTest,
}) => {
  const [activeTab, setActiveTab] = useState<'present' | 'absent'>('present');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // The session gateway URL using the authoritative published domain
  const gatewayUrl = buildStudentAttendanceLink(session, teacher);

  // Filter targeted roster students by class and target track!
  const targetedStudents = allStudents.filter((student) => {
    if (student.classId !== session.classId) return false;
    if (session.targetTrack === 'all') return true;
    return student.track === session.targetTrack;
  });

  // Checked in student IDs
  const checkedInStudentIds = new Set(
    session.attendance
      .filter((r) => r.studentId)
      .map((r) => r.studentId as string)
  );

  // Absent students
  const absentStudents = targetedStudents.filter(
    (student) => !checkedInStudentIds.has(student.id)
  );

  const presentCount = session.attendance.length;
  const totalTargeted = targetedStudents.length;
  const absentCount = absentStudents.length;
  const attendanceRate =
    totalTargeted > 0 ? Math.round((presentCount / totalTargeted) * 100) : 0;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gatewayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyWhatsAppReport = async () => {
    try {
      const report = generateWhatsAppAbsenteeReport(
        session,
        absentStudents,
        teacher.name,
        teacher.subject
      );
      await navigator.clipboard.writeText(report);
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
      studentName: `${student.name} (تحضير يدوي)`,
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

  const handleRemoveAttendance = (recordId: string) => {
    onUpdateSessionAttendance({
      ...session,
      attendance: session.attendance.filter((r) => r.id !== recordId),
    });
  };

  const handleExportExcel = () => {
    const records = [
      ...session.attendance.map((r) => ({
        studentName: r.studentName,
        matchedRosterName: r.matchedRosterName,
        track: r.track || 'english',
        status: r.status,
        timestamp: r.timestamp,
        confidence: r.confidenceScore,
      })),
      ...absentStudents.map((s) => ({
        studentName: s.name,
        matchedRosterName: s.name,
        track: s.track,
        status: 'absent',
      })),
    ];

    exportAttendanceToCSV(
      session.sessionTitle,
      session.className,
      getTrackLabel(session.targetTrack),
      records
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Return */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة الحصص والأرشيف</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenStudentGatewayTest(session.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تجربة شاشة الطالب (Student Gateway)</span>
          </button>
        </div>
      </div>

      {/* Main Session Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg font-mono">
                فصل {session.className}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  session.targetTrack === 'english'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : session.targetTrack === 'arabic'
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                }`}
              >
                {getTrackLabel(session.targetTrack)}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{session.scheduledTime || 'مباشر الآن'}</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              {session.sessionTitle}
            </h1>

            <p className="text-xs text-slate-500">
              بإشراف: <span className="font-semibold text-slate-700">{teacher.name}</span> ({teacher.subject}) · {teacher.schoolName}
            </p>
          </div>

          {/* Quick Actions for Link and Zoom */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <QrCode className="w-4 h-4 text-slate-600" />
              <span>عرض رمز QR</span>
            </button>

            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-2xs ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-indigo-600" />}
              <span>{copiedLink ? 'تم نسخ الرابط' : 'نسخ رابط الطالب'}</span>
            </button>

            <a
              href={session.zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>فتح زوم (المعلم)</span>
            </a>
          </div>
        </div>

        {/* Live Attendance KPIs Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">إجمالي المستهدفين</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {totalTargeted}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              طلاب الفصل المشمولين
            </div>
          </div>

          <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/60">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-semibold">حضروا الآن</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-900 tabular-nums">
              {presentCount}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              تم تحويلهم لزوم بنجاح
            </div>
          </div>

          <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-200/60">
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-xs font-semibold">الغائبون حالياً</span>
              <UserX className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-900 tabular-nums">
              {absentCount}
            </div>
            <div className="text-[11px] text-rose-700 mt-0.5">
              لم يسجلوا دخولهم بعد
            </div>
          </div>

          <div className="bg-indigo-50/60 rounded-xl p-4 border border-indigo-200/60">
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-xs font-semibold">نسبة الحضور</span>
              <span className="text-xs font-mono font-bold text-indigo-600">{attendanceRate}%</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-2.5 my-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, attendanceRate)}%` }}
              />
            </div>
            <div className="text-[11px] text-indigo-700 mt-0.5">
              {presentCount} من أصل {totalTargeted} طالب
            </div>
          </div>
        </div>
      </div>

      {/* Roster & Attendance Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Tab Headers and Quick Report Action */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('present')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'present'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>كشف الحاضرين ({presentCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('absent')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'absent'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>كشف الغائبين ({absentCount})</span>
            </button>
          </div>

          {/* Quick WhatsApp Absentee Report button & Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsAppReport}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                copiedWhatsApp
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="نسخ تقرير جاهز للواتساب يحتوي على أسماء الغائبين وبيانات الحصة"
            >
              {copiedWhatsApp ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم نسخ تقرير الواتساب إلى الحافظة! 📋</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  <span>نسخ تقرير الغياب للواتساب</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs"
              title="تصدير ملف إكسيل كامل بالحضور والغياب"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Present Students */}
        {activeTab === 'present' && (
          <div>
            {session.attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">الاسم الذي أدخله الطالب</th>
                      <th className="p-3">الاسم المطابق في الكشف الرسمي</th>
                      <th className="p-3">المسار</th>
                      <th className="p-3">وقت الدخول والتحضير</th>
                      <th className="p-3">حالة المطابقة</th>
                      <th className="p-3 w-16 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {session.attendance.map((record, index) => {
                      const timeStr = new Date(record.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const isHighConfidence = record.confidenceScore >= 0.85;

                      return (
                        <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-mono">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 text-sm">
                              {record.studentName}
                            </span>
                          </td>
                          <td className="p-3">
                            {record.matchedRosterName ? (
                              <span className="text-slate-700 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{record.matchedRosterName}</span>
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200/80">
                                غير مقيد في الكشف (طالب زائر)
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                record.track === 'english'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {record.track === 'english' ? 'لغات' : record.track === 'arabic' ? 'عربي' : 'عام'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {timeStr}
                          </td>
                          <td className="p-3">
                            {record.status === 'guest' ? (
                              <span className="text-amber-700 font-semibold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>زائر</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                  isHighConfidence
                                    ? 'text-emerald-700'
                                    : 'text-indigo-700'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  تطابق ذكي ({Math.round(record.confidenceScore * 100)}%)
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemoveAttendance(record.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 text-[11px] hover:underline"
                              title="حذف هذا السجل"
                            >
                              إلغاء
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  لم يسجل أي طالب حضوره بعد
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  شارك رابط الحصة أو رمز QR مع الطلاب في شات زوم أو جروب الواتساب وسيبدأ الحضور بالظهور هنا فورياً!
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                  >
                    نسخ رابط البوابة للطلاب
                  </button>
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                  >
                    عرض رمز QR
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Absent Students */}
        {activeTab === 'absent' && (
          <div>
            {absentStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="p-3 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-800">
                  <span>
                    تم حساب قائمة الغياب تلقائياً بمقارنة الحضور مع كشف فصل {session.className} ({getTrackLabel(session.targetTrack)})
                  </span>
                  <span className="font-bold">المتبقي غياب: {absentStudents.length} طالب</span>
                </div>
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">اسم الطالب في الكشف الرسمي</th>
                      <th className="p-3">المسار</th>
                      <th className="p-3">كود الطالب</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 w-28 text-center">إجراء سريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {absentStudents.map((student, index) => (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {index + 1}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 text-sm">
                          {student.name}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              student.track === 'english'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {student.track === 'english' ? 'مسار اللغات' : 'المسار العربي'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {student.studentCode || '-'}
                        </td>
                        <td className="p-3">
                          <span className="text-rose-700 font-semibold text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                            <span>غائب</span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleManualCheckIn(student)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-md text-[11px] font-semibold transition-colors"
                            title="تحضير يدوي إذا كان الطالب حاضر بزوم وواجه مشكلة تقنية"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>تحضير يدوي</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-1">
                  ما شاء الله! جميع الطلاب حاضرون 🎉
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  نسبة حضور كشف {session.className} بلغت 100% ولا يوجد أي طالب غائب حالياً.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        url={gatewayUrl}
        title={`بوابة تحضير فصل ${session.className}`}
        subtitle={session.sessionTitle}
      />
    </div>
  );
};
