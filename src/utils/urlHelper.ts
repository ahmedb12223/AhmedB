import { ClassSession, TeacherProfile, LanguageTrack } from '../types';

export function ensureAbsoluteUrl(url?: string | null): string {
  if (!url) return 'https://zoom.us';
  const trimmed = url.trim();
  if (!trimmed) return 'https://zoom.us';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const STORAGE_KEY_PUBLISHED_DOMAIN = 'zoom_attendance_published_domain_v5';
export const PUBLIC_VERCEL_DOMAIN = 'https://zoom2000.vercel.app';

export function getActiveSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    let origin = window.location.origin.replace(/\/+$/, '');
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  }
  return '';
}

export const DEFAULT_PUBLISHED_DOMAIN = getActiveSiteOrigin();

export function ensureAbsoluteDomain(domain?: string): string {
  const currentOrigin = getActiveSiteOrigin();
  let cleaned = (domain || '').trim().replace(/\/+$/, '');
  if (!cleaned) {
    return currentOrigin;
  }
  if (cleaned.includes('ais-dev-')) {
    cleaned = cleaned.replace('ais-dev-', 'ais-pre-');
  }
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
}

export function isInternalPlatformOrigin(origin?: string): boolean {
  if (!origin) return false;
  return origin.includes('localhost:');
}

export function getPublishedDomain(): string {
  const currentOrigin = getActiveSiteOrigin();
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PUBLISHED_DOMAIN);
      if (saved && saved.trim()) {
        return ensureAbsoluteDomain(saved);
      }
    } catch {
      // ignore
    }
  }
  return currentOrigin;
}

export function setPublishedDomain(domain: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = (domain || '').trim();
    if (!cleaned) {
      window.localStorage.removeItem(STORAGE_KEY_PUBLISHED_DOMAIN);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY_PUBLISHED_DOMAIN, ensureAbsoluteDomain(cleaned));
  } catch {
    // ignore
  }
}

export function buildRelativeAttendanceUrl(
  session: ClassSession,
  _teacher?: TeacherProfile
): string {
  const cleanZoomUrl = ensureAbsoluteUrl(session.zoomUrl);
  const params = new URLSearchParams();
  params.set('attend', session.id);
  params.set('cid', session.classId || 'class_auto');
  params.set('cls', session.className || 'الفصل');
  params.set('title', session.sessionTitle || 'حصة الرياضيات (Math)');
  params.set('zoom', cleanZoomUrl);
  params.set('trk', session.targetTrack || 'all');
  params.set('t', 'مستر احمد بدوي');
  params.set('sub', 'الرياضيات (Math)');
  params.set('tid', 'teacher_ahmed_badawi');

  return `/?${params.toString()}#attend/${encodeURIComponent(session.id)}`;
}

export function buildStudentAttendanceLink(
  session: ClassSession,
  teacher?: TeacherProfile,
  customDomain?: string
): string {
  const targetDomain = customDomain ? ensureAbsoluteDomain(customDomain) : getPublishedDomain();
  const baseDomain = (targetDomain || getActiveSiteOrigin()).replace(/\/+$/, '');
  const relativePart = buildRelativeAttendanceUrl(session, teacher);
  return `${baseDomain}${relativePart}`;
}

export interface ParsedAttendanceInfo {
  isAttendanceMode: boolean;
  sessionId: string | null;
  reconstructedSession: ClassSession | null;
  reconstructedTeacher: TeacherProfile | null;
}

export function parseAttendanceFromUrl(): ParsedAttendanceInfo {
  if (typeof window === 'undefined') {
    return {
      isAttendanceMode: false,
      sessionId: null,
      reconstructedSession: null,
      reconstructedTeacher: null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';

  const queryAttend = searchParams.get('attend') || searchParams.get('session');
  let hashAttend: string | null = null;
  if (hash.startsWith('#attend/')) {
    hashAttend = decodeURIComponent(hash.replace('#attend/', ''));
  } else if (hash.startsWith('#/attend/')) {
    hashAttend = decodeURIComponent(hash.replace('#/attend/', ''));
  }

  const sessionId = (queryAttend || hashAttend || '').trim();
  if (!sessionId) {
    return {
      isAttendanceMode: false,
      sessionId: null,
      reconstructedSession: null,
      reconstructedTeacher: null,
    };
  }

  const className = searchParams.get('cls') || 'الفصل';
  const sessionTitle = searchParams.get('title') || 'حصة الرياضيات (Math)';
  const classId = searchParams.get('cid') || 'class_auto';
  const zoomParam = searchParams.get('zoom');
  const zoomUrl = ensureAbsoluteUrl(zoomParam || 'https://zoom.us');
  const rawTrack = searchParams.get('trk');
  const targetTrack: LanguageTrack =
    rawTrack === 'english' || rawTrack === 'arabic' ? rawTrack : 'all';

  const reconstructedSession: ClassSession = {
    id: sessionId,
    teacherId: 'teacher_ahmed_badawi',
    classId,
    className,
    sessionTitle,
    zoomUrl,
    targetTrack,
    createdAt: new Date().toISOString(),
    scheduledTime: 'مباشر الآن',
    isActive: true,
    attendance: [],
  };

  const reconstructedTeacher: TeacherProfile = {
    id: 'teacher_ahmed_badawi',
    name: 'مستر احمد بدوي',
    subject: 'الرياضيات (Math)',
    schoolName: 'مدرسة اللغات الحديثة',
    email: 'ahmedbadawi5090@gmail.com',
    defaultZoomLink: zoomUrl,
    assignedClassIds: [classId],
  };

  return {
    isAttendanceMode: true,
    sessionId,
    reconstructedSession,
    reconstructedTeacher,
  };
}

export function clearAttendanceUrl(): void {
  if (typeof window === 'undefined') return;
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState(null, '', baseUrl);
}
