import React, { useState } from 'react';
import { X, Check, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { SchoolClass, Student } from '../types';
import { normalizeClassKey, parseHierarchicalText } from '../utils/excelParser';

interface SimpleRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  students: Student[];
  onSaveRoster: (newClasses: SchoolClass[], newStudents: Student[]) => void;
}

export const SimpleRosterModal: React.FC<SimpleRosterModalProps> = ({
  isOpen,
  onClose,
  classes,
  students,
  onSaveRoster,
}) => {
  // Build initial text representation from existing classes and students with clear track tags
  const generateInitialText = () => {
    if (!classes || classes.length === 0) return '';
    let text = '';
    classes.forEach((c, idx) => {
      text += `${c.name}\n`;
      const classStudents = students.filter((s) => s.classId === c.id);
      const engStudents = classStudents.filter((s) => s.track !== 'arabic');
      const arStudents = classStudents.filter((s) => s.track === 'arabic');

      if (engStudents.length > 0) {
        text += `[مسار اللغات]\n`;
        engStudents.forEach((st) => {
          text += `${st.name}\n`;
        });
      }

      if (arStudents.length > 0) {
        if (engStudents.length > 0) text += '\n';
        text += `[المسار العربي]\n`;
        arStudents.forEach((st) => {
          text += `${st.name}\n`;
        });
      }

      if (idx < classes.length - 1) text += '\n\n';
    });
    return text.trim();
  };

  const [rosterText, setRosterText] = useState(generateInitialText);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Sync initial text whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setRosterText(generateInitialText());
      setErrorNotice(null);
    }
  }, [isOpen, classes, students]);

  if (!isOpen) return null;

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

  const handleSave = () => {
    if (!rosterText.trim()) return;

    const parsed = parseHierarchicalText(rosterText);
    if (parsed.rows.length === 0) {
      setErrorNotice('لم يتم العثور على أي أسماء طلاب. تأكد من كتابة اسم الفصل ثم أسماء الطلاب تحته.');
      return;
    }
    setErrorNotice(null);

    // Build or match classes using flexible normalization
    const matchedClassList: SchoolClass[] = [];
    const classKeyMap = new Map<string, SchoolClass>();

    // Index existing classes by normalized key
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
          createdAt: new Date().toISOString(),
        };
        classKeyMap.set(key, createdClass);
        matchedClassList.push(createdClass);
      }
    });

    // Preserve any existing classes not mentioned in the parsed text to avoid wiping them out
    const updatedClasses = [...matchedClassList];
    classes.forEach((existingClass) => {
      const existingKey = normalizeClassKey(existingClass.name);
      if (!matchedClassList.some((c) => normalizeClassKey(c.name) === existingKey)) {
        updatedClasses.push(existingClass);
      }
    });

    // Build new students list
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

    // Keep students from classes that weren't in the edited text
    const editedClassKeys = new Set(parsed.detectedClasses.map(normalizeClassKey));
    const retainedStudents = students.filter((s) => {
      const studentClass = classes.find((c) => c.id === s.classId);
      if (!studentClass) return false;
      return !editedClassKeys.has(normalizeClassKey(studentClass.name));
    });

    const finalStudents = [...newParsedStudents, ...retainedStudents];

    onSaveRoster(updatedClasses, finalStudents);
    setSuccessNotice(true);
    setTimeout(() => {
      setSuccessNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                كشف أسماء الطلاب والفصول
              </h2>
              <p className="text-xs text-slate-500">
                اكتب اسم الفصل في سطر، ثم أسماء الطلاب تحته مباشرة
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

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">محتوى الكشف:</span>
            <button
              type="button"
              onClick={handleApplySample}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تعبئة كشف تجريبي سريع</span>
            </button>
          </div>

          <textarea
            rows={12}
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            placeholder={`GR4 - A\nاحمد عبدالله حليمه\nاحمد حسام الدين عبد المعز عبد\nاياد احمد محمد علم الدين\n\nGR4 - B\nيوسف محمد صبحي شحاته\nسيف الدين احمد محمد محمود ابراهيم`}
            className="w-full p-4 text-xs sm:text-sm font-mono leading-relaxed border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
          />

          {errorNotice && (
            <div className="bg-rose-50 rounded-xl p-3 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">{errorNotice}</p>
            </div>
          )}

          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <b>طريقة التنسيق السهلة:</b> اكتب اسم الفصل أولاً (مثل <b>GR4 - A</b>) ثم اضغط Enter واكتب أسماء الطلاب، وعند الانتقال لفصل آخر اكتب اسمه (مثل <b>GR4 - B</b>) وتحته طلابه.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl shadow-sm flex items-center gap-2 transition-all ${
              successNotice
                ? 'bg-emerald-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{successNotice ? 'تم حفظ الكشف بنجاح!' : 'حفظ الكشف وتحديث الفصول'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
