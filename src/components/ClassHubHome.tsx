import React, { useState } from 'react';
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
  Link as LinkIcon,
  Layers,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { ClassSession, SchoolClass, Student, TeacherProfile } from '../types';
import { QRCodeModal } from './QRCodeModal';
import { buildStudentAttendanceLink } from '../utils/urlHelper';

interface ClassHubHomeProps {
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  onEnterClass: (classId: string) => void;
  onCreateClass: (name: string, gradeLevel: string, zoomUrl: string) => void;
  onUpdateClassZoom: (classId: string, newZoomUrl: string) => void;
  onDeleteClass: (classId: string) => void;
  onOpenRosterModal: () => void;
}

export const ClassHubHome: React.FC<ClassHubHomeProps> = ({
  currentTeacher,
  classes,
  students,
  sessions,
  onEnterClass,
  onCreateClass,
  onUpdateClassZoom,
  onDeleteClass,
  onOpenRosterModal,
}) => {
  // New Class Form State
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Grade 4');
  const [newClassZoom, setNewClassZoom] = useState(
    currentTeacher.defaultZoomLink || 'https://zoom.us/j/1112223333?pwd=school2026'
  );

  // QR Code Modal State
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string; subtitle: string } | null>(null);

  // Copied link indicator per class id
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);

  // Inline editing zoom url per class
  const [editingZoomClassId, setEditingZoomClassId] = useState<string | null>(null);
  const [tempZoomUrl, setTempZoomUrl] = useState('');

  const getAttendanceLinkForClass = (classObj: SchoolClass): string => {
    const classSession = sessions.find((s) => s.classId === classObj.id);
    if (classSession) {
      return buildStudentAttendanceLink(classSession, currentTeacher);
    }
    const virtualSession: ClassSession = {
      id: `class_${classObj.id}`,
      classId: classObj.id,
      className: classObj.name,
      sessionTitle: `حصة فصل ${classObj.name}`,
      zoomUrl: classObj.zoomUrl || currentTeacher.defaultZoomLink || 'https://zoom.us',
      teacherId: currentTeacher.id,
      targetTrack: 'all',
      createdAt: new Date().toISOString(),
      scheduledTime: 'مباشر الآن',
      isActive: true,
      attendance: [],
    };
    return buildStudentAttendanceLink(virtualSession, currentTeacher);
  };

  const handleCopyClassLink = async (classObj: SchoolClass) => {
    const link = getAttendanceLinkForClass(classObj);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedClassId(classObj.id);
      setTimeout(() => setCopiedClassId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenQr = (classObj: SchoolClass) => {
    const link = getAttendanceLinkForClass(classObj);
    setQrModalData({
      url: link,
      title: `رمز حضور فصل ${classObj.name}`,
      subtitle: `بوابة تحضير مادة ${currentTeacher.subject}`,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    onCreateClass(newClassName.trim(), newClassGrade.trim(), newClassZoom.trim());
    setNewClassName('');
    setShowAddClass(false);
  };

  const handleSaveZoomEdit = (classId: string) => {
    if (tempZoomUrl.trim()) {
      onUpdateClassZoom(classId, tempZoomUrl.trim());
    }
    setEditingZoomClassId(null);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Top Banner: Teacher Greeting & Class Overview                 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700">الصفحة الرئيسية لإدارة الفصول والروابط</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            فصول {currentTeacher.name} ({currentTeacher.subject})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            لكل فصل رابط زوم ورابط تحضير مخصص. انقر على أي فصل لمشاهدة تفاصيله وكشف الحضور والغياب.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAddClass(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء فصل وربطه برابط زوم</span>
          </button>

          <button
            onClick={onOpenRosterModal}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>كشف الأسماء (نصي)</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Create New Class Inline Modal/Form                            */}
      {/* ------------------------------------------------------------- */}
      {showAddClass && (
        <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-3xl p-5 sm:p-6 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-indigo-100">
            <h3 className="text-sm sm:text-base font-black text-indigo-950 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              <span>إنشاء فصل جديد وربطه برابط زوم الخاص به</span>
            </h3>
            <button
              onClick={() => setShowAddClass(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1"
            >
              إلغاء
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الفصل (مثل: GR4 - C أو 5A):
              </label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="مثال: GR4 - C"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المرحلة الدراسية:
              </label>
              <input
                type="text"
                required
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
                placeholder="مثال: Grade 4"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رابط زوم المرتبط بهذا الفصل:
              </label>
              <input
                type="url"
                required
                value={newClassZoom}
                onChange={(e) => setNewClassZoom(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dir-ltr text-left"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClass(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                حفظ الفصل وتوليد الرابط فوراً
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Grid of Class Cards (بطاقات الفصول مع الروابط)                */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const classStudents = students.filter((s) => s.classId === cls.id);
          const classSession = sessions.find((s) => s.classId === cls.id);
          const presentCount = classSession ? classSession.attendance.length : 0;
          const totalCount = classStudents.length;
          const absentCount = Math.max(0, totalCount - presentCount);
          const isCopied = copiedClassId === cls.id;
          const effectiveZoom = cls.zoomUrl || classSession?.zoomUrl || 'https://zoom.us';

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
            >
              {/* Card Top: Class Name & Total Students */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-indigo-600 text-white shadow-2xs">
                    فصل {cls.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {totalCount} طالب
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`هل أنت متأكد من حذف فصل ${cls.name}؟`)) {
                          onDeleteClass(cls.id);
                        }
                      }}
                      className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف الفصل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium mb-3">
                  {cls.gradeLevel} · مادة {currentTeacher.subject}
                </div>

                {/* Linked Zoom Box */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 mb-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-blue-600" />
                      <span>رابط زوم المرتبط بالفصل:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingZoomClassId(cls.id);
                        setTempZoomUrl(effectiveZoom);
                      }}
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                  </div>

                  {editingZoomClassId === cls.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="url"
                        value={tempZoomUrl}
                        onChange={(e) => setTempZoomUrl(e.target.value)}
                        className="w-full text-xs font-mono p-1 border border-indigo-300 rounded bg-white dir-ltr text-left"
                      />
                      <button
                        onClick={() => handleSaveZoomEdit(cls.id)}
                        className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded"
                      >
                        حفظ
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono text-slate-600 truncate dir-ltr text-left flex-1">
                        {effectiveZoom}
                      </span>
                      <a
                        href={effectiveZoom}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="فتح اجتماع زوم مباشرة"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Quick Student Attendance Link Box */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => handleCopyClassLink(cls)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'تم نسخ الرابط! ✅' : 'نسخ رابط حضور الطلاب'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenQr(cls)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                    title="عرض رمز QR للشاشة"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>

                {/* Mini Attendance Indicator */}
                <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/80 rounded-xl border border-slate-100 font-mono">
                  <span className="text-emerald-700 font-bold">🟢 {presentCount} حاضر</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-rose-700 font-bold">🔴 {absentCount} غائب</span>
                  <span className="text-slate-400 text-[11px]">
                    ({totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
              </div>

              {/* Big CTA: Enter into Class Details */}
              <button
                onClick={() => onEnterClass(cls.id)}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group-hover:bg-indigo-600"
              >
                <span>الدخول إلى تفاصيل الفصل ومتابعة الحضور</span>
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          );
        })}
      </div>

      {/* QR Code Modal */}
      {qrModalData && (
        <QRCodeModal
          isOpen={!!qrModalData}
          onClose={() => setQrModalData(null)}
          url={qrModalData.url}
          title={qrModalData.title}
          subtitle={qrModalData.subtitle}
        />
      )}
    </div>
  );
};
