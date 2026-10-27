import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, Check, X, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { storage } from '../utils/storage';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  onStudentRedirect?: () => void;
  title?: string;
  description?: string;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onStudentRedirect,
  title = 'بوابة المعلمين المشرفين',
  description = 'منطقة مخصصة للمعلمين فقط. يرجى إدخال رمز المرور السري للمتابعة.',
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = storage.getTeacherPin();
    if (pinInput.trim() === correctPin.trim()) {
      storage.setTeacherAuthenticated(true);
      setErrorMsg(null);
      setPinInput('');
      onSuccess();
    } else {
      setErrorMsg('رمز المرور غير صحيح! يرجى التأكد وإعادة المحاولة.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in dir-rtl font-sans">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 sm:p-7 border border-slate-100 text-center relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600" />

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-black text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-5">{description}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type={showPin ? 'text' : 'password'}
              required
              autoFocus
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="أدخل رمز المرور السري..."
              className="w-full pr-10 pl-10 py-3 text-center text-base font-mono font-bold tracking-widest border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 text-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 animate-in shake">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={!pinInput.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>تحقق ودخول لوحة التحكم</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                العودة لبوابة الطلاب
              </button>
            )}

            {onStudentRedirect && (
              <button
                type="button"
                onClick={onStudentRedirect}
                className="w-full py-2 px-3 text-indigo-600 hover:text-indigo-800 text-xs font-bold rounded-xl transition-colors cursor-pointer mt-1"
              >
                هل أنت طالب؟ اضغط هنا للانتقال لبوابة الحضور
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
