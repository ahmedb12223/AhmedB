import * as XLSX from 'xlsx';
import { SchoolClass, Student, ClassSession } from '../types/index';
import { enforceOfficialStudentTracks } from './storage';

export interface ParsedStudentRow {
  name: string;
  className: string;
  track: 'english' | 'arabic';
  studentCode?: string;
  parentPhone?: string;
}

export interface ParseResult {
  rows: ParsedStudentRow[];
  detectedClasses: string[];
  errors: string[];
}

export function detectTrack(val: string, name = ''): 'english' | 'arabic' {
  if (!val) {
    // If not explicitly provided, in a languages school, check if text is marked or default
    return 'english';
  }

  const clean = val.toLowerCase().trim();
  if (
    clean.includes('عرب') ||
    clean.includes('ar') ||
    clean === 'ع' ||
    clean === 'arabic'
  ) {
    return 'arabic';
  }

  return 'english';
}

function cleanHeaderKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-–]/g, '').trim();
}

/**
 * Checks if a line is an explicit track indicator (e.g. "[المسار العربي]", "مسار لغات", "عربي", "English")
 */
export function isTrackIndicatorLine(line: string): 'arabic' | 'english' | null {
  const clean = line
    .replace(/^[#:\-*•—–\s\[\]()]+/, '')
    .replace(/[#:\-*•—–\s\[\]()]+$/, '')
    .trim()
    .toLowerCase();

  if (!clean) return null;

  // Arabic Track Indicators
  if (
    clean === 'عربي' ||
    clean === 'ع' ||
    clean === 'arabic' ||
    clean.includes('مسار عربي') ||
    clean.includes('المسار العربي') ||
    clean.includes('قسم عربي') ||
    clean.includes('طلاب العربي') ||
    clean === 'مسار العربي' ||
    clean === 'عربى'
  ) {
    return 'arabic';
  }

  // English / Languages Track Indicators
  if (
    clean === 'لغات' ||
    clean === 'english' ||
    clean === 'languages' ||
    clean === 'language' ||
    clean.includes('مسار لغات') ||
    clean.includes('مسار اللغات') ||
    clean.includes('قسم لغات') ||
    clean.includes('طلاب اللغات') ||
    clean.includes('انجليزي') ||
    clean === 'مسار انجليزي'
  ) {
    return 'english';
  }

  return null;
}

/**
 * Normalizes class names for consistent grouping and fuzzy matching.
 * Strips track suffixes (e.g. "لغات", "عربي", "english", "arabic") so that
 * "Grade 8 لغات" and "Grade 8 عربي" have the EXACT same key and map to one class.
 */
export function normalizeClassKey(name: string): string {
  if (!name) return '';
  let clean = name
    .toLowerCase()
    .replace(/^فصل\s+/, '')
    .replace(/^الصف\s+/, '')
    .replace(/^صف\s+/, '')
    .replace(/^grade\s*/, 'gr')
    .replace(/^prep\s*/, 'prep')
    .replace(/^sec\s*/, 'sec');

  // Strip track suffixes from class key
  clean = clean
    .replace(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/gi, '')
    .replace(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/gi, '')
    .replace(/[\s\-_–—]/g, '')
    .trim();

  return clean;
}

/**
 * Extracts the clean canonical class name and any attached track switch from a header line.
 * E.g.: "Grade 8 لغات" -> { className: "Grade 8", track: "english" }
 *       "Grade 8 عربي" -> { className: "Grade 8", track: "arabic" }
 *       "GR4 A"        -> { className: "GR4 A", track: undefined }
 */
export function extractClassAndTrackFromHeader(line: string): {
  className: string;
  track?: 'english' | 'arabic';
} {
  let clean = line
    .replace(/^[#:\-*•—–\s]+/, '')
    .replace(/[#:\-*•—–\s]+$/, '')
    .trim();

  let detectedTrack: 'english' | 'arabic' | undefined;

  // Check if header specifies Arabic track
  if (
    clean.match(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/i) &&
    !clean.match(/لغة عربية/i)
  ) {
    detectedTrack = 'arabic';
    clean = clean
      .replace(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/gi, '')
      .replace(/[\-–—\s]+$/, '')
      .replace(/^[\-–—\s]+/, '')
      .trim();
  } else if (
    clean.match(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/i) &&
    !clean.match(/لغة انجليزية/i)
  ) {
    detectedTrack = 'english';
    clean = clean
      .replace(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/gi, '')
      .replace(/[\-–—\s]+$/, '')
      .replace(/^[\-–—\s]+/, '')
      .trim();
  }

  // Fallback clean
  if (!clean) clean = line.trim();

  return { className: clean, track: detectedTrack };
}

/**
 * Checks if a line is a Class Header (e.g. "GR4 - A", "GR4 - B", "Grade 5", "فصل 7A")
 */
export function isClassHeaderLine(line: string): boolean {
  const clean = line.trim();
  if (!clean) return false;

  // Exclude explicit standalone track indicator lines
  if (isTrackIndicatorLine(clean)) {
    return false;
  }

  // Exclude single word language/track terms
  if (/^(english|arabic|language|languages|track|قسم|مسار)$/i.test(clean)) {
    return false;
  }

  // 1. Starts with GR, Grade, Prep, Sec, G, صف, فصل with grade/number
  if (/^(gr|grade|prep|sec|g|صف|فصل|الصف)\s*[\d\-_\sA-Za-z]/i.test(clean)) {
    return true;
  }

  // 2. Short alphanumeric code with numbers, e.g. "GR4 - A", "4A", "7 - B", "GR4-B"
  if (/^[A-Za-z0-9\s\-–—/()]{2,15}$/.test(clean) && /[\d]/.test(clean)) {
    return true;
  }

  // 3. Explicit keywords with class context
  if (clean.startsWith('فصل ') || clean.startsWith('الصف ') || clean.includes('Class ')) {
    return true;
  }

  // 4. English letters + digits under 15 characters (e.g. "4A", "7B", "Grade4")
  if (clean.length <= 15 && /^[A-Za-z0-9\s\-]+$/.test(clean) && /[\d]/.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Parses Hierarchical Text where Class Name is on a separate line followed by student names
 * Supports track section headers (e.g. [المسار العربي] or [مسار اللغات])
 * and inline student track labels (e.g. أحمد محمد [عربي] or عمر علي [لغات])
 */
export function parseHierarchicalText(text: string, fallbackClassName = 'GR4 A'): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: ParsedStudentRow[] = [];
  const detectedClasses = new Set<string>();
  const errors: string[] = [];

  let currentClassName = fallbackClassName;
  let currentTrack: 'english' | 'arabic' = 'english';
  let studentCounter = 1;

  for (const line of lines) {
    // 1. Check for standalone track switch header (e.g. "[المسار العربي]" or "مسار لغات:")
    const trackSwitch = isTrackIndicatorLine(line);
    if (trackSwitch) {
      currentTrack = trackSwitch;
      continue;
    }

    // 2. Check if line is a class header (e.g. "Grade 8" or "Grade 8 لغات" or "Grade 8 عربي")
    if (isClassHeaderLine(line)) {
      const { className, track } = extractClassAndTrackFromHeader(line);
      currentClassName = className;
      detectedClasses.add(currentClassName);
      // Reset currentTrack for the new class header so previous track headers don't leak into new classes
      currentTrack = track || 'english';
      continue;
    }

    // 3. It's a student line
    // Strip leading numbers or bullets: e.g. "1. أحمد" or "- أحمد"
    let studentName = line.replace(/^[\d]+[\.\)\-–\s]+/, '').replace(/^[\-*•\s]+/, '').trim();
    if (!studentName) continue;

    // Check if line contains inline track or code (e.g. "أحمد [عربي]" or "أحمد, لغات")
    let studentTrack = currentTrack;
    if (
      studentName.includes('عربي') ||
      studentName.includes('[عربي]') ||
      studentName.includes('(عربي)') ||
      studentName.includes('مسار عربي')
    ) {
      studentTrack = 'arabic';
      studentName = studentName.replace(/[\[\(]?(عربي|مسار عربي|المسار العربي)[\]\)]?/g, '').trim();
    } else if (
      studentName.includes('لغات') ||
      studentName.includes('English') ||
      studentName.includes('[لغات]') ||
      studentName.includes('(لغات)') ||
      studentName.includes('مسار لغات')
    ) {
      studentTrack = 'english';
      studentName = studentName.replace(/[\[\(]?(لغات|English|مسار لغات|مسار اللغات)[\]\)]?/g, '').trim();
    }

    // Clean up trailing commas, dashes
    studentName = studentName.replace(/[\-–,،\s]+$/, '').trim();
    if (!studentName) continue;

    detectedClasses.add(currentClassName);
    rows.push({
      name: studentName,
      className: currentClassName,
      track: studentTrack,
      studentCode: `${currentClassName.replace(/\s+/g, '')}-${String(studentCounter++).padStart(3, '0')}`,
    });
  }

  if (rows.length === 0) {
    errors.push('لم يتم العثور على أي أسماء طلاب في النص المدخل');
  }

  return {
    rows,
    detectedClasses: Array.from(detectedClasses),
    errors,
  };
}

/**
 * Parses raw JSON rows from XLSX or CSV
 */
export function parseRows(rawRows: Record<string, any>[]): ParseResult {
  const rows: ParsedStudentRow[] = [];
  const detectedClasses = new Set<string>();
  const errors: string[] = [];

  if (!rawRows || rawRows.length === 0) {
    return { rows, detectedClasses: [], errors: ['الملف فارغ أو لا يحتوي على صفوف بيانات'] };
  }

  const keys = Object.keys(rawRows[0]);
  let nameKey: string | null = null;
  let classKey: string | null = null;
  let trackKey: string | null = null;
  let codeKey: string | null = null;
  let phoneKey: string | null = null;

  for (const k of keys) {
    const clean = cleanHeaderKey(k);
    if (!nameKey && (clean.includes('اسم') || clean.includes('name') || clean.includes('طالب') || clean.includes('student'))) {
      nameKey = k;
    } else if (!classKey && (clean.includes('فصل') || clean.includes('صف') || clean.includes('class') || clean.includes('grade') || clean.includes('section'))) {
      classKey = k;
    } else if (!trackKey && (clean.includes('مسار') || clean.includes('لغ') || clean.includes('track') || clean.includes('lang') || clean.includes('قسم'))) {
      trackKey = k;
    } else if (!codeKey && (clean.includes('كود') || clean.includes('code') || clean.includes('id') || clean.includes('قيد'))) {
      codeKey = k;
    } else if (!phoneKey && (clean.includes('هاتف') || clean.includes('تليفون') || clean.includes('phone') || clean.includes('mobile'))) {
      phoneKey = k;
    }
  }

  if (!nameKey) {
    for (const k of keys) {
      if (rawRows.some(r => typeof r[k] === 'string' && r[k].trim().length > 2)) {
        nameKey = k;
        break;
      }
    }
  }

  if (!nameKey) {
    return { rows, detectedClasses: [], errors: ['لم يتم العثور على عمود يحمل أسماء الطلاب'] };
  }

  for (let idx = 0; idx < rawRows.length; idx++) {
    const r = rawRows[idx];
    const rawName = r[nameKey];
    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
      continue;
    }

    const name = rawName.trim();
    const className = classKey && r[classKey] ? String(r[classKey]).trim() : 'GR4 - A';
    const rawTrack = trackKey && r[trackKey] ? String(r[trackKey]).trim() : '';
    const track = detectTrack(rawTrack, name);
    const studentCode = codeKey && r[codeKey] ? String(r[codeKey]).trim() : undefined;
    const parentPhone = phoneKey && r[phoneKey] ? String(r[phoneKey]).trim() : undefined;

    detectedClasses.add(className);
    rows.push({
      name,
      className,
      track,
      studentCode,
      parentPhone,
    });
  }

  return {
    rows,
    detectedClasses: Array.from(detectedClasses),
    errors,
  };
}

/**
 * Parses an Excel or CSV file
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        const result = parseRows(json);
        resolve(result);
      } catch (err) {
        console.error(err);
        reject(new Error('تعذر قراءة ملف الإكسيل. تأكد من سلامة صيغة الملف.'));
      }
    };
    reader.onerror = () => reject(new Error('حدث خطأ أثناء تحميل الملف'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * General parser for pasted text that automatically handles both hierarchical text
 * (with class headers like GR4 - A) and table text (tab or comma separated).
 */
export function parsePastedStudentText(text: string, defaultClassName = 'GR4 - A'): ParseResult {
  // If the text has class header lines (e.g. "GR4 - A"), use hierarchical parser!
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const hasClassHeaders = lines.some(l => isClassHeaderLine(l));

  if (hasClassHeaders) {
    return parseHierarchicalText(text, defaultClassName);
  }

  // Otherwise parse as tab/comma lines or simple names
  const rows: ParsedStudentRow[] = [];
  const detectedClasses = new Set<string>();

  for (const line of lines) {
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length >= 2) {
      const p1 = parts[0].trim();
      const p2 = parts[1].trim();
      const p3 = parts[2] ? parts[2].trim() : '';

      if (isClassHeaderLine(p1)) {
        const className = p1;
        const name = p2;
        const track = detectTrack(p3, name);
        detectedClasses.add(className);
        rows.push({ name, className, track });
      } else {
        const name = p1;
        const className = isClassHeaderLine(p2) ? p2 : defaultClassName;
        const track = detectTrack(p3, name);
        detectedClasses.add(className);
        rows.push({ name, className, track });
      }
    } else {
      const name = parts[0].trim();
      const track = detectTrack('', name);
      detectedClasses.add(defaultClassName);
      rows.push({ name, className: defaultClassName, track });
    }
  }

  return {
    rows,
    detectedClasses: Array.from(detectedClasses),
    errors: [],
  };
}

/**
 * Downloads attendance data as CSV/Excel
 */
export function exportAttendanceToCSV(
  sessionTitle: string,
  className: string,
  trackLabel: string,
  records: {
    studentName: string;
    matchedRosterName?: string;
    track: string;
    status: string;
    timestamp?: string;
    confidence?: number;
  }[]
) {
  const headers = ['اسم الطالب', 'الاسم المطابق في الكشف', 'الفصل', 'المسار', 'الحالة', 'وقت التسجيل', 'نسبة التطابق'];
  const dataRows = records.map(r => [
    r.studentName,
    r.matchedRosterName || '-',
    className,
    r.track === 'english' ? 'لغات (English)' : 'عربي (Arabic)',
    r.status === 'present' ? 'حاضر' : r.status === 'late' ? 'متأخر' : r.status === 'guest' ? 'زائر غير مسجل' : 'غائب',
    r.timestamp ? new Date(r.timestamp).toLocaleTimeString('ar-EG') : '-',
    r.confidence ? `${Math.round(r.confidence * 100)}%` : '-'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  XLSX.writeFile(workbook, `حضور_${className}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface MergeResult {
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  mergedCount: number;
}

/**
 * Merges duplicate classes that share the same normalized name/grade (e.g. "Grade 8" and "Grade 8 لغات").
 * Consolidates all students into the canonical class while preserving their respective tracks.
 */
export function mergeDuplicateClasses(
  classes: SchoolClass[],
  students: Student[],
  sessions: ClassSession[] = []
): MergeResult {
  if (!Array.isArray(classes) || classes.length <= 1) {
    return { classes, students, sessions, mergedCount: 0 };
  }

  const classGroups = new Map<string, SchoolClass[]>();

  classes.forEach((c) => {
    const key = normalizeClassKey(c.name);
    if (!classGroups.has(key)) {
      classGroups.set(key, []);
    }
    classGroups.get(key)!.push(c);
  });

  const mergedClasses: SchoolClass[] = [];
  const idRemap = new Map<string, string>(); // oldClassId -> canonicalClassId
  const canonicalNameMap = new Map<string, string>();
  let mergedCount = 0;

  for (const [_key, group] of classGroups.entries()) {
    if (group.length === 1) {
      mergedClasses.push(group[0]);
      idRemap.set(group[0].id, group[0].id);
      canonicalNameMap.set(group[0].id, group[0].name);
    } else {
      mergedCount += group.length - 1;
      // Pick canonical class: prefer cleaner/shorter name without track words
      const sorted = [...group].sort((a, b) => {
        const aHasTrack = /لغات|عربي|arabic|english/i.test(a.name);
        const bHasTrack = /لغات|عربي|arabic|english/i.test(b.name);
        if (!aHasTrack && bHasTrack) return -1;
        if (aHasTrack && !bHasTrack) return 1;
        return a.name.length - b.name.length;
      });

      const canonical = sorted[0];
      const cleanName = canonical.name
        .replace(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/gi, '')
        .replace(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/gi, '')
        .replace(/[\-–—\s]+$/, '')
        .trim();

      const finalCanonical: SchoolClass = {
        ...canonical,
        name: cleanName || canonical.name,
      };

      mergedClasses.push(finalCanonical);
      group.forEach((c) => {
        idRemap.set(c.id, finalCanonical.id);
        canonicalNameMap.set(c.id, finalCanonical.name);
      });
    }
  }

  // Remap students and deduplicate by name inside the merged class
  const studentMap = new Map<string, Student>();
  students.forEach((st) => {
    if (!st || typeof st !== 'object' || !st.name || typeof st.name !== 'string') return;
    const cleanName = st.name.trim();
    if (!cleanName) return;
    const targetClassId = idRemap.get(st.classId) || st.classId;
    const dedupKey = `${targetClassId}_${cleanName.toLowerCase()}`;

    if (studentMap.has(dedupKey)) {
      const existing = studentMap.get(dedupKey)!;
      // CRITICAL: Strictly preserve existing student track if already defined!
      // Never overwrite an explicit 'arabic' track with 'english'!
      const preservedTrack = existing.track || st.track || 'english';
      studentMap.set(dedupKey, {
        ...existing,
        track: preservedTrack,
        studentCode: existing.studentCode || st.studentCode,
      });
    } else {
      studentMap.set(dedupKey, {
        ...st,
        name: cleanName,
        classId: targetClassId,
        track: st.track || 'english',
      });
    }
  });

  // Remap sessions
  const updatedSessions = sessions.map((s) => {
    const targetClassId = idRemap.get(s.classId) || s.classId;
    const targetClassName = canonicalNameMap.get(s.classId) || s.className;
    return {
      ...s,
      classId: targetClassId,
      className: targetClassName,
    };
  });

  return {
    classes: mergedClasses,
    students: enforceOfficialStudentTracks(Array.from(studentMap.values())),
    sessions: updatedSessions,
    mergedCount,
  };
}
