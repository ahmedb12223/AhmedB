import React, { useState } from 'react';
import { X, Video, Users, Sparkles, Calendar, Globe2, Link as LinkIcon } from 'lucide-react';
import { ClassSession, LanguageTrack, SchoolClass, TeacherProfile } from '../types';

interface SessionCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  onCreateSession: (session: Omit<ClassSession, 'id' | 'createdAt' | 'attendance'>) => void;
}

export const SessionCreatorModal: React.FC<SessionCreatorModalProps> = ({
  isOpen,
  onClose,
  currentTeacher,
  classes,
  onCreateSession,
}) => {
  const teacherClasses = classes.filter(
    (c) =>
      !currentTeacher.assignedClassIds ||
      currentTeacher.assignedClassIds.length === 0 ||
      currentTeacher.assignedClassIds.includes(c.id)
  );

  const [selectedClassId, setSelectedClassId] = useState(
    teacherClasses[0]?.id || classes[0]?.id || ''
  );
  const [sessionTitle, setSessionTitle] = useState(
    `حصة ${currentTeacher.subject || 'مراجعة'}`
  );
  const [zoomUrl, setZoomUrl] = useState(currentTeacher.defaultZoomLink || 'https://zoom.us/j/9876543210?pwd=demoClassRoom2026');
  const [targetTrack, setTargetTrack] = useState<LanguageTrack>('all');

  // Keep state in sync with current teacher when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedClassId(teacherClasses[0]?.id || classes[0]?.id || '');
      setSessionTitle(`حصة ${currentTeacher.subject || 'مراجعة'}`);
      setZoomUrl(currentTeacher.defaultZoomLink || 'https://zoom.us/j/9876543210?pwd=demoClassRoom2026');
    }
  }, [isOpen, currentTeacher]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = classes.find((c) => c.id === selectedClassId) || classes[0];
    if (!targetClass) return;

    onCreateSession({
      teacherId: currentTeacher.id,
      classId: targetClass.id,
      className: targetClass.name,
      sessionTitle: sessionTitle.trim(),
      zoomUrl: zoomUrl.trim(),
      targetTrack,
      scheduledTime: 'الآن (مباشر)',
      isActive: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">إنشاء حصة زوم وبوابة تحضير جديدة</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                توليد رابط فريد ورمز QR ذكي لدخول وتحضير الطلاب تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Class selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الفصل الدراسي المستهدف
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              <select
                required
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              >
                {teacherClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    فصل {c.name} - {c.gradeLevel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Track (Languages school support) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              المسار المستهدف في الحصة (تحديد الحضور والغياب)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetTrack('all')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  targetTrack === 'all'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Globe2 className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <span className="block text-xs">كل الفصل</span>
                <span className="block text-[10px] text-slate-400 font-normal">عربي ولغات</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetTrack('english')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  targetTrack === 'english'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <span className="block text-xs">مسار اللغات</span>
                <span className="block text-[10px] text-slate-400 font-normal">English Track</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetTrack('arabic')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  targetTrack === 'arabic'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="block text-xs">المسار العربي</span>
                <span className="block text-[10px] text-slate-400 font-normal">Arabic Track</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              مهم: كشف الغياب سيحسب فقط الطلاب التابعين للمسار المختار حتى لا يُسجل طالب لغات غائباً في حصة عربي أو العكس!
            </p>
          </div>

          {/* Session Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              عنوان أو موضوع الحصة
            </label>
            <input
              type="text"
              required
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="مثال: مراجعة الوحدة الأولى - Science Prep 1"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Zoom URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              رابط اجتماع زوم (Zoom Meeting URL)
            </label>
            <div className="relative dir-ltr">
              <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="url"
                required
                value={zoomUrl}
                onChange={(e) => setZoomUrl(e.target.value)}
                placeholder="https://zoom.us/j/1234567890?pwd=..."
                className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              سيتم تحويل الطالب إلى هذا الرابط فور إدخال اسمه وتأكيد حضوره.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              توليد البوابة وبدء الحصة الآن
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
