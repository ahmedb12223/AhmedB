import React, { useState } from 'react';
import {
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Layers,
  School,
  Users,
  Video,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Database,
  ArrowLeftRight,
  KeyRound,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { SchoolClass, Student, ClassSession, TeacherProfile } from '../types/index.ts';

interface MasterSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  teachers: TeacherProfile[];
  currentTeacherId: string;
  onExecuteSync: (
    options: {
      syncClasses: boolean;
      syncStudents: boolean;
      syncSessions: boolean;
      syncTeachers: boolean;
    },
    adminPassword?: string
  ) => Promise<{
    success: boolean;
    structuralUpdateAccepted?: boolean;
    warning?: string;
    syncedCounts: {
      classes: number;
      students: number;
      sessions: number;
      teachers: number;
    };
  }>;
}

export const MasterSyncModal: React.FC<MasterSyncModalProps> = ({
  isOpen,
  onClose,
  classes,
  students,
  sessions,
  teachers,
  onExecuteSync,
}) => {
  const [syncMode, setSyncMode] = useState<'full' | 'selective'>('full');
  const [syncClasses, setSyncClasses] = useState(true);
  const [syncStudents, setSyncStudents] = useState(true);
  const [syncSessions, setSyncSessions] = useState(true);
  const [syncTeachers, setSyncTeachers] = useState(true);

  // Security Admin Password State
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    structuralUpdateAccepted?: boolean;
    warning?: string;
    counts?: { classes: number; students: number; sessions: number; teachers: number };
    timestamp?: string;
  } | null>(null);

  const englishStudentsCount = students.filter((s) => s.track === 'english').length;
  const arabicStudentsCount = students.filter((s) => s.track === 'arabic').length;

  if (!isOpen) return null;

  const handleStartSync = async () => {
    const opts =
      syncMode === 'full'
        ? { syncClasses: true, syncStudents: true, syncSessions: true, syncTeachers: true }
        : { syncClasses, syncStudents, syncSessions, syncTeachers };

    const touchesStructuralData = opts.syncClasses || opts.syncStudents || opts.syncTeachers;

    if (touchesStructuralData && !adminPassword.trim()) {
      setPasswordError('يرجى إدخال كلمة مرور المعلم المشرف (مستر أحمد بدوي) لتأكيد مزامنة بيانات الفصول والطلاب.');
      return;
    }

    setPasswordError(null);
    setIsSyncing(true);
    setProgress(15);
    setSyncResult(null);
    setLogs(['[1/4] جاري التحقق من التوقيع الأمني والاتصال بالسيرفر السحابي...']);

    try {
      setTimeout(() => {
        setProgress(40);
        const studentLogDetails = opts.syncStudents
          ? `[2/4] تفاصيل كشوف الطلاب: تأكيد ${students.length} طالب (${englishStudentsCount} بمسار اللغات + ${arabicStudentsCount} بالمسار العربي)...`
          : '[2/4] جاري تجهيز حزم البيانات المحددة...';
        setLogs((prev) => [...prev, studentLogDetails]);
      }, 300);

      setTimeout(() => {
        setProgress(75);
        setLogs((prev) => [
          ...prev,
          `[3/4] إرسال طلب المزامنة الموثق بكلمة المرور للسيرفر السحابي...`
        ]);
      }, 700);

      const res = await onExecuteSync(opts, adminPassword.trim());

      setTimeout(() => {
        setProgress(100);
        setIsSyncing(false);
        if (res.success) {
          if (touchesStructuralData && res.structuralUpdateAccepted === false) {
            setLogs((prev) => [
              ...prev,
              '⚠️ تنبيه أمني: كلمة المرور المدخلة غير صحيحة! رفض السيرفر تعديل بيانات الفصول والطلاب لحمايتها من التغيير.'
            ]);
            setSyncResult({
              success: false,
              warning: 'كلمة المرور غير صحيحة. تم رفض تعديل الفصول والطلاب على السيرفر لحماية الأقسام.',
              counts: res.syncedCounts,
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });
          } else {
            setLogs((prev) => [
              ...prev,
              `[4/4] اكتملت المزامنة بنجاح 100%! تم اعتماد وتثبيت بيانات السحابة: ${students.length} طالب (${englishStudentsCount} لغات + ${arabicStudentsCount} عربي).`
            ]);
            setSyncResult({
              success: true,
              structuralUpdateAccepted: res.structuralUpdateAccepted,
              counts: res.syncedCounts,
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });
          }
        } else {
          setLogs((prev) => [...prev, '❌ فشلت المزامنة. يرجى التأكد من الاتصال بالإنترنت ومحاولة المزامنة مجدداً.']);
          setSyncResult({ success: false });
        }
      }, 1200);
    } catch {
      setIsSyncing(false);
      setProgress(0);
      setSyncResult({ success: false });
      setLogs((prev) => [...prev, '❌ حدث خطأ غير متوقع أثناء الاتصال بالخادم.']);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in dir-rtl font-sans">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black leading-tight">
                  مركز المزامنة المتقدم والتحكم السحابي
                </h3>
                <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                  خاص بمستر أحمد بدوي
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                مزامنة فورية ودقيقة للفصول والطلاب والحصص مع العرض المباشر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 grow">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setSyncMode('full')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                syncMode === 'full'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>مزامنة شاملة لكل البيانات (دفعة واحدة)</span>
            </button>

            <button
              type="button"
              onClick={() => setSyncMode('selective')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                syncMode === 'selective'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-violet-600" />
              <span>اختيار عناصر محددة للمزامنة</span>
            </button>
          </div>

          {/* Current Live Snapshot Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>معاينة البيانات الحالية الجاهزة للمزامنة:</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">تحديث مباشر</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Classes */}
              <label
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  syncMode === 'selective' ? 'cursor-pointer' : ''
                } ${
                  syncMode === 'selective' && syncClasses
                    ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <School className="w-4 h-4 text-emerald-600" />
                  {syncMode === 'selective' && (
                    <input
                      type="checkbox"
                      checked={syncClasses}
                      onChange={(e) => setSyncClasses(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  )}
                </div>
                <div>
                  <span className="text-xl font-black font-mono text-slate-900">{classes.length}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">فصل دراسي</span>
                </div>
              </label>

              {/* Students */}
              <label
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  syncMode === 'selective' ? 'cursor-pointer' : ''
                } ${
                  syncMode === 'selective' && syncStudents
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Users className="w-4 h-4 text-blue-600" />
                  {syncMode === 'selective' && (
                    <input
                      type="checkbox"
                      checked={syncStudents}
                      onChange={(e) => setSyncStudents(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                  )}
                </div>
                <div>
                  <span className="text-xl font-black font-mono text-slate-900">{students.length}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">
                    طالب ({englishStudentsCount} لغات · {arabicStudentsCount} عربي)
                  </span>
                </div>
              </label>

              {/* Sessions */}
              <label
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  syncMode === 'selective' ? 'cursor-pointer' : ''
                } ${
                  syncMode === 'selective' && syncSessions
                    ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Video className="w-4 h-4 text-purple-600" />
                  {syncMode === 'selective' && (
                    <input
                      type="checkbox"
                      checked={syncSessions}
                      onChange={(e) => setSyncSessions(e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  )}
                </div>
                <div>
                  <span className="text-xl font-black font-mono text-slate-900">{sessions.length}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">حصة دراسية</span>
                </div>
              </label>

              {/* Teachers */}
              <label
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  syncMode === 'selective' ? 'cursor-pointer' : ''
                } ${
                  syncMode === 'selective' && syncTeachers
                    ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                  {syncMode === 'selective' && (
                    <input
                      type="checkbox"
                      checked={syncTeachers}
                      onChange={(e) => setSyncTeachers(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                    />
                  )}
                </div>
                <div>
                  <span className="text-xl font-black font-mono text-slate-900">{teachers.length}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">معلم بالنظام</span>
                </div>
              </label>
            </div>
          </div>

          {/* Master Admin Security PIN Section */}
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-700" />
                <span>كلمة مرور المزامنة والتحكم السحابي (Admin PIN)</span>
                <span className="text-red-500 font-black">*</span>
              </label>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                حماية السحابة
              </span>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                disabled={isSyncing}
                placeholder="أدخل كلمة مرور مستر أحمد بدوي (الافتراضية: 123654)"
                className="w-full bg-white border border-amber-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl py-2.5 px-3.5 pl-10 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passwordError && (
              <p className="text-[11px] font-bold text-red-600 flex items-center gap-1.5 bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}

            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              🔒 لحماية تقسيم الطلاب (عربي ولغات) ومنع أي تعديل غير مصرح به على السيرفر، يتجاهل النظام أي طلب تعديل للفصول أو الطلاب ما لم يتم إدخال وتوثيق كلمة المرور الخاصة بك.
            </p>
          </div>

          {/* Syncing Progress & Live Logs */}
          {(isSyncing || logs.length > 0) && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-amber-400 flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>حالة عملية المزامنة السحابية</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{progress}%</span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Log Lines */}
              <div className="space-y-1 max-h-32 overflow-y-auto text-[11px] leading-relaxed text-slate-300 pr-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-1.5">
                    <span className="text-indigo-400 select-none">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Banner Feedback */}
          {syncResult && syncResult.success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200/90 text-emerald-950 rounded-2xl text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-black text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>تمت المزامنة المباشرة بنجاح 100%! 🎉</span>
              </div>

              {syncResult.counts && (
                <div className="flex items-center gap-2.5 text-[11px] font-semibold text-emerald-900 flex-wrap pt-2 border-t border-emerald-200/60">
                  <span className="font-bold">تمت مزامنة السيرفر:</span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    {syncResult.counts.classes} فصل
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200 font-bold text-indigo-900">
                    {syncResult.counts.students} طالب ({englishStudentsCount} لغات · {arabicStudentsCount} عربي)
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    {syncResult.counts.sessions} حصة
                  </span>
                  <span className="text-slate-500 mr-auto text-[10px]">
                    توقيت المزامنة: {syncResult.timestamp}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>

          <button
            type="button"
            onClick={handleStartSync}
            disabled={
              isSyncing ||
              (syncMode === 'selective' &&
                !syncClasses &&
                !syncStudents &&
                !syncSessions &&
                !syncTeachers)
            }
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 hover:from-indigo-800 hover:to-violet-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'جاري المزامنة مع السيرفر...'
                : syncMode === 'full'
                ? 'مزامنة كل شيء دفعة واحدة الآن'
                : 'مزامنة العناصر المحددة'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
