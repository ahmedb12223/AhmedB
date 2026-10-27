import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, Check, AlertCircle, Sparkles, Layers, FileText, Copy } from 'lucide-react';
import { parseExcelOrCsvFile, parseHierarchicalText, parsePastedStudentText, ParseResult } from '../utils/excelParser';
import { SchoolClass, Student } from '../types';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingClasses: SchoolClass[];
  onCommitImport: (newStudents: Omit<Student, 'id'>[], newClassesToCreate: string[]) => void;
}

const SAMPLE_TEXT_ROSTER = `GR4 - A
احمد عبدالله حليمه
احمد حسام الدين عبد المعز عبد
اياد احمد محمد علم الدين
GR4 - B
يوسف محمد صبحي شحاته
سيف الدين احمد محمد محمود ابراهيم`;

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  existingClasses,
  onCommitImport,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [pasteText, setPasteText] = useState(SAMPLE_TEXT_ROSTER);
  const [defaultClassForPaste, setDefaultClassForPaste] = useState(
    existingClasses[0]?.name || 'GR4 - A'
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setIsParsing(true);
    setParseResult(null);
    try {
      const res = await parseExcelOrCsvFile(file);
      setParseResult(res);
    } catch (err: any) {
      setParseResult({
        rows: [],
        detectedClasses: [],
        errors: [err.message || 'حدث خطأ أثناء معالجة الملف'],
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleProcessText = () => {
    if (!pasteText.trim()) return;
    setIsParsing(true);
    // Use hierarchical parser that automatically understands GR4 - A followed by student names
    const res = parseHierarchicalText(pasteText, defaultClassForPaste);
    setParseResult(res);
    setIsParsing(false);
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    // Detect classes that don't exist yet
    const existingClassNames = new Set(existingClasses.map((c) => c.name.toUpperCase()));
    const missingClassNames: string[] = [];

    for (const className of parseResult.detectedClasses) {
      if (!existingClassNames.has(className.toUpperCase())) {
        missingClassNames.push(className);
      }
    }

    // Map rows to students
    const studentsToCreate: Omit<Student, 'id'>[] = parseResult.rows.map((row) => {
      const existing = existingClasses.find(
        (c) => c.name.toUpperCase() === row.className.toUpperCase()
      );
      return {
        name: row.name,
        classId: existing ? existing.id : `class_${row.className.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        track: row.track,
        studentCode: row.studentCode,
        parentPhone: row.parentPhone,
      };
    });

    onCommitImport(studentsToCreate, missingClassNames);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                إدخال ورفع كشف الأسماء والفصول
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                التعرف التلقائي على الفصول (مثل GR4 - A و GR4 - B) وأسماء الطلاب
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

        {/* Tab switcher */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 bg-white">
          <button
            onClick={() => {
              setActiveTab('text');
              setParseResult(null);
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'text'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>لصق الكشف النصي المباشر (مثل GR4 - A)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('file');
              setParseResult(null);
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'file'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>رفع ملف (.xlsx, .csv)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!parseResult && activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  الصق الكشف النصي هنا (اسم الفصل في سطر، يليه أسماء الطلاب):
                </span>
                <button
                  type="button"
                  onClick={() => setPasteText(SAMPLE_TEXT_ROSTER)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تعبئة نموذج تجريبي</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  rows={9}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`GR4 - A\nاحمد عبدالله حليمه\nاحمد حسام الدين عبد المعز عبد\nاياد احمد محمد علم الدين\nGR4 - B\nيوسف محمد صبحي شحاته\nسيف الدين احمد محمد محمود ابراهيم`}
                  className="w-full p-3.5 text-xs font-mono leading-relaxed border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>كيف يعمل النظام التلقائي؟</span>
                </p>
                <p>
                  يكفي كتابة اسم الفصل في سطر مستقل (مثل <b>GR4 - A</b> أو <b>GR4 - B</b>)، ثم أسماء الطلاب تحته، وسيقوم النظام فوراً بفرز كل طالب لفصله وإنشاء الفصول الجديدة تلقائياً بنقرة واحدة!
                </p>
              </div>

              <button
                type="button"
                onClick={handleProcessText}
                disabled={!pasteText.trim()}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                معالجة الكشف واستخراج الفصول والطلاب
              </button>
            </div>
          )}

          {!parseResult && activeTab === 'file' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 bg-emerald-100/70 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  اسحب وأفلت ملف الإكسيل هنا، أو انقر للاختيار
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  يدعم صيغ XLSX, XLS, CSV. يقوم النظام بتحديد أعمدة الفصل واسم الطالب تلقائياً.
                </p>
                <div className="inline-flex items-center gap-2 py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs">
                  <span>تصفح جهازك</span>
                </div>
              </div>
            </div>
          )}

          {isParsing && (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-600">جاري قراءة وتصنيف الفصول والطلاب...</p>
            </div>
          )}

          {parseResult && (
            <div className="space-y-4">
              {/* Errors if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    {parseResult.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Classes Bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-700">الفصول المكتشفة ({parseResult.detectedClasses.length}):</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {parseResult.detectedClasses.map((cls) => {
                      const count = parseResult.rows.filter((r) => r.className === cls).length;
                      return (
                        <span
                          key={cls}
                          className="bg-white border border-indigo-200 font-bold px-2.5 py-0.5 rounded-lg text-indigo-950 font-mono text-xs shadow-2xs"
                        >
                          {cls} ({count} طالب)
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-1 rounded-md">
                  إجمالي: {parseResult.rows.length} طالب
                </span>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الطالب</th>
                      <th className="p-2.5">الفصل المستخرج</th>
                      <th className="p-2.5">كود مقترح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.rows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-slate-400 font-mono">{index + 1}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.name}</td>
                        <td className="p-2.5">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100">
                            {row.className}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{row.studentCode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setParseResult(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  تعديل النص المدخل
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={parseResult.rows.length === 0}
                    className="px-5 py-2.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>تأكيد استيراد ({parseResult.rows.length}) طالب وتحديث الفصول</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
