import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Check, X, ShieldCheck, Eye, EyeOff, Sparkles, ShieldAlert } from 'lucide-react';
import { storage, isAhmedBadawi } from '../utils/storage';
import { TeacherProfile } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeacher: TeacherProfile;
  onSuccess?: (newPin: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentTeacher,
  onSuccess,
}) => {
  const isOwner = isAhmedBadawi(currentTeacher);
  const [currentPin, setCurrentPin] = useState(() => storage.getTeacherPin());
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPin(storage.getTeacherPin());
      setNewPin('');
      setConfirmPin('');
      setErrorMsg(null);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isOwner) {
      setErrorMsg('عذراً، تعديل كلمة المرور متاح حصرياً من لوحة تحكم مستر أحمد بدوي فقط.');
      return;
    }

    const trimmed = newPin.trim();
    if (!trimmed) {
      setErrorMsg('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }

    if (trimmed.length < 4) {
      setErrorMsg('كلمة المرور يجب أن تكون 4 أرقام أو خانات على الأقل.');
      return;
    }

    if (confirmPin.trim() && confirmPin.trim() !== trimmed) {
      setErrorMsg('تأكيد كلمة المرور غير متطابق.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Save locally
      storage.saveTeacherPin(trimmed);
      setCurrentPin(trimmed);

      // 2. Sync to server
      try {
        await fetch('/api/teacher-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: trimmed,
            teacherId: currentTeacher.id,
          }),
        });
      } catch (err) {
        console.warn('Could not sync PIN to server, saved locally:', err);
      }

      setIsSaved(true);
      if (onSuccess) onSuccess(trimmed);

      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 1400);
    } catch {
      setErrorMsg('حدث خطأ أثناء حفظ كلمة المرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in dir-rtl font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-7 border border-slate-100 relative overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600" />

        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <KeyRound className="w-7 h-7" />
        </div>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200/80 rounded-full text-[11px] font-extrabold text-indigo-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>لوحة تحكم المشرف: {currentTeacher.name}</span>
          </div>
          <h3 className="text-lg font-black text-slate-900">تعديل كلمة مرور لوحة التحكم</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            هذه الكلمة تحمي لوحة التحكم وتمنع أي طالب من الدخول إليها نهائياً.
          </p>
        </div>

        {!isOwner ? (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="text-xs font-bold">صلاحية محددة</p>
            <p className="text-[11px] text-amber-800">
              تعديل كلمة المرور متاح حصرياً عبر لوحة تحكم المشرف العام (مستر أحمد بدوي). يرجى التبديل لحساب مستر أحمد بدوي للتعديل.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 px-4 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-900"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current PIN Info */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>كلمة المرور الحالية:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-indigo-700 text-sm tracking-wider bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                  {showCurrentPin ? currentPin : '••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCurrentPin(!showCurrentPin)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  title={showCurrentPin ? 'إخفاء' : 'إظهار'}
                >
                  {showCurrentPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New PIN Input */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                كلمة المرور الجديدة (Teacher PIN):
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showNewPin ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="أدخل كلمة المرور الجديدة (مثال: 123654)"
                  className="w-full pr-10 pl-10 py-2.5 text-center text-base font-mono font-bold tracking-widest border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Suggestions for Convenience */}
            <div className="flex items-center gap-1.5 justify-center flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-bold">اقتراحات سريعة:</span>
              <button
                type="button"
                onClick={() => setNewPin('123654')}
                className="text-[11px] font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                123654
              </button>
              <button
                type="button"
                onClick={() => setNewPin('987654')}
                className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                987654
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 animate-in shake">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isSaved && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-black rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 animate-in zoom-in-95">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>تم تحديث كلمة المرور بنجاح وحفظها!</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={!newPin.trim() || isSubmitting}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>جاري الحفظ...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>حفظ كلمة المرور الجديدة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
