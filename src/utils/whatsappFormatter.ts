import { ClassSession, LanguageTrack, Student } from '../types';

export function getTrackLabel(track: LanguageTrack): string {
  switch (track) {
    case 'english':
      return 'مسار اللغات (English)';
    case 'arabic':
      return 'المسار العربي (Arabic)';
    case 'all':
    default:
      return 'جميع الطلاب (عربي ولغات)';
  }
}

export function formatArabicDate(dateObj = new Date()): string {
  try {
    return dateObj.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateObj.toDateString();
  }
}

export function generateRawAbsenteeNamesList(absentStudents: Student[]): string {
  if (absentStudents.length === 0) return 'لا يوجد غياب (نسبة الحضور 100%)';
  return absentStudents.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
}

export function generateWhatsAppAbsenteeReport(
  session: ClassSession,
  absentStudents: Student[],
  teacherName: string,
  subject: string,
  totalClassCount?: number,
  presentCount?: number
): string {
  const dateStr = formatArabicDate();
  const total = totalClassCount ?? (absentStudents.length + (session.attendance?.length || 0));
  const present = presentCount ?? (session.attendance?.length || 0);
  const absent = absentStudents.length;

  let message = ` المعلم: ${teacherName} \n`;
  message += `(${subject})\n`;
  message += `${session.className}\n`;
  message += `📅 التاريخ: ${dateStr}\n\n`;
  message += `👥 إجمالي الطلاب: ${total} | 🟢 الحضور: ${present} | 🔴 الغياب: ${absent}\n`;
  message += `❌ *أسماء الطلاب الغائبين:*\n`;

  if (absentStudents.length === 0) {
    message += `  ✨ لا يوجد غياب (حضور 100%)\n`;
  } else {
    absentStudents.forEach((student, index) => {
      const trackLabel = student.track === 'english' ? 'لغات' : 'عربي';
      message += `  ${index + 1}. ${student.name} (${trackLabel})\n`;
    });
  }

  return message;
}

export function generateCombinedTeacherAbsenteeReport(
  teacherName: string,
  subject: string,
  sessions: ClassSession[],
  allStudents: Student[]
): string {
  const dateStr = formatArabicDate();
  let message = ` المعلم: ${teacherName} \n`;
  message += `(${subject})\n`;
  message += `📅 التاريخ: ${dateStr}\n\n`;

  if (sessions.length === 0) {
    message += `لا توجد حصص مسجلة حالياً للمعلم.`;
    return message;
  }

  sessions.forEach((session, idx) => {
    const classStudents = allStudents.filter((s) => {
      if (s.classId !== session.classId) return false;
      if (session.targetTrack === 'all') return true;
      return s.track === session.targetTrack;
    });

    const presentStudentIds = new Set(
      session.attendance.filter((r) => r.studentId).map((r) => r.studentId)
    );
    const absentStudents = classStudents.filter((s) => !presentStudentIds.has(s.id));

    const total = classStudents.length;
    const present = session.attendance.length;
    const absent = absentStudents.length;

    message += `📚 *فصل ${session.className}*\n`;
    message += `👥 إجمالي الطلاب: ${total} | 🟢 الحضور: ${present} | 🔴 الغياب: ${absent}\n`;
    message += `❌ *أسماء الطلاب الغائبين:*\n`;

    if (absentStudents.length === 0) {
      message += `  ✨ لا يوجد غياب (حضور 100%)\n`;
    } else {
      absentStudents.forEach((student, index) => {
        const trackLabel = student.track === 'english' ? 'لغات' : 'عربي';
        message += `  ${index + 1}. ${student.name} (${trackLabel})\n`;
      });
    }

    if (idx < sessions.length - 1) {
      message += `\n─────────────────────\n\n`;
    }
  });

  return message;
}
