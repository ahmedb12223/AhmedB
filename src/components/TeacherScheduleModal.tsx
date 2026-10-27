import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  School,
  Save,
  BookOpen
} from 'lucide-react';
import { SchedulePeriod, SchoolClass, TeacherProfile, DayOfWeek, LanguageTrack } from '../types';
import { parseScheduleWithAI, saveTeacherSchedule, generateDailySessions } from '../utils/apiSync';
import { AHMED_BADAWI_OFFICIAL_SCHEDULE } from '../utils/storage';

interface TeacherScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherProfile;
  classes: SchoolClass[];
  onScheduleSaved: (updatedTeacher: TeacherProfile, newSessionsCount: number) => void;
  onDailySessionsGenerated: (count: number) => void;
}

const DAYS_ARABIC: { key: DayOfWeek; name: string }[] = [
  { key: 'sunday', name: 'الأحد' },
  { key: 'monday', name: 'الإثنين' },
  { key: 'tuesday', name: 'الثلاثاء' },
  { key: 'wednesday', name: 'الأربعاء' },
  { key: 'thursday', name: 'الخميس' },
  { key: 'friday', name: 'الجمعة' },
  { key: 'saturday', name: 'السبت' },
];

export const TeacherScheduleModal: React.FC<TeacherScheduleModalProps> = ({
  isOpen,
  onClose,
  teacher,
  classes,
  onScheduleSaved,
  onDailySessionsGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'table'>('upload');
  const [schedule, setSchedule] = useState<SchedulePeriod[]>(() => teacher.weeklySchedule || []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [filterDay, setFilterDay] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      setSchedule(teacher.weeklySchedule || []);
    }
  }, [teacher.id, isOpen]);

  const persistModalSchedule = (nextSchedule: SchedulePeriod[]) => {
    setSchedule(nextSchedule);
    const updatedTeacher: TeacherProfile = {
      ...teacher,
      weeklySchedule: nextSchedule,
    };
    onScheduleSaved(updatedTeacher, 0);
    saveTeacherSchedule(teacher.id, nextSchedule).catch(() => {});
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleAnalyzeSchedule = async () => {
    if (!selectedFile && !pasteText.trim()) {
      setErrorMsg('يرجى اختيار صورة، ملف PDF/TXT، أو كتابة نص الجدول لتحليله');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let textContent: string = pasteText.trim();

      if (selectedFile) {
        mimeType = selectedFile.type || 'application/octet-stream';

        if (selectedFile.type.startsWith('image/')) {
          imageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        } else if (selectedFile.type === 'text/plain') {
          const fileText = await selectedFile.text();
          textContent = `${fileText}\n${textContent}`.trim();
        } else if (selectedFile.type === 'application/pdf') {
          // Send PDF as base64 document
          imageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        } else {
          // General fallback: read as base64
          imageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        }
      }

      const res = await parseScheduleWithAI({
        imageBase64,
        mimeType,
        textContent: textContent || undefined,
      });

      if (res.success && Array.isArray(res.periods) && res.periods.length > 0) {
        setSchedule(res.periods);
        setActiveTab('table');
        setSuccessMsg(`نجح الذكاء الاصطناعي في استخراج ${res.periods.length} حصة مجدولة! راجع الجدول أدناه وقم بتثبيته.`);
      } else {
        setErrorMsg(res.error || 'لم يتم العثور على حصص واضحة في الملف. حاول إرفاق صورة أوضح أو لصق النص.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تحليل الجدول');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddPeriodRow = () => {
    const newPeriod: SchedulePeriod = {
      id: `period_${Date.now()}`,
      dayOfWeek: 'sunday',
      dayNameArabic: 'الأحد',
      className: classes[0]?.name || 'Grade 4 - A',
      classId: classes[0]?.id,
      startTime: '09:00',
      endTime: '09:45',
      subject: teacher.subject || 'علوم ولغات',
      targetTrack: 'all',
      zoomUrl: classes[0]?.zoomUrl || teacher.defaultZoomLink || '',
    };
    persistModalSchedule([...schedule, newPeriod]);
  };

  const handleUpdatePeriod = (id: string, updates: Partial<SchedulePeriod>) => {
    const next = schedule.map((p) => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      if (updates.dayOfWeek) {
        const match = DAYS_ARABIC.find((d) => d.key === updates.dayOfWeek);
        if (match) updated.dayNameArabic = match.name;
      }
      if (updates.classId !== undefined) {
        const cls = classes.find((c) => c.id === updates.classId);
        if (cls) {
          updated.className = cls.name;
          if (!updated.zoomUrl) updated.zoomUrl = cls.zoomUrl || '';
        }
      }
      return updated;
    });
    persistModalSchedule(next);
  };

  const handleDeletePeriod = (id: string) => {
    const next = schedule.filter((p) => p.id !== id);
    persistModalSchedule(next);
  };

  const handleSaveSchedule = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await saveTeacherSchedule(teacher.id, schedule);
      if (res.success) {
        const updatedTeacher: TeacherProfile = {
          ...teacher,
          weeklySchedule: schedule,
        };
        onScheduleSaved(updatedTeacher, res.newSessionsCount || 0);
        setSuccessMsg(
          `تم تثبيت الجدول الأسبوعي بنجاح (${schedule.length} حصة). سيتم إنشاء الحصص يومياً تلقائياً!`
        );
      } else {
        setErrorMsg(res.error || 'فشل حفظ الجدول في الخادم');
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    }
  };

  const handleTriggerDailyNow = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await generateDailySessions();
      if (res.success) {
        onDailySessionsGenerated(res.count);
        setSuccessMsg(
          res.count > 0
            ? `تم توليد ${res.count} حصة لهذا اليوم بنجاح وربطها بالتذكيرات التلقائية!`
            : 'تم فحص الجدول: جميع حصص اليوم الحالي موجودة مسبقاً.'
        );
      }
    } catch {
      setErrorMsg('تعذر توليد الحصص');
    }
  };

  const displayedPeriods = filterDay === 'all'
    ? schedule
    : schedule.filter((p) => p.dayOfWeek === filterDay);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  الجدول الأسبوعي واستخراج المواعيد بالذكاء الاصطناعي
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Gemini 3.8 Flash</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ارفق جدولك كصورة أو PDF، ليتم التعرف على مواعيد حصصك وتثبيتها وتوليدها يومياً بصفة تلقائية
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

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. رفع الجدول أو النص</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>2. مراجعة وتثبيت الجدول ({schedule.length} حصة)</span>
            </button>
          </div>

          {schedule.length > 0 && (
            <button
              onClick={handleTriggerDailyNow}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="توليد حصص اليوم تلقائياً فوراً استناداً لليوم الحالي"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              <span>توليد حصص اليوم تلقائياً</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Upload & Input */}
        {activeTab === 'upload' && (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* File Dropzone */}
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-6 sm:p-8 text-center transition-all bg-slate-50/50 hover:bg-indigo-50/30">
              <input
                type="file"
                id="schedule-file-input"
                accept="image/*,.pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="schedule-file-input"
                className="flex flex-col items-center justify-center cursor-pointer space-y-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    اضغط هنا لاختيار صورة الجدول المدرسي أو ملف PDF أو TXT
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات JPG, PNG, WebP, PDF، والمستندات النصية
                  </p>
                </div>
                {selectedFile && (
                  <div className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>تم اختيار: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </label>

              {filePreview && (
                <div className="mt-4 max-h-48 overflow-hidden rounded-xl border border-slate-200 inline-block shadow-sm">
                  <img src={filePreview} alt="Schedule preview" className="max-h-48 object-contain" />
                </div>
              )}
            </div>

            {/* Direct Text Paste Option */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-700">
                  أو الصق نص الجدول هنا مباشرة (اختياري):
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSchedule(AHMED_BADAWI_OFFICIAL_SCHEDULE);
                      setActiveTab('table');
                      setSuccessMsg(`⚡ تم إدراج جدول مستر أحمد بدوي كاملاً بنجاح (30 حصة أسبوعية مطابقة بالكامل للمواعيد والفصول والمسارات)!`);
                    }}
                    className="text-[11px] text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-lg font-black transition-colors cursor-pointer border border-emerald-300 shadow-xs flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>⚡ تفعيل جدول مستر أحمد بدوي المعتمد (30 حصة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const sample = `الأحد:\n- 08:30 الصف الرابع لغات - Math\n- 10:00 الصف الخامس لغات - Science\n\nالإثنين:\n- 09:15 الصف الرابع لغات - Science\n- 11:00 الصف السادس لغات - Math`;
                      setPasteText(sample);
                      setSelectedFile(null);
                      setFilePreview(null);
                      setIsAnalyzing(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      const res = await parseScheduleWithAI({ textContent: sample });
                      setIsAnalyzing(false);
                      if (res.success && Array.isArray(res.periods) && res.periods.length > 0) {
                        setSchedule(res.periods);
                        setActiveTab('table');
                        setSuccessMsg(`✅ تم استخراج وتعبئة النموذج التجريبي بنجاح (${res.periods.length} حصص)!`);
                      }
                    }}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer border border-indigo-200"
                  >
                    ✨ إدخال نموذج تجريبي
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`مثال:\nالأحد:\n- 08:30 الصف الرابع لغات - Math\n- 10:00 الصف الخامس لغات - Science`}
                className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Analyze CTA */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleAnalyzeSchedule}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? 'جارٍ تحليل الجدول بالذكاء الاصطناعي...' : 'تحليل واستخراج الجدول الآن'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Interactive Table for Review and Fixing */}
        {activeTab === 'table' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Filter by Day and Add Period */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setFilterDay('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    filterDay === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل ({schedule.length})
                </button>
                {DAYS_ARABIC.map((d) => {
                  const count = schedule.filter((p) => p.dayOfWeek === d.key).length;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setFilterDay(d.key)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        filterDay === d.key
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{d.name}</span>
                      {count > 0 && <span className="opacity-70 mr-1">({count})</span>}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleAddPeriodRow}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة حصة يدوياً</span>
              </button>
            </div>

            {/* Editable Periods List */}
            {displayedPeriods.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                لا توجد حصص مجدولة لهذا اليوم. اضغط "إضافة حصة يدوياً" أو ارفع صورة الجدول في التبويب السابق.
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedPeriods.map((period) => (
                  <div
                    key={period.id}
                    className="p-3 sm:p-4 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-1">
                      {/* Day Select */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">اليوم</label>
                        <select
                          value={period.dayOfWeek}
                          onChange={(e) => handleUpdatePeriod(period.id, { dayOfWeek: e.target.value as DayOfWeek })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                        >
                          {DAYS_ARABIC.map((d) => (
                            <option key={d.key} value={d.key}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Class Match */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الفصل الدراسي</label>
                        <select
                          value={period.classId || ''}
                          onChange={(e) => handleUpdatePeriod(period.id, { classId: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                        >
                          <option value="">{period.className || '-- اختر الفصل --'}</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.gradeLevel})</option>
                          ))}
                        </select>
                      </div>

                      {/* Start Time */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">وقت البدء (24h)</label>
                        <input
                          type="time"
                          value={period.startTime}
                          onChange={(e) => handleUpdatePeriod(period.id, { startTime: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-center"
                        />
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">المادة / العنوان</label>
                        <input
                          type="text"
                          value={period.subject || ''}
                          onChange={(e) => handleUpdatePeriod(period.id, { subject: e.target.value })}
                          placeholder="مثال: Science"
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                        />
                      </div>

                      {/* Track */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">المسار</label>
                        <select
                          value={period.targetTrack || 'all'}
                          onChange={(e) => handleUpdatePeriod(period.id, { targetTrack: e.target.value as LanguageTrack })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                        >
                          <option value="all">عام للجميع</option>
                          <option value="english">لغات (English)</option>
                          <option value="arabic">عربي (Arabic)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                      <button
                        onClick={() => handleDeletePeriod(period.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف هذه الحصة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {schedule.length > 0
              ? `إجمالي الحصص المحددة: ${schedule.length} حصة أسبوعياً`
              : 'قم برفع الجدول أو إضافة حصص لتثبيته'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSaveSchedule}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" />
              <span>تثبيت واعتماد الجدول الأسبوعي</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
