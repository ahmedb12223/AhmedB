import type { SchoolClass, Student, ClassSession, TeacherProfile, SchedulePeriod, LanguageTrack } from '../types/index';
import { normalizeText } from './arabicFuzzy';

export const AHMED_BADAWI_OFFICIAL_SCHEDULE: SchedulePeriod[] = [
  // Sunday
  { id: 'badawi_sun_1', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف الرابع عربي (4B)', classId: 'class_gr4___b', startTime: '08:00', endTime: '08:40', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_sun_2', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف الرابع لغات (4A)', classId: 'class_gr4___a', startTime: '08:40', endTime: '09:20', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_sun_3', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف الأول الإعدادي (7A)', classId: 'class_gr7___a', startTime: '09:20', endTime: '10:00', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_sun_4', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف الخامس (5A)', classId: 'class_gr5___a', startTime: '10:00', endTime: '10:45', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_sun_5', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف السادس (6A)', classId: 'class_gr6___a', startTime: '10:45', endTime: '11:25', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_sun_6', dayOfWeek: 'sunday', dayNameArabic: 'الأحد', className: 'الصف الثاني الإعدادي (8A)', classId: 'class_gr8___a', startTime: '11:25', endTime: '12:05', subject: 'Math', targetTrack: 'arabic', zoomUrl: '' },

  // Monday
  { id: 'badawi_mon_1', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف الأول الإعدادي (7A)', classId: 'class_gr7___a', startTime: '08:00', endTime: '08:40', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_mon_2', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف السادس (6A)', classId: 'class_gr6___a', startTime: '08:40', endTime: '09:20', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_mon_3', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف الخامس (5A)', classId: 'class_gr5___a', startTime: '09:20', endTime: '10:00', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_mon_4', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف الثاني الإعدادي (8A)', classId: 'class_gr8___a', startTime: '10:00', endTime: '10:45', subject: 'Math', targetTrack: 'arabic', zoomUrl: '' },
  { id: 'badawi_mon_5', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف الرابع عربي (4B)', classId: 'class_gr4___b', startTime: '10:45', endTime: '11:25', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_mon_6', dayOfWeek: 'monday', dayNameArabic: 'الإثنين', className: 'الصف الرابع لغات (4A)', classId: 'class_gr4___a', startTime: '12:05', endTime: '12:45', subject: 'Math', targetTrack: 'all', zoomUrl: '' },

  // Tuesday
  { id: 'badawi_tue_1', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف الرابع لغات (4A)', classId: 'class_gr4___a', startTime: '08:40', endTime: '09:20', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_tue_2', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف الخامس (5A)', classId: 'class_gr5___a', startTime: '09:20', endTime: '10:00', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_tue_3', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف السادس (6A)', classId: 'class_gr6___a', startTime: '10:00', endTime: '10:45', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_tue_4', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف الرابع عربي (4B)', classId: 'class_gr4___b', startTime: '10:45', endTime: '11:25', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_tue_5', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف الأول الإعدادي (7A)', classId: 'class_gr7___a', startTime: '11:25', endTime: '12:05', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_tue_6', dayOfWeek: 'tuesday', dayNameArabic: 'الثلاثاء', className: 'الصف الثاني الإعدادي (8A)', classId: 'class_gr8___a', startTime: '12:05', endTime: '12:45', subject: 'Math', targetTrack: 'arabic', zoomUrl: '' },

  // Wednesday
  { id: 'badawi_wed_1', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف الرابع عربي (4B)', classId: 'class_gr4___b', startTime: '08:00', endTime: '08:40', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_wed_2', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف الرابع لغات (4A)', classId: 'class_gr4___a', startTime: '08:40', endTime: '09:20', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_wed_3', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف الأول الإعدادي (7A)', classId: 'class_gr7___a', startTime: '09:20', endTime: '10:00', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_wed_4', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف السادس (6A)', classId: 'class_gr6___a', startTime: '10:00', endTime: '10:45', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_wed_5', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف الثاني الإعدادي (8A)', classId: 'class_gr8___a', startTime: '10:45', endTime: '11:25', subject: 'Math', targetTrack: 'arabic', zoomUrl: '' },
  { id: 'badawi_wed_6', dayOfWeek: 'wednesday', dayNameArabic: 'الأربعاء', className: 'الصف الخامس (5A)', classId: 'class_gr5___a', startTime: '11:25', endTime: '12:05', subject: 'Math', targetTrack: 'english', zoomUrl: '' },

  // Thursday
  { id: 'badawi_thu_1', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف الثاني الإعدادي (8A)', classId: 'class_gr8___a', startTime: '08:40', endTime: '09:20', subject: 'Math', targetTrack: 'arabic', zoomUrl: '' },
  { id: 'badawi_thu_2', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف الأول الإعدادي (7A)', classId: 'class_gr7___a', startTime: '09:20', endTime: '10:00', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_thu_3', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف الرابع عربي (4B)', classId: 'class_gr4___b', startTime: '10:00', endTime: '10:45', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
  { id: 'badawi_thu_4', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف الخامس (5A)', classId: 'class_gr5___a', startTime: '10:45', endTime: '11:25', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_thu_5', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف السادس (6A)', classId: 'class_gr6___a', startTime: '11:25', endTime: '12:05', subject: 'Math', targetTrack: 'english', zoomUrl: '' },
  { id: 'badawi_thu_6', dayOfWeek: 'thursday', dayNameArabic: 'الخميس', className: 'الصف الرابع لغات (4A)', classId: 'class_gr4___a', startTime: '12:05', endTime: '12:45', subject: 'Math', targetTrack: 'all', zoomUrl: '' },
];

export const OFFICIAL_ARABIC_STUDENT_NAMES = [
  'تيم الله صهيب ابوالكامل علي',
  'محمد وائل ابراهيم احمد',
  'محمد ابراهيم عيسى شريدم',
  'عمر على أحمد يوسف رجب',
  'ياسين ابراهيم مصطفى',
  'ياسين احمد عبد الله حليمه',
  'احمد محمد احمد علي',
  'مروان خالد عبدالعزيز',
  'عبدالله سامح عبدالمرضي',
  'ادم احمد محمد عبدالعظيم',
  'اياد إبراهيم عيسى كمال شريدم',
  'عادل علي عادل علي احمد',
  'زياد أحمد محمد محمود ابراهيم',
  'تميم صهيب ابو المكارم علي',
  'مصطفى اشرف صلاح السقا',
  'ياسين عمرو زكريا غازي',
  'عمر السيد احمد عبد ابراهيم'
];

const NORMALIZED_ARABIC_NAMES = new Set(
  OFFICIAL_ARABIC_STUDENT_NAMES.map((name) => normalizeText(name))
);

export function enforceOfficialStudentTracks(studentsList: Student[]): Student[] {
  if (!Array.isArray(studentsList) || studentsList.length === 0) {
    return DEFAULT_STUDENTS;
  }
  return studentsList
    .filter((st) => st && typeof st === 'object' && typeof st.name === 'string' && st.name.trim().length > 0)
    .map((st) => {
      const cleanName = st.name.trim();
      const norm = normalizeText(cleanName);
      const isArabic = NORMALIZED_ARABIC_NAMES.has(norm);
      return {
        ...st,
        name: cleanName,
        track: isArabic ? ('arabic' as const) : ('english' as const),
      };
    });
}

export function applyAhmedBadawiScheduleTrackRules(schedule: SchedulePeriod[]): SchedulePeriod[] {
  if (!Array.isArray(schedule)) return [];
  return schedule.map((period) => {
    const rawName = (period.className || '').toLowerCase();
    const norm = normalizeText(period.className).toLowerCase();
    const is4Aor4B =
      /4\s*[ab]|رابع/i.test(rawName) ||
      norm.includes('رابع') ||
      rawName.includes('4a') ||
      rawName.includes('4b') ||
      norm.includes('4a') ||
      norm.includes('4b');

    const is8A =
      /8\s*a|ثامن|ثاني اعدادي|ثاني إعدادي/i.test(rawName) ||
      norm.includes('8a') ||
      norm.includes('ثامن') ||
      norm.includes('ثاني اعدادي');

    let targetTrack: LanguageTrack = 'english';
    if (is4Aor4B) {
      targetTrack = 'all';
    } else if (is8A) {
      targetTrack = 'arabic';
    }

    return {
      ...period,
      subject: 'Math',
      targetTrack,
    };
  });
}

const STORAGE_KEYS = {
  TEACHERS: 'zoom_attend_teachers_v5_clean',
  CURRENT_TEACHER_ID: 'zoom_attend_current_teacher_id_v5_clean',
  CLASSES: 'zoom_attend_classes_v5_clean',
  STUDENTS: 'zoom_attend_students_v5_clean',
  SESSIONS: 'zoom_attend_sessions_v5_clean',
  DELETED_SESSIONS: 'zoom_attend_deleted_sessions_v5_clean',
  TEACHER_PIN: 'zoom_attend_teacher_pin_v5_clean',
  TEACHER_AUTH_TOKEN: 'zoom_attend_teacher_auth_v5_clean',
  CLEANUP_DONE: 'zoom_attend_legacy_purged_v5',
};

// Purge all old buggy localStorage keys on startup
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  try {
    if (window.localStorage.getItem(STORAGE_KEYS.CLEANUP_DONE) !== 'true') {
      const legacyKeys = [
        'zoom_attend_teachers_v3',
        'zoom_attend_current_teacher_id_v3',
        'zoom_attend_classes_v3',
        'zoom_attend_students_v3',
        'zoom_attend_sessions_v3',
        'zoom_attend_deleted_sessions_v1',
        'zoom_cloud_relay_cache_v4',
        'zoom_attendance_published_domain',
        'zoom_attendance_offline_queue_v1',
      ];
      for (const k of legacyKeys) {
        window.localStorage.removeItem(k);
      }
      window.localStorage.setItem(STORAGE_KEYS.CLEANUP_DONE, 'true');
    }
  } catch {
    // ignore storage errors
  }
}

export const DEFAULT_TEACHERS: TeacherProfile[] = [
  {
    id: 'teacher_ahmed_badawi',
    name: 'مستر احمد بدوي',
    subject: 'الرياضيات (Math)',
    schoolName: 'مدرسة اللغات الحديثة',
    email: 'ahmedbadawi5090@gmail.com',
    defaultZoomLink: '',
    assignedClassIds: ['class_gr4___a', 'class_gr4___b', 'class_gr5___a', 'class_gr6___a', 'class_gr7___a', 'class_gr8___a'],
    weeklySchedule: AHMED_BADAWI_OFFICIAL_SCHEDULE,
  }
];

export const DEFAULT_CLASSES: SchoolClass[] = [
  { id: 'class_gr4___a', name: 'GR4 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.548Z' },
  { id: 'class_gr4___b', name: 'GR4 B', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr5___a', name: 'GR5 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr6___a', name: 'GR6 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr7___a', name: 'GR7 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr7___b', name: 'GR7 B', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr8___a', name: 'GR8 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' },
  { id: 'class_gr9___a', name: 'GR9 A', gradeLevel: 'المرحلة الدراسية', zoomUrl: '', createdAt: '2026-10-21T15:22:40.549Z' }
];

export const DEFAULT_STUDENTS: Student[] = [
  // GR 4A
  { id: 'st_4a_1', name: 'احمد عبدالله حليمه', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-001' },
  { id: 'st_4a_2', name: 'احمد حسام الدين عبد المعز عبد', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-002' },
  { id: 'st_4a_3', name: 'اياد احمد محمد علم الدين', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-003' },
  { id: 'st_4a_4', name: 'اياد على كامل عبد الله', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-004' },
  { id: 'st_4a_5', name: 'بلال محمد عبد الوهاب هجرس', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-005' },
  { id: 'st_4a_6', name: 'سليم يوسف عبد الحميد طنطاوى', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-006' },
  { id: 'st_4a_7', name: 'عبد الرحمن عمرو محمد عيسى', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-007' },
  { id: 'st_4a_8', name: 'عبد الرحمن محمد فتحى عبد الحليم', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-008' },
  { id: 'st_4a_9', name: 'عمر عامر مجدى الشربيني', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-009' },
  { id: 'st_4a_10', name: 'مالك مروان عبد الفتاح عبد الكريم', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-010' },
  { id: 'st_4a_11', name: 'ياسين صلاح الدين محمد محمد', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-011' },
  { id: 'st_4a_12', name: 'ياسين احمد عبد العزيز جاب الله', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-012' },
  { id: 'st_4a_13', name: 'يزيد احمد محمد علم الدين', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-013' },
  { id: 'st_4a_14', name: 'يوسف يونس صلاح الروبي', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-014' },
  { id: 'st_4a_15', name: 'يونس حسام صلاح الدين نيازى', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-015' },
  { id: 'st_4a_16', name: 'يونس محمد عبد الحليم نصار', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-016' },
  { id: 'st_4a_17', name: 'سليم احمد مصطفى ابراهيم', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-017' },
  { id: 'st_4a_18', name: 'مالك مصطفى محمد دهب', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-018' },
  { id: 'st_4a_19', name: 'محمد محمود الصاوى محمد', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-019' },
  { id: 'st_4a_20', name: 'سليم اسالم محمد', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-020' },
  { id: 'st_4a_21', name: 'أدم علاء الدين شتا', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-021' },
  { id: 'st_4a_22', name: 'زياد محمد عبدالوهاب العوضى', classId: 'class_gr4___a', track: 'english', studentCode: 'GR4-A-022' },

  // GR 4B
  { id: 'st_4b_1', name: 'يوسف محمد صبحي شحاته', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-001' },
  { id: 'st_4b_2', name: 'سيف الدين احمد محمد محمود ابراهيم', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-002' },
  { id: 'st_4b_3', name: 'حازم عماد سمير الصعيدي', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-003' },
  { id: 'st_4b_4', name: 'أسر احمد كمال الدين يوسف', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-004' },
  { id: 'st_4b_5', name: 'أحمد محمد أحمد مجاهد', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-005' },
  { id: 'st_4b_6', name: 'مروان محمود ضاحي احمد محمد', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-006' },
  { id: 'st_4b_7', name: 'ادم وانل ابراهيم احمد', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-007' },
  { id: 'st_4b_8', name: 'عمر مصطفى فايد محمد', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-008' },
  { id: 'st_4b_9', name: 'صلاح الدين شريف صلاح محمد', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-009' },
  { id: 'st_4b_10', name: 'مروان أحمد عادل الشامي', classId: 'class_gr4___b', track: 'english', studentCode: 'GR4-B-010' },

  // GR 5A
  { id: 'st_5a_1', name: 'تيم الله صهيب ابوالكامل علي', classId: 'class_gr5___a', track: 'arabic', studentCode: 'GR5-A-001' },
  { id: 'st_5a_2', name: 'اسر احمد زكي زكي', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-002' },
  { id: 'st_5a_3', name: 'البراء أحمد شعبان', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-003' },
  { id: 'st_5a_4', name: 'حسن نادر حسن محمد', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-004' },
  { id: 'st_5a_5', name: 'حمزة عامر مجدي الشربيني', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-005' },
  { id: 'st_5a_6', name: 'حمزه محمد سيد احمد الكناني', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-006' },
  { id: 'st_5a_7', name: 'حمزه محمد محمد سالم', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-007' },
  { id: 'st_5a_8', name: 'سيف احمد درويش محمد درويش', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-008' },
  { id: 'st_5a_9', name: 'عمر احمد درويش محمد درويش', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-009' },
  { id: 'st_5a_10', name: 'عمر حسن محيي الدين حسين', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-010' },
  { id: 'st_5a_11', name: 'فهد ماهر احمد حمزه', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-011' },
  { id: 'st_5a_12', name: 'آدم محمد منير', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-012' },
  { id: 'st_5a_13', name: 'مازن معتز محمد الوكيل', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-013' },
  { id: 'st_5a_14', name: 'محمد سيد محمد عوف', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-014' },
  { id: 'st_5a_15', name: 'معتز محمود محمد المغربي', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-015' },
  { id: 'st_5a_16', name: 'المعتصم بالله محمد السيد محمد ابراهيم', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-016' },
  { id: 'st_5a_17', name: 'ياسين عبدالعظيم مصطفى الدرديري', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-017' },
  { id: 'st_5a_18', name: 'عمر شهاب الدين طارق محمدين', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-018' },
  { id: 'st_5a_19', name: 'محمد ضياء ربيع الهريجي', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-019' },
  { id: 'st_5a_20', name: 'محمد وائل ابراهيم احمد', classId: 'class_gr5___a', track: 'arabic', studentCode: 'GR5-A-020' },
  { id: 'st_5a_21', name: 'حمزة علي علاء', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-021' },
  { id: 'st_5a_22', name: 'احمد عمرو رزق', classId: 'class_gr5___a', track: 'english', studentCode: 'GR5-A-022' },

  // GR 6A
  { id: 'st_6a_1', name: 'اسر احمد ابراهيم سعادة', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-001' },
  { id: 'st_6a_2', name: 'اياد محمود يسري محمد', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-002' },
  { id: 'st_6a_3', name: 'بلال شريف محمد سعيد', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-003' },
  { id: 'st_6a_4', name: 'خالد احمد محمد محمد عبده', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-004' },
  { id: 'st_6a_5', name: 'سليم خالد بدر محمد', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-005' },
  { id: 'st_6a_6', name: 'صالح محمد شعبان محمود بدوي', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-006' },
  { id: 'st_6a_7', name: 'عاصم احمد محمود المالكي', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-007' },
  { id: 'st_6a_8', name: 'عبد الله مصطفى بكري العيسوى', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-008' },
  { id: 'st_6a_9', name: 'عبدالرحمن علي رجب', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-009' },
  { id: 'st_6a_10', name: 'مازن حسام الدين عبدالمعز', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-010' },
  { id: 'st_6a_11', name: 'مالك أحمد محمد عبدالعظيم', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-011' },
  { id: 'st_6a_12', name: 'محمد اسالم محمد حسين احمد', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-012' },
  { id: 'st_6a_13', name: 'محمد خالد شعبان سالم', classId: 'class_gr6___a', track: 'english', studentCode: 'GR6-A-013' },
  { id: 'st_6a_14', name: 'محمد ابراهيم عيسى شريدم', classId: 'class_gr6___a', track: 'arabic', studentCode: 'GR6-A-014' },

  // GR 7A
  { id: 'st_7a_1', name: 'أحمد خالد الشربيني', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-001' },
  { id: 'st_7a_2', name: 'أحمد عبدالحميد أشرف عبدالمطلب', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-002' },
  { id: 'st_7a_3', name: 'آدم عزت علي خليل', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-003' },
  { id: 'st_7a_4', name: 'آدم محمود الصاوي محمد', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-004' },
  { id: 'st_7a_5', name: 'أنس محمد عبدالفتاح', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-005' },
  { id: 'st_7a_6', name: 'حمزة عبدالله محمد عبد الوكيل', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-006' },
  { id: 'st_7a_7', name: 'عمر شعبان صابر عبد العزيز', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-007' },
  { id: 'st_7a_8', name: 'عمر على أحمد يوسف رجب', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-008' },
  { id: 'st_7a_9', name: 'عمر مصطفى حسن ذكي', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-009' },
  { id: 'st_7a_10', name: 'كريم حسام الدين عبدالمعز', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-010' },
  { id: 'st_7a_11', name: 'محمد محمود بدوي', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-011' },
  { id: 'st_7a_12', name: 'ياسين ابراهيم مصطفى', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-012' },
  { id: 'st_7a_13', name: 'ياسين احمد عبد الله حليمه', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-013' },
  { id: 'st_7a_14', name: 'يزيد صالح جمعة عبد الرحمن', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-014' },
  { id: 'st_7a_15', name: 'احمد محمد احمد علي', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-015' },
  { id: 'st_7a_16', name: 'انس عبد السلام عطا الله ادم', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-016' },
  { id: 'st_7a_17', name: 'علي اسلام علي رمضان', classId: 'class_gr7___a', track: 'english', studentCode: 'GR7-A-017' },
  { id: 'st_7a_18', name: 'مروان خالد عبدالعزيز', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-018' },
  { id: 'st_7a_19', name: 'عبدالله سامح عبدالمرضي', classId: 'class_gr7___a', track: 'arabic', studentCode: 'GR7-A-019' },

  // GR 7B
  { id: 'st_7b_1', name: 'أحمد جابر رجب البراوي', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-001' },
  { id: 'st_7b_2', name: 'أنس احمد السيد النجار', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-002' },
  { id: 'st_7b_3', name: 'إياد محمد أشرف أنور منصور', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-003' },
  { id: 'st_7b_4', name: 'جاسر شريف عبدالمنعم احمد', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-004' },
  { id: 'st_7b_5', name: 'عمر محمد عبد الوهاب هجرس', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-005' },
  { id: 'st_7b_6', name: 'عمر منتصر محمد غنيم', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-006' },
  { id: 'st_7b_7', name: 'كريم عبدالعظيم مصطفى دريري', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-007' },
  { id: 'st_7b_8', name: 'كريم محمد احمد محمد عبد الوهاب', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-008' },
  { id: 'st_7b_9', name: 'محمد احمد شعبان عبد الحساب', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-009' },
  { id: 'st_7b_10', name: 'محمد مصطفى محمد عامر', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-010' },
  { id: 'st_7b_11', name: 'يحيى عمرو محمد عيسى', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-011' },
  { id: 'st_7b_12', name: 'يوسف محمد جمعة', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-012' },
  { id: 'st_7b_13', name: 'يوسف محمد محمد نصار', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-013' },
  { id: 'st_7b_14', name: 'ادم فتحي مسعد مسعد', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-014' },
  { id: 'st_7b_15', name: 'اسامه احمد محمد حجازي', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-015' },
  { id: 'st_7b_16', name: 'يوسف عبدالعظيم الشيخ', classId: 'class_gr7___b', track: 'english', studentCode: 'GR7-B-016' },

  // GR 8A
  { id: 'st_8a_1', name: 'ادم احمد محمد عبدالعظيم', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-001' },
  { id: 'st_8a_2', name: 'ادم عبدالله مجدي حافظ', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-002' },
  { id: 'st_8a_3', name: 'انس محمد شعبان محمود بدوي', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-003' },
  { id: 'st_8a_4', name: 'اياد إبراهيم عيسى كمال شريدم', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-004' },
  { id: 'st_8a_5', name: 'بدوي محمود بدوي إسحاق', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-005' },
  { id: 'st_8a_6', name: 'محمد خالد محمد اسماعيل', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-006' },
  { id: 'st_8a_7', name: 'عادل علي عادل علي احمد', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-007' },
  { id: 'st_8a_8', name: 'عبد الرحمن خالد محمد الشربيني', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-008' },
  { id: 'st_8a_9', name: 'عبدالله طه ناصف يونس', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-009' },
  { id: 'st_8a_10', name: 'محمد عبد الله محمد عبده المطرى', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-010' },
  { id: 'st_8a_11', name: 'محمد مصطفى خير الله عبد الحميد', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-011' },
  { id: 'st_8a_12', name: 'محمود احمد عبد العزيز احمد', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-012' },
  { id: 'st_8a_13', name: 'معاذ محمد حسن محمد القيمة', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-013' },
  { id: 'st_8a_14', name: 'ياسين احمد حامد جمال الدين', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-014' },
  { id: 'st_8a_15', name: 'يوسف احمد محمد محمد عبده', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-015' },
  { id: 'st_8a_16', name: 'زياد أحمد محمد محمود ابراهيم', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-016' },
  { id: 'st_8a_17', name: 'تميم صهيب ابو المكارم علي', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-017' },
  { id: 'st_8a_18', name: 'مصطفى اشرف صلاح السقا', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-018' },
  { id: 'st_8a_19', name: 'ياسين عمرو زكريا غازي', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-019' },
  { id: 'st_8a_20', name: 'عمر السيد احمد عبد ابراهيم', classId: 'class_gr8___a', track: 'arabic', studentCode: 'GR8-A-020' },
  { id: 'st_8a_21', name: 'حمزه محمود محمد مصطفى', classId: 'class_gr8___a', track: 'english', studentCode: 'GR8-A-021' },

  // GR 9A
  { id: 'st_9a_1', name: 'أحمد حسن محيي الدين حسن', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-001' },
  { id: 'st_9a_2', name: 'احمد مجدي محمد الصاوي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-002' },
  { id: 'st_9a_3', name: 'أحمد محمد أحمد الغرباوي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-003' },
  { id: 'st_9a_4', name: 'أحمد محمود أحمد جندي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-004' },
  { id: 'st_9a_5', name: 'زياد محمد محمد غزالي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-005' },
  { id: 'st_9a_6', name: 'عمر أحمد محمد على', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-006' },
  { id: 'st_9a_7', name: 'كريم محمد حسن سعد الشاذلي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-007' },
  { id: 'st_9a_8', name: 'محمد احمد محمد عبدالعظيم', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-008' },
  { id: 'st_9a_9', name: 'مروان محمود محمد المغربي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-009' },
  { id: 'st_9a_10', name: 'معتصم باهلل احمد محمد متولي', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-010' },
  { id: 'st_9a_11', name: 'يوسف شعبان صابر عبد العزيز', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-011' },
  { id: 'st_9a_12', name: 'اياد احمد محمد طلعت', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-012' },
  { id: 'st_9a_13', name: 'انس شريف صلاح محمد', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-013' },
  { id: 'st_9a_14', name: 'عمر هشام السيد رضوان', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-014' },
  { id: 'st_9a_15', name: 'عبدالله عمرو رزق', classId: 'class_gr9___a', track: 'english', studentCode: 'GR9-A-015' }
];

export const DEFAULT_SESSIONS: ClassSession[] = [];

const memoryStore: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // fallback
      }
    }
    return memoryStore[key] || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // fallback
      }
    }
    memoryStore[key] = value;
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // fallback
      }
    }
    delete memoryStore[key];
  },
};

export function sanitizeSoleTeacherList(teachers?: TeacherProfile[]): TeacherProfile[] {
  const defaultBadawi = DEFAULT_TEACHERS[0];
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return [defaultBadawi];
  }
  const found =
    teachers.find((t) => t && (t.id === 'teacher_ahmed_badawi' || (t.name || '').includes('بدوي'))) ||
    teachers[0];

  const cleanSchedule =
    Array.isArray(found?.weeklySchedule) && found.weeklySchedule.length > 0
      ? applyAhmedBadawiScheduleTrackRules(found.weeklySchedule)
      : AHMED_BADAWI_OFFICIAL_SCHEDULE;

  return [
    {
      ...defaultBadawi,
      ...found,
      id: 'teacher_ahmed_badawi',
      name: 'مستر احمد بدوي',
      subject: 'الرياضيات (Math)',
      schoolName: found?.schoolName || 'مدرسة اللغات الحديثة',
      email: 'ahmedbadawi5090@gmail.com',
      assignedClassIds:
        Array.isArray(found?.assignedClassIds) && found.assignedClassIds.length > 0
          ? found.assignedClassIds
          : defaultBadawi.assignedClassIds,
      weeklySchedule: cleanSchedule,
    },
  ];
}

export const storage = {
  getTeachers: (): TeacherProfile[] => {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.TEACHERS);
      if (data) {
        const parsed = JSON.parse(data);
        const sanitized = sanitizeSoleTeacherList(parsed);
        safeStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(sanitized));
        return sanitized;
      }
    } catch {
      // ignore
    }
    safeStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(DEFAULT_TEACHERS));
    return DEFAULT_TEACHERS;
  },

  saveTeachers: (teachers: TeacherProfile[]) => {
    const sanitized = sanitizeSoleTeacherList(teachers);
    safeStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(sanitized));
  },

  getCurrentTeacherId: (): string => 'teacher_ahmed_badawi',

  setCurrentTeacherId: (_id: string) => {
    safeStorage.setItem(STORAGE_KEYS.CURRENT_TEACHER_ID, 'teacher_ahmed_badawi');
  },

  getClasses: (): SchoolClass[] => {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.CLASSES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    safeStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
    return DEFAULT_CLASSES;
  },

  saveClasses: (classes: SchoolClass[]) => {
    safeStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.isArray(classes) ? classes : DEFAULT_CLASSES));
  },

  getStudents: (): Student[] => {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const enforced = enforceOfficialStudentTracks(parsed);
          safeStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(enforced));
          return enforced;
        }
      }
    } catch {
      // ignore
    }
    const cleanDefaults = enforceOfficialStudentTracks(DEFAULT_STUDENTS);
    safeStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cleanDefaults));
    return cleanDefaults;
  },

  saveStudents: (students: Student[]) => {
    const enforced = enforceOfficialStudentTracks(students);
    safeStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(enforced));
  },

  getDeletedSessionIds: (): Set<string> => {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.DELETED_SESSIONS);
      if (data) {
        const arr = JSON.parse(data);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set<string>();
  },

  addDeletedSessionId: (id: string) => {
    if (!id) return;
    const current = storage.getDeletedSessionIds();
    current.add(id);
    safeStorage.setItem(STORAGE_KEYS.DELETED_SESSIONS, JSON.stringify(Array.from(current)));
  },

  addDeletedSessionIds: (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const current = storage.getDeletedSessionIds();
    ids.forEach((id) => id && current.add(id));
    safeStorage.setItem(STORAGE_KEYS.DELETED_SESSIONS, JSON.stringify(Array.from(current)));
  },

  isSessionDeleted: (id: string): boolean => {
    if (!id) return false;
    return storage.getDeletedSessionIds().has(id);
  },

  clearDeletedSessionId: (id: string) => {
    if (!id) return;
    const current = storage.getDeletedSessionIds();
    if (current.has(id)) {
      current.delete(id);
      safeStorage.setItem(STORAGE_KEYS.DELETED_SESSIONS, JSON.stringify(Array.from(current)));
    }
  },

  getSessions: (): ClassSession[] => {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (data) {
        const parsed: ClassSession[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const deleted = storage.getDeletedSessionIds();
          return parsed
            .filter((s) => s && s.id && !deleted.has(s.id))
            .map((s) => ({
              ...s,
              teacherId: 'teacher_ahmed_badawi',
              attendance: Array.isArray(s.attendance) ? s.attendance : [],
            }));
        }
      }
    } catch {
      // ignore
    }
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEFAULT_SESSIONS));
    return DEFAULT_SESSIONS;
  },

  saveSessions: (sessions: ClassSession[]) => {
    const deleted = storage.getDeletedSessionIds();
    const clean = (Array.isArray(sessions) ? sessions : [])
      .filter((s) => s && s.id && !deleted.has(s.id))
      .map((s) => ({
        ...s,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
      }));
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(clean));
  },

  getTeacherPin: (): string => {
    const saved = safeStorage.getItem(STORAGE_KEYS.TEACHER_PIN);
    if (!saved || saved === '1234') {
      safeStorage.setItem(STORAGE_KEYS.TEACHER_PIN, '123654');
      return '123654';
    }
    return saved;
  },

  saveTeacherPin: (pin: string) => {
    safeStorage.setItem(STORAGE_KEYS.TEACHER_PIN, pin);
  },

  isTeacherAuthenticated: (): boolean => {
    return safeStorage.getItem(STORAGE_KEYS.TEACHER_AUTH_TOKEN) === 'true';
  },

  setTeacherAuthenticated: (auth: boolean) => {
    safeStorage.setItem(STORAGE_KEYS.TEACHER_AUTH_TOKEN, auth ? 'true' : 'false');
  },

  resetToDefault: () => {
    safeStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(DEFAULT_TEACHERS));
    safeStorage.setItem(STORAGE_KEYS.CURRENT_TEACHER_ID, 'teacher_ahmed_badawi');
    safeStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
    safeStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(DEFAULT_STUDENTS));
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEFAULT_SESSIONS));
    safeStorage.setItem(STORAGE_KEYS.TEACHER_PIN, '123654');
  },
};

export const isAhmedBadawi = (teacher?: TeacherProfile | null): boolean => {
  if (!teacher) return true;
  return true;
};
