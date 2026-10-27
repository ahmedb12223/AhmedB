import React, { useState, useEffect } from 'react';
import { X, Check, Video, Layers, Edit3, Users, Globe, BookOpen } from 'lucide-react';
import { ClassSession, SchoolClass, LanguageTrack } from '../types';
import { ensureAbsoluteUrl } from '../utils/urlHelper';

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ClassSession;
  classes: SchoolClass[];
  onSave: (updated: {
    id: string;
    sessionTitle: string;
    classId: string;
    className: string;
    zoomUrl: string;
    targetTrack?: LanguageTrack;
  }) => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  classes,
  onSave,
}) => {
  const [title, setTitle] = useState(session.sessionTitle);
  const [selectedClassId, setSelectedClassId] = useState(session.classId);
  const [zoomUrl, setZoomUrl] = useState(session.zoomUrl);
  const [targetTrack, setTargetTrack] = useState<LanguageTrack>(session.targetTrack || 'all');

  useEffect(() => {
    setTitle(session.sessionTitle);
    setSelectedClassId(session.classId);
    setZoomUrl(session.zoomUrl);
    setTargetTrack(session.targetTrack || 'all');
  }, [session?.id, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = classes.find((c) => c.id === selectedClassId) || {
      id: selectedClassId,
      name: session.className,
    };

    onSave({
      id: session.id,
      sessionTitle: title.trim(),
      classId: targetClass.id,
      className: targetClass.name,
      zoomUrl: zoomUrl.trim() ? ensureAbsoluteUrl(zoomUrl.trim()) : '',
      targetTrack,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in dir-rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                تعديل بيانات الحصة
              </h2>
              <p className="text-xs text-slate-500">
                تعديل العنوان، الفصل المربوط بالحصة، الفئة المستهدفة، أو رابط زوم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              عنوان وموضوع الحصة:
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة الكسور - الحصة الأولى"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Target Track Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              الفئة المستهدفة بالحصة (عربي / لغات / كلاهما):
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTargetTrack('all')}
                className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  targetTrack === 'all'
                    ? 'bg-white text-indigo-950 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>كلاهما (الجميع)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetTrack('english')}
                className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  targetTrack === 'english'
                    ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>طلاب اللغات</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetTrack('arabic')}
                className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  targetTrack === 'arabic'
                    ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>طلاب العربي</span>
              </button>
            </div>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              الفصل الدراسي:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="font-bold text-slate-900">
                  فصل {cls.name} ({cls.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Zoom URL */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              رابط اجتماع زوم (Zoom Link):
            </label>
            <input
              type="text"
              value={zoomUrl}
              onChange={(e) => setZoomUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-left"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
