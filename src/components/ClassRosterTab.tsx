import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Sparkles,
  Search,
  Check,
  X,
  AlertCircle,
  Video,
  ChevronDown,
  ChevronUp,
  School,
  ExternalLink,
  BookOpen,
  Globe
} from 'lucide-react';
import { SchoolClass, Student, TeacherProfile, WhatsAppGroupConfig } from '../types/index.ts';
import { normalizeClassKey, parseHierarchicalText, mergeDuplicateClasses } from '../utils/excelParser';
import { EditClassModal } from './EditClassModal';
import { EditStudentModal } from './EditStudentModal';
import { ConfirmModal } from './ConfirmModal';
import { ensureAbsoluteUrl } from '../utils/urlHelper';

interface ClassRosterTabProps {
  currentTeacher: TeacherProfile;
  classes: SchoolClass[];
  students: Student[];
  onAddClass: (name: string, gradeLevel: string, zoomUrl?: string) => void;
  onUpdateClass: (
    id: string,
    name: string,
    gradeLevel: string,
    zoomUrl?: string,
    whatsappRecipient?: string,
    whatsappRecipientType?: 'phone' | 'group',
    whatsappGroups?: WhatsAppGroupConfig[]
  ) => void;
  onDeleteClass: (id: string) => void;
  onSaveFullRoster: (newClasses: SchoolClass[], newStudents: Student[]) => void;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent?: (updatedStudent: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBatchUpdateStudents?: (studentIds: string[], updates: { track?: 'english' | 'arabic'; classId?: string }) => void;
  onBatchDeleteStudents?: (studentIds: string[]) => void;
  onMergeDuplicateClasses?: () => Promise<number>;
}

export const ClassRosterTab: React.FC<ClassRosterTabProps> = ({
  currentTeacher,
  classes,
  students,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onSaveFullRoster,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBatchUpdateStudents,
  onBatchDeleteStudents,
  onMergeDuplicateClasses,
}) => {
  // Selected class in tab
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');

  // Batch students selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showMoveClassModal, setShowMoveClassModal] = useState(false);
  const [targetClassForBatchMove, setTargetClassForBatchMove] = useState<string>('');
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Sync selectedClassId if current class was deleted
  React.useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Clear batch selection on class switch
  React.useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [selectedClassId]);

  // Text Roster input section
  const [isRosterBoxOpen, setIsRosterBoxOpen] = useState(false);
  const [rosterText, setRosterText] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [rosterErrorMsg, setRosterErrorMsg] = useState<string | null>(null);

  // Auto-merge duplicate classes state
  const [isMerging, setIsMerging] = useState(false);
  const [mergeNotification, setMergeNotification] = useState<string | null>(null);

  const handleAutoMergeClick = async () => {
    if (!onMergeDuplicateClasses) return;
    setIsMerging(true);
    setMergeNotification(null);
    try {
      const mergedCount = await onMergeDuplicateClasses();
      if (mergedCount > 0) {
        setMergeNotification(`تم دمج وتوحيد ${mergedCount} فصل مكرر بنجاح مع الحفاظ على مسارات الطلاب! 🎉`);
      } else {
        setMergeNotification('جميع الفصول موحدة بالفعل ولا توجد أي فصول مكررة! ✨');
      }
    } catch {
      setMergeNotification('حدث خطأ أثناء محاولة دمج الفصول المكررة.');
    } finally {
      setIsMerging(false);
      setTimeout(() => {
        setMergeNotification(null);
      }, 5000);
    }
  };

  // Add Class Modal / Form
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Grade 4 (الصف الرابع)');
  const [newClassZoom, setNewClassZoom] = useState(currentTeacher.defaultZoomLink || '');

  // Edit Class & Student Modals
  const [classToEdit, setClassToEdit] = useState<SchoolClass | null>(null);
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  const handleToggleTrack = (st: Student) => {
    if (onUpdateStudent) {
      onUpdateStudent({
        ...st,
        track: st.track === 'english' ? 'arabic' : 'english',
      });
    }
  };

  // Batch Actions
  const handleBatchMoveToArabic = () => {
    if (selectedStudentIds.size === 0) return;
    const ids = Array.from(selectedStudentIds);
    if (onBatchUpdateStudents) {
      onBatchUpdateStudents(ids, { track: 'arabic' });
    } else {
      ids.forEach((id) => {
        const target = students.find((s) => s.id === id);
        if (target && onUpdateStudent) onUpdateStudent({ ...target, track: 'arabic' });
      });
    }
    setSelectedStudentIds(new Set());
  };

  const handleBatchMoveToEnglish = () => {
    if (selectedStudentIds.size === 0) return;
    const ids = Array.from(selectedStudentIds);
    if (onBatchUpdateStudents) {
      onBatchUpdateStudents(ids, { track: 'english' });
    } else {
      ids.forEach((id) => {
        const target = students.find((s) => s.id === id);
        if (target && onUpdateStudent) onUpdateStudent({ ...target, track: 'english' });
      });
    }
    setSelectedStudentIds(new Set());
  };

  const handleBatchMoveToClassConfirm = () => {
    if (!targetClassForBatchMove || selectedStudentIds.size === 0) return;
    const ids = Array.from(selectedStudentIds);
    if (onBatchUpdateStudents) {
      onBatchUpdateStudents(ids, { classId: targetClassForBatchMove });
    } else {
      ids.forEach((id) => {
        const target = students.find((s) => s.id === id);
        if (target && onUpdateStudent) onUpdateStudent({ ...target, classId: targetClassForBatchMove });
      });
    }
    setSelectedStudentIds(new Set());
    setShowMoveClassModal(false);
    setTargetClassForBatchMove('');
  };

  const handleBatchDeleteConfirmAction = () => {
    if (selectedStudentIds.size === 0) return;
    const ids = Array.from(selectedStudentIds);
    if (onBatchDeleteStudents) {
      onBatchDeleteStudents(ids);
    } else {
      ids.forEach((id) => onDeleteStudent(id));
    }
    setSelectedStudentIds(new Set());
    setShowBatchDeleteConfirm(false);
  };

  // Student Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState<'all' | 'english' | 'arabic'>('all');

  // Manual Add Student Inline Form
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentTrack, setStudentTrack] = useState<'english' | 'arabic'>('english');
  const [studentCode, setStudentCode] = useState('');

  // Active Class
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const classStudents = students.filter((s) => s.classId === currentClass?.id);

  // Filtered Students
  const filteredStudents = classStudents.filter((s) => {
    const matchesTrack = trackFilter === 'all' || s.track === trackFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentCode && s.studentCode.includes(searchQuery));
    return matchesTrack && matchesSearch;
  });

  const englishCount = classStudents.filter((s) => s.track === 'english').length;
  const arabicCount = classStudents.filter((s) => s.track === 'arabic').length;

  // Sample Text Roster with clean track grouping
  const handleApplySample = () => {
    const sample = `GR4 A
[مسار اللغات]
احمد عبدالله حليمه
احمد حسام الدين عبد المعز عبد
اياد احمد محمد علم الدين
عمر طارق فاروق

[المسار العربي]
مريم كريم حسن
يوسف محمد صبحي شحاته

GR4 B
[مسار اللغات]
سيف الدين احمد محمد محمود ابراهيم
حمزة شريف الشناوي

[المسار العربي]
فاطمة إبراهيم الشناوي`;
    setRosterText(sample);
  };

  // Process and save text roster safely without creating duplicate classes
  const handleProcessRoster = () => {
    if (!rosterText.trim()) return;

    const parsed = parseHierarchicalText(rosterText);
    if (parsed.rows.length === 0) {
      setRosterErrorMsg('لم يتم العثور على أي أسماء طلاب. تأكد من كتابة اسم الفصل ثم أسماء الطلاب تحته.');
      return;
    }
    setRosterErrorMsg(null);

    // Build or match classes using flexible normalization
    const matchedClassList: SchoolClass[] = [];
    const classKeyMap = new Map<string, SchoolClass>();

    classes.forEach((c) => {
      classKeyMap.set(normalizeClassKey(c.name), c);
    });

    parsed.detectedClasses.forEach((className) => {
      const key = normalizeClassKey(className);
      const existing = classKeyMap.get(key);
      if (existing) {
        matchedClassList.push(existing);
      } else {
        const createdClass: SchoolClass = {
          id: `class_${className.toLowerCase().replace(/[^a-z0-9]/g, '_') || Date.now()}`,
          name: className,
          gradeLevel: 'المرحلة الدراسية',
          zoomUrl: currentTeacher.defaultZoomLink || '',
          createdAt: new Date().toISOString(),
        };
        classKeyMap.set(key, createdClass);
        matchedClassList.push(createdClass);
      }
    });

    // Preserve any existing classes not mentioned in the parsed text
    const updatedClasses = [...matchedClassList];
    classes.forEach((existingClass) => {
      const existingKey = normalizeClassKey(existingClass.name);
      if (!matchedClassList.some((c) => normalizeClassKey(c.name) === existingKey)) {
        updatedClasses.push(existingClass);
      }
    });

    // Build new students
    const newParsedStudents: Student[] = parsed.rows.map((row, i) => {
      const targetClassKey = normalizeClassKey(row.className);
      const cls = updatedClasses.find((c) => normalizeClassKey(c.name) === targetClassKey);
      return {
        id: `st_${Date.now()}_${i}`,
        name: row.name,
        classId: cls ? cls.id : updatedClasses[0]?.id || 'class_default',
        track: row.track,
        studentCode: row.studentCode,
      };
    });

    // Keep students from other classes not edited in this text
    const editedClassKeys = new Set(parsed.detectedClasses.map(normalizeClassKey));
    const retainedStudents = students.filter((s) => {
      const studentClass = classes.find((c) => c.id === s.classId);
      if (!studentClass) return false;
      return !editedClassKeys.has(normalizeClassKey(studentClass.name));
    });

    const finalStudents = [...newParsedStudents, ...retainedStudents];

    // Ensure all classes and tracks are canonical and deduplicated
    const mergeRes = mergeDuplicateClasses(updatedClasses, finalStudents, []);

    onSaveFullRoster(mergeRes.classes, mergeRes.students);
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      setIsRosterBoxOpen(false);
    }, 1200);
  };

  // Create new class submit
  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const safeZoom = newClassZoom.trim() ? ensureAbsoluteUrl(newClassZoom.trim()) : undefined;
    onAddClass(newClassName.trim(), newClassGrade.trim(), safeZoom);
    setNewClassName('');
    setShowAddClassModal(false);
  };

  // Add single student submit
  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !currentClass) return;

    onAddStudent({
      name: studentName.trim(),
      classId: currentClass.id,
      track: studentTrack,
      studentCode: studentCode.trim() || undefined,
    });

    setStudentName('');
    setStudentCode('');
    setShowAddStudentForm(false);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* Top Banner: Classes Overview & Quick Actions                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span className="text-xs font-bold text-indigo-700">إدارة الفصول وقوائم الطلاب</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              كشوف الفصول والطلاب الرسمية
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يمكنك ربط الفصول بأسماء الطلاب عبر لصق الكشف النصي، وتعديل أو حذف أي فصل بسهولة.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onMergeDuplicateClasses && (
              <button
                type="button"
                onClick={handleAutoMergeClick}
                disabled={isMerging}
                className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="دمج أي فصول مكررة (مثل Grade 8 عربي ولغات) في فصل واحد موحد مع الحفاظ على مسار الطلاب"
              >
                <Sparkles className={`w-4 h-4 ${isMerging ? 'animate-spin' : ''}`} />
                <span>{isMerging ? 'جاري توحيد الفصول...' : 'دمج الفصول المكررة تلقائياً'}</span>
              </button>
            )}

            <button
              onClick={() => setIsRosterBoxOpen(!isRosterBoxOpen)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isRosterBoxOpen ? 'إغلاق لصق الكشف النصي' : 'لصق كشف نصي للفصول والطلاب'}</span>
              {isRosterBoxOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setShowAddClassModal(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فصل جديد</span>
            </button>
          </div>
        </div>

        {/* Merge Notification Feedback Banner */}
        {mergeNotification && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>{mergeNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setMergeNotification(null)}
              className="p-1 hover:bg-emerald-100/80 text-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-right">
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">إجمالي الفصول</span>
            <span className="text-2xl font-black font-mono text-slate-900">{classes.length}</span>
            <span className="text-[11px] text-slate-500 mr-1.5 font-medium">فصل مسجل</span>
          </div>

          <div className="bg-indigo-50/50 rounded-2xl p-3.5 border border-indigo-100 text-right">
            <span className="text-[11px] font-bold text-indigo-600 block mb-0.5">إجمالي الطلاب</span>
            <span className="text-2xl font-black font-mono text-indigo-950">{students.length}</span>
            <span className="text-[11px] text-indigo-700 mr-1.5 font-medium">طالب في الكشوف</span>
          </div>

          <div className="bg-blue-50/50 rounded-2xl p-3.5 border border-blue-100 text-right">
            <span className="text-[11px] font-bold text-blue-600 block mb-0.5">مسار اللغات</span>
            <span className="text-2xl font-black font-mono text-blue-950">
              {students.filter((s) => s.track === 'english').length}
            </span>
            <span className="text-[11px] text-blue-700 mr-1.5 font-medium">English Track</span>
          </div>

          <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100 text-right">
            <span className="text-[11px] font-bold text-amber-600 block mb-0.5">المسار العربي</span>
            <span className="text-2xl font-black font-mono text-amber-950">
              {students.filter((s) => s.track === 'arabic').length}
            </span>
            <span className="text-[11px] text-amber-700 mr-1.5 font-medium">Arabic Track</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Collapsible Area: Text Roster Pasting                          */}
      {/* ------------------------------------------------------------- */}
      {isRosterBoxOpen && (
        <div className="bg-white rounded-3xl border-2 border-emerald-500/30 p-5 sm:p-7 shadow-lg space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  رفع كشف الأسماء النصي التلقائي
                </h3>
                <p className="text-xs text-slate-500">
                  الصق النص مباشرة بالشكل: اسم الفصل في سطر (مثل GR4 - A) ثم أسماء الطلاب تحته
                </p>
              </div>
            </div>

            <button
              onClick={handleApplySample}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تعبئة كشف تجريبي سريع</span>
            </button>
          </div>

          <textarea
            rows={8}
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            placeholder={`GR4 - A\nاحمد عبدالله حليمه\nاحمد حسام الدين عبد المعز عبد\nاياد احمد محمد علم الدين\n\nGR4 - B\nيوسف محمد صبحي شحاته\nسيف الدين احمد محمد محمود ابراهيم`}
            className="w-full p-4 text-xs sm:text-sm font-mono leading-relaxed border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
          />

          {rosterErrorMsg && (
            <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">{rosterErrorMsg}</p>
            </div>
          )}

          <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <b>تلقائي وذكي:</b> سيقوم النظام بالتعرف على الفصول وتوليدها تلقائياً، وإضافة الطلاب تحت كل فصل في الكشف الرسمي.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setIsRosterBoxOpen(false)}
              className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>

            <button
              onClick={handleProcessRoster}
              className={`px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                saveSuccessMsg ? 'bg-emerald-600 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{saveSuccessMsg ? 'تم تحديث الفصول والطلاب بنجاح! ✅' : 'معالجة الكشف وتحديث الفصول والطلاب'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Classes Tabs Strip with Edit/Delete Buttons                    */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <School className="w-5 h-5 text-indigo-600" />
            <span>قائمة الفصول المعتمدة ({classes.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            اختر أي فصل لمعاينة طلابه وتعديله أو حذفه
          </span>
        </div>

        {/* Horizontal Side-by-Side Class Carousel Strip (تقليل التمرير الرأسي وعرض الفصول أفقياً) */}
        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2.5 pt-1 no-scrollbar -mx-1 px-1">
          {classes.map((cls) => {
            const isSelected = cls.id === (currentClass?.id || '');
            const count = students.filter((s) => s.classId === cls.id).length;

            return (
              <div
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`min-w-[190px] sm:min-w-[220px] max-w-[240px] shrink-0 p-3 sm:p-3.5 rounded-2xl border transition-all text-right cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span
                    className={`font-mono font-black text-xs px-2.5 py-1 rounded-xl truncate ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    فصل {cls.name}
                  </span>

                  {/* Actions: Edit & Delete Class */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassToEdit(cls);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="تعديل بيانات الفصل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassToDelete(cls);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف الفصل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold mb-1 truncate">
                    {cls.gradeLevel}
                  </div>
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>{count} طالب مسجل</span>
                    {cls.zoomUrl && (
                      <span className="text-[10px] text-blue-600 flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        <span>زوم مفعل</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Current Class Students Table View                             */}
      {/* ------------------------------------------------------------- */}
      {currentClass ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  كشف طلاب فصل {currentClass.name}
                </h4>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {classStudents.length} طالب
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                مسار اللغات: <b>{englishCount}</b> · المسار العربي: <b>{arabicCount}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddStudentForm(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة طالب يدوياً</span>
              </button>

              <button
                onClick={() => setClassToEdit(currentClass)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>تعديل الفصل</span>
              </button>
            </div>
          </div>

          {/* Add Student Inline Form */}
          {showAddStudentForm && (
            <form
              onSubmit={handleAddStudentSubmit}
              className="p-4 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center gap-3 text-xs"
            >
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="اسم الطالب بالكامل (ثلاثي أو رباعي)..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="w-36">
                <select
                  value={studentTrack}
                  onChange={(e) => setStudentTrack(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="english">مسار اللغات (English)</option>
                  <option value="arabic">المسار العربي (Arabic)</option>
                </select>
              </div>

              <div className="w-28">
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="كود الطالب"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStudentForm(false)}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar & Search */}
          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-1">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="select-all-students"
                  checked={filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
                    } else {
                      setSelectedStudentIds(new Set());
                    }
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="select-all-students" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  تحديد الكل
                </label>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الطالب في كشف الفصل..."
                  className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Track Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setTrackFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  trackFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({classStudents.length})
              </button>
              <button
                onClick={() => setTrackFilter('english')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  trackFilter === 'english' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مسار اللغات ({englishCount})
              </button>
              <button
                onClick={() => setTrackFilter('arabic')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  trackFilter === 'arabic' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المسار العربي ({arabicCount})
              </button>
            </div>
          </div>

          {/* Interactive Bulk Action Bar (when students are selected) */}
          {selectedStudentIds.size > 0 && (
            <div className="m-3 p-3 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-2.5 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-black">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-mono text-xs">
                  {selectedStudentIds.size}
                </span>
                <span>طالب محدد للإجراء الجماعي:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Batch Move to Arabic */}
                <button
                  type="button"
                  onClick={handleBatchMoveToArabic}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="نقل جميع الطلاب المحددين إلى المسار العربي فوراً"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>نقل للعربي ({selectedStudentIds.size})</span>
                </button>

                {/* Batch Move to English */}
                <button
                  type="button"
                  onClick={handleBatchMoveToEnglish}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="نقل جميع الطلاب المحددين إلى مسار اللغات فوراً"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>نقل للغات ({selectedStudentIds.size})</span>
                </button>

                {/* Move to another Class */}
                {classes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowMoveClassModal(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>نقل لفصل آخر</span>
                  </button>
                )}

                {/* Batch Delete */}
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف ({selectedStudentIds.size})</span>
                </button>

                {/* Clear Selection */}
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(new Set())}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {/* Students List */}
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((st, idx) => (
                <div
                  key={st.id}
                  className={`p-3.5 flex items-center justify-between text-xs transition-colors ${
                    selectedStudentIds.has(st.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.has(st.id)}
                      onChange={(e) => {
                        const next = new Set(selectedStudentIds);
                        if (e.target.checked) next.add(st.id);
                        else next.delete(st.id);
                        setSelectedStudentIds(next);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />

                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                        {st.name}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono block truncate">
                        {st.studentCode ? `كود: ${st.studentCode}` : `فصل ${currentClass.name}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 mr-1.5">
                    {/* Interactive Track Switcher Badge / Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleTrack(st)}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer border flex items-center gap-1 shadow-2xs shrink-0 ${
                        st.track === 'english'
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                      title="اضغط للنقل الفوري بين اللغات والعربي"
                    >
                      <span>{st.track === 'english' ? '🌐 لغات' : '📚 عربي'}</span>
                      <span className="text-[9px] opacity-70 underline hidden xs:inline">نقل</span>
                    </button>

                    {/* Edit Student Button */}
                    <button
                      type="button"
                      onClick={() => setStudentToEdit(st)}
                      className="p-1 sm:p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="تعديل بيانات الطالب"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Student Button */}
                    <button
                      type="button"
                      onClick={() => setStudentToDelete(st)}
                      className="p-1 sm:p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="حذف الطالب من الكشف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-xs text-slate-400">
                {searchQuery
                  ? 'لم يتم العثور على طالب يطابق البحث في هذا الفصل.'
                  : 'لا يوجد طلاب مسجلون في هذا الفصل حتى الآن. استخدم زر "لصق كشف نصي" بالأعلى لملء الكشف فوراً.'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200">
          <p className="text-sm font-bold text-slate-700 mb-2">لا توجد أي فصول مسجلة حالياً</p>
          <button
            onClick={() => setShowAddClassModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
          >
            إضافة أول فصل
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Add Class Modal                                               */}
      {/* ------------------------------------------------------------- */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900">إضافة فصل دراسي جديد</h3>
              <button
                onClick={() => setShowAddClassModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClassSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  اسم الفصل أو الشعبة (مثال: GR4 - C أو 7A):
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="مثال: GR4 - C"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-black border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  المرحلة الدراسية:
                </label>
                <input
                  type="text"
                  required
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  placeholder="مثال: الصف الرابع الابتدائي (Grade 4)"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  رابط زوم الافتراضي للفصل (اختياري):
                </label>
                <input
                  type="url"
                  value={newClassZoom}
                  onChange={(e) => setNewClassZoom(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dir-ltr text-left"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  حفظ الفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {classToEdit && (
        <EditClassModal
          isOpen={!!classToEdit}
          onClose={() => setClassToEdit(null)}
          schoolClass={classToEdit}
          onSave={(updated) => {
            onUpdateClass(
              updated.id,
              updated.name,
              updated.gradeLevel,
              updated.zoomUrl,
              updated.whatsappRecipient,
              updated.whatsappRecipientType,
              updated.whatsappGroups
            );
            setClassToEdit(null);
          }}
        />
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <ConfirmModal
          isOpen={!!classToDelete}
          title="حذف الفصل الدراسي نهائياً"
          message={`هل أنت متأكد من رغبتك في حذف فصل "${classToDelete.name}" وجميع الطلاب والحصص التابعة له نهائياً؟ سيتم حذفه من السيرفر فوراً ولن يظهر مجدداً.`}
          confirmText="نعم، احذف الفصل نهائياً"
          cancelText="تراجع"
          onConfirm={() => {
            const deletedId = classToDelete.id;
            onDeleteClass(deletedId);
            setClassToDelete(null);
            const remaining = classes.filter((c) => c.id !== deletedId);
            if (remaining.length > 0) {
              setSelectedClassId(remaining[0].id);
            } else {
              setSelectedClassId('');
            }
          }}
          onCancel={() => setClassToDelete(null)}
        />
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <ConfirmModal
          isOpen={showBatchDeleteConfirm}
          title="حذف الطلاب المحددين"
          message={`هل أنت متأكد من رغبتك في حذف ${selectedStudentIds.size} طالب من الكشف نهائياً؟`}
          confirmText="نعم، احذف الطلاب"
          cancelText="تراجع"
          onConfirm={handleBatchDeleteConfirmAction}
          onCancel={() => setShowBatchDeleteConfirm(false)}
        />
      )}

      {/* Batch Move to Class Modal */}
      {showMoveClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 border border-slate-100 font-sans">
            <h3 className="text-base font-black text-slate-900 mb-2">نقل الطلاب المحددين إلى فصل آخر</h3>
            <p className="text-xs text-slate-500 mb-4">
              حدد الفصل الذي ترغب في نقل {selectedStudentIds.size} طالب إليه:
            </p>
            <select
              value={targetClassForBatchMove}
              onChange={(e) => setTargetClassForBatchMove(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl mb-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- اختر الفصل الهدف --</option>
              {classes
                .filter((c) => c.id !== currentClass?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    فصل {c.name} ({c.gradeLevel})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMoveClassModal(false);
                  setTargetClassForBatchMove('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!targetClassForBatchMove}
                onClick={handleBatchMoveToClassConfirm}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs cursor-pointer"
              >
                تأكيد النقل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <ConfirmModal
          isOpen={!!studentToDelete}
          title="حذف الطالب من الكشف"
          message={`هل أنت متأكد من رغبتك في حذف الطالب "${studentToDelete.name}" من كشف الفصل؟`}
          confirmText="نعم، احذف الطالب"
          cancelText="تراجع"
          onConfirm={() => {
            onDeleteStudent(studentToDelete.id);
            setStudentToDelete(null);
          }}
          onCancel={() => setStudentToDelete(null)}
        />
      )}

      {/* Edit Student Modal */}
      {studentToEdit && (
        <EditStudentModal
          isOpen={!!studentToEdit}
          onClose={() => setStudentToEdit(null)}
          student={studentToEdit}
          classes={classes}
          onSave={(updated) => {
            if (onUpdateStudent) {
              onUpdateStudent(updated);
            }
            setStudentToEdit(null);
          }}
        />
      )}
    </div>
  );
};
