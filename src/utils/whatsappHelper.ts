import { ClassSession, SchoolClass, TeacherProfile } from '../types';
import { buildStudentAttendanceLink } from './urlHelper';
import { normalizeText } from './arabicFuzzy';

export const DEFAULT_REMINDER_TEMPLATE = `🔔 *تذكير بموعد حصة زوم المباشرة ({وقت_التذكير})*
━━━━━━━━━━━━━━━━━
📚 *الفصل:* {الفصل}
📖 *المادة / العنوان:* {المادة}
👤 *المعلم:* {المعلم}
⏰ *الموعد:* {الموعد}
🎯 *الفئة:* {الفئة}

🔗 *رابط زوم المباشر:*
{رابط_زوم}

📝 *تسجيل حضور الطالب الذكي:*
{رابط_الحضور}
━━━━━━━━━━━━━━━━━
_نرجو من جميع الطلاب الدخول فوراً عبر رابط الحضور لتسجيل أسمائهم والانتقال المباشر للحصة._`;

export function getTimingLabel(minutesBefore: number): string {
  if (minutesBefore <= 0) return 'الآن';
  if (minutesBefore === 1) return 'قبل دقيقة واحدة';
  if (minutesBefore === 2) return 'قبل دقيقتين';
  if (minutesBefore >= 3 && minutesBefore <= 10) return `قبل ${minutesBefore} دقائق`;
  return `قبل ${minutesBefore} دقيقة`;
}

export function getStatusLabel(minutesBefore: number): string {
  if (minutesBefore <= 0) return 'تبدأ الآن';
  if (minutesBefore === 1) return 'تبدأ بعد دقيقة واحدة';
  if (minutesBefore === 2) return 'تبدأ بعد دقيقتين';
  if (minutesBefore >= 3 && minutesBefore <= 10) return `تبدأ بعد ${minutesBefore} دقائق`;
  return `تبدأ بعد ${minutesBefore} دقيقة`;
}

export function formatTimeTo12Hour(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return 'مباشر الآن';
  const trimmed = timeStr.trim();
  if (
    trimmed === 'مباشر الآن' ||
    trimmed === 'مباشر' ||
    trimmed === 'الآن' ||
    trimmed === 'now' ||
    trimmed === 'Direct Now'
  ) {
    return 'مباشر الآن';
  }

  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|ص|م)?/i);
  if (!match) return trimmed;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = (match[3] || '').toLowerCase();

  let isPm = false;
  if (ampm) {
    isPm = ampm === 'pm' || ampm === 'م';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours = hours - 12;
  } else {
    isPm = hours >= 12;
    hours = hours % 12;
    if (hours === 0) hours = 12;
  }

  const formattedHours = String(hours).padStart(2, '0');
  const periodStr = isPm ? 'م' : 'ص';
  return `${formattedHours}:${minutes} ${periodStr}`;
}

export function buildWhatsAppReminderMessage(params: {
  session: ClassSession;
  schoolClass?: SchoolClass;
  teacher?: TeacherProfile;
  appUrl?: string;
  customTemplate?: string;
  minutesBefore?: number;
}): string {
  const { session, schoolClass, teacher, appUrl, customTemplate, minutesBefore = 5 } = params;
  const attendanceLink = buildStudentAttendanceLink(session, teacher, appUrl);
  const zoomUrl =
    session.zoomUrl ||
    teacher?.classZoomLinks?.[session.classId] ||
    schoolClass?.zoomUrl ||
    teacher?.defaultZoomLink ||
    'رابط زوم متاح داخل البوابة';

  const rawTimeStr = session.scheduledTime ? session.scheduledTime : 'مباشر الآن';
  const formattedTime12 = formatTimeTo12Hour(rawTimeStr);

  const trackLabel =
    session.targetTrack === 'english'
      ? 'مسار اللغات (English)'
      : session.targetTrack === 'arabic'
      ? 'المسار العربي (Arabic)'
      : 'عام لجميع الطلاب';
  const timingLabel = getTimingLabel(minutesBefore);
  const statusLabel = getStatusLabel(minutesBefore);

  const today = new Date();
  const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayDayName = daysArabic[today.getDay()] || '';
  const todayDateStr = today.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const schoolName = teacher?.schoolName || 'مدرسة اللغات الحديثة';
  const subjectTitle = session.sessionTitle || 'الرياضيات (Math)';
  const teacherName = 'مستر احمد بدوي';

  const variables: Record<string, string> = {
    'الفصل': session.className,
    'اسم_الفصل': session.className,
    'فصل': session.className,
    className: session.className,
    class: session.className,
    name: session.className,

    'المادة': subjectTitle,
    'اسم_المادة': subjectTitle,
    'الموضوع': subjectTitle,
    'عنوان_الحصة': subjectTitle,
    'درس': subjectTitle,
    'العنوان': subjectTitle,
    subject: subjectTitle,
    sessionTitle: subjectTitle,
    title: subjectTitle,

    'المعلم': teacherName,
    'اسم_المعلم': teacherName,
    'الاستاذ': teacherName,
    'أستاذ': teacherName,
    teacher: teacherName,
    teacherName: teacherName,

    'الموعد': formattedTime12,
    'الوقت': formattedTime12,
    'توقيت': formattedTime12,
    'موعد_الحصة': formattedTime12,
    'وقت_الحصة': formattedTime12,
    time: formattedTime12,
    scheduledTime: formattedTime12,

    'الفئة': trackLabel,
    'المسار': trackLabel,
    'المسار_الدراسي': trackLabel,
    'نوع_المسار': trackLabel,
    track: trackLabel,
    targetTrack: trackLabel,

    'رابط_زوم': zoomUrl,
    'رابط_زووم': zoomUrl,
    'رابط_زوم_المباشر': zoomUrl,
    'رابط_الاجتماع': zoomUrl,
    'زووم': zoomUrl,
    'زوم': zoomUrl,
    zoomUrl: zoomUrl,
    zoom: zoomUrl,

    'رابط_الحضور': attendanceLink,
    'رابط_التحضير': attendanceLink,
    'رابط_تحضير_الطلاب': attendanceLink,
    'رابط_تسجيل_الحضور': attendanceLink,
    'تسجيل_الحضور': attendanceLink,
    attendanceLink: attendanceLink,
    link: attendanceLink,

    'وقت_التذكير': timingLabel,
    'توقيت_التذكير': timingLabel,
    'المدة_المتبقية': timingLabel,
    'الوقت_المتبقي': timingLabel,
    timingLabel: timingLabel,
    reminderTime: timingLabel,
    time_before: timingLabel,
    'حالة_التذكير': statusLabel,
    'دقائق_التذكير': String(minutesBefore <= 0 ? 0 : minutesBefore),
    'عدد_الدقائق': String(minutesBefore <= 0 ? 0 : minutesBefore),
    minutesBefore: String(minutesBefore <= 0 ? 0 : minutesBefore),

    'تاريخ_اليوم': todayDateStr,
    'التاريخ': todayDateStr,
    'تاريخ': todayDateStr,
    'اليوم': todayDayName,
    date: todayDateStr,
    todayDate: todayDateStr,

    'المدرسة': schoolName,
    'اسم_المدرسة': schoolName,
    school: schoolName,
    schoolName: schoolName,
  };

  const templateToUse =
    customTemplate && customTemplate.trim()
      ? customTemplate.trim()
      : teacher?.whatsappConfig?.customMessageTemplate?.trim()
      ? teacher.whatsappConfig.customMessageTemplate.trim()
      : DEFAULT_REMINDER_TEMPLATE;

  let result = templateToUse;
  for (const [key, val] of Object.entries(variables)) {
    result = result.split(`{${key}}`).join(val);
    result = result.split(`{{${key}}}`).join(val);
  }

  return result;
}

export function sanitizeWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    return '966' + cleaned.substring(1);
  }
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '20' + cleaned.substring(1);
  }
  return cleaned;
}

export function sanitizeWhatsAppRecipient(recipient: string): string {
  if (!recipient) return '';
  const trimmed = recipient.trim();
  if (
    trimmed.includes('chat.whatsapp.com') ||
    trimmed.includes('@g.us') ||
    trimmed.includes('@c.us') ||
    trimmed.startsWith('1203')
  ) {
    return trimmed;
  }
  return sanitizeWhatsAppPhone(trimmed);
}

/**
 * Strictly retrieves WhatsApp recipients configured exclusively for the exact target class.
 * Never matches substrings or unrelated classes.
 */
export function getClassWhatsAppRecipients(
  schoolClass?: SchoolClass,
  teacher?: TeacherProfile
): { recipient: string; recipientType: 'phone' | 'group'; name?: string }[] {
  const result: { recipient: string; recipientType: 'phone' | 'group'; name?: string }[] = [];
  const seen = new Set<string>();

  const addRecipient = (rec: string, type?: 'phone' | 'group', name?: string) => {
    if (!rec || !rec.trim()) return;
    const clean = rec.trim();
    if (seen.has(clean)) return;
    seen.add(clean);
    const inferredType =
      type ||
      (clean.includes('chat.whatsapp.com') || clean.includes('@g.us') || clean.startsWith('1203')
        ? 'group'
        : 'phone');
    result.push({ recipient: clean, recipientType: inferredType, name });
  };

  if (schoolClass) {
    if (Array.isArray(schoolClass.whatsappGroups)) {
      for (const grp of schoolClass.whatsappGroups) {
        if (grp && grp.recipient) {
          addRecipient(grp.recipient, grp.recipientType, grp.name);
        }
      }
    }

    if (schoolClass.whatsappRecipient?.trim()) {
      const splits = schoolClass.whatsappRecipient
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const item of splits) {
        addRecipient(item, schoolClass.whatsappRecipientType);
      }
    }
  }

  if (teacher && teacher.classWhatsAppGroups && schoolClass) {
    const classId = (schoolClass.id || '').trim();
    const className = (schoolClass.name || '').trim();
    const cleanClassName = className.toLowerCase().replace(/[\s\-_]+/g, '');
    const normClassName = normalizeText(className);

    for (const [key, val] of Object.entries(teacher.classWhatsAppGroups)) {
      if (!val || !key) continue;
      const trimmedKey = key.trim();
      const keyClean = trimmedKey.toLowerCase().replace(/[\s\-_]+/g, '');
      const normKey = normalizeText(trimmedKey);

      const isExactClassMatch =
        (classId !== '' && trimmedKey === classId) ||
        (className !== '' && trimmedKey.toLowerCase() === className.toLowerCase()) ||
        (cleanClassName !== '' && keyClean === cleanClassName) ||
        (normClassName !== '' && normKey === normClassName);

      if (isExactClassMatch) {
        if (Array.isArray(val)) {
          for (const g of val) {
            if (typeof g === 'string') addRecipient(g);
            else if (g && g.recipient) addRecipient(g.recipient, g.recipientType, g.name);
          }
        } else if (typeof val === 'string') {
          addRecipient(val);
        }
      }
    }
  }

  return result;
}

export function buildWhatsAppChatUrl(recipient: string, message: string): string {
  const trimmed = recipient ? recipient.trim() : '';
  const encodedMsg = encodeURIComponent(message);

  if (trimmed.includes('chat.whatsapp.com/')) {
    let groupUrl = trimmed;
    if (!groupUrl.startsWith('http://') && !groupUrl.startsWith('https://')) {
      groupUrl = `https://${groupUrl}`;
    }
    return groupUrl;
  }

  const sanitized = sanitizeWhatsAppPhone(trimmed);
  if (sanitized && sanitized.length >= 8) {
    return `https://api.whatsapp.com/send?phone=${sanitized}&text=${encodedMsg}`;
  }

  return `https://api.whatsapp.com/send?text=${encodedMsg}`;
}

export async function openWhatsAppDirectly(
  recipient: string,
  message: string
): Promise<{ success: boolean; isGroup: boolean; copiedToClipboard: boolean; note: string }> {
  const trimmed = (recipient || '').trim();
  const isGroupLink = trimmed.includes('chat.whatsapp.com/');
  let copiedToClipboard = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(message);
      copiedToClipboard = true;
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copiedToClipboard = true;
    }
  } catch {
    // ignore clipboard errors
  }

  const targetUrl = buildWhatsAppChatUrl(trimmed, message);

  try {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // ignore navigation errors
  }

  if (isGroupLink) {
    return {
      success: true,
      isGroup: true,
      copiedToClipboard,
      note: copiedToClipboard
        ? '📋 تم نسخ نص التذكير للحافظة تلقائياً! اضغط لصق (Paste) بداخل جروب الفصل المربوط لإرساله.'
        : 'جارٍ فتح جروب الفصل على الواتساب...',
    };
  }

  return {
    success: true,
    isGroup: false,
    copiedToClipboard,
    note: 'جارٍ فتح المحادثة على الواتساب مع كتابة نص الرسالة تلقائياً...',
  };
}
