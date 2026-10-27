import {
  SchoolClass,
  Student,
  ClassSession,
  AttendanceRecord,
  TeacherProfile,
  SchedulePeriod,
  WhatsAppSendLog,
  WhatsAppGroupConfig,
} from '../types';
import {
  storage,
  DEFAULT_TEACHERS,
  DEFAULT_CLASSES,
  AHMED_BADAWI_OFFICIAL_SCHEDULE,
  enforceOfficialStudentTracks,
  applyAhmedBadawiScheduleTrackRules,
  sanitizeSoleTeacherList,
} from './storage';
import { findBestMatch, normalizeText } from './arabicFuzzy';
import { getPublishedDomain } from './urlHelper';
import {
  buildWhatsAppReminderMessage,
  DEFAULT_REMINDER_TEMPLATE,
  getClassWhatsAppRecipients,
} from './whatsappHelper';
import {
  recordAttendanceInFirestore,
  clearAttendanceInFirestore,
  saveAppData,
  saveSingleSessionToFirestore,
  deleteSessionFromFirestore,
  batchDeleteSessionsFromFirestore,
} from './firebase';

const STORAGE_KEY_BACKEND_URL = 'zoom_attendance_backend_url_v5';
const STORAGE_KEY_WA_SESSION = 'zoom_whatsapp_local_session_v5';
const STORAGE_KEY_WA_LOGS = 'zoom_whatsapp_local_logs_v5';

export interface WhatsAppLiveStatus {
  status: 'disconnected' | 'initializing' | 'qr_ready' | 'pairing_code_ready' | 'authenticated' | 'connected' | 'error';
  qrDataUrl: string | null;
  pairingCode?: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  autoRemindEnabled: boolean;
  reminderMinutesBefore?: number;
  customTemplate?: string;
  customMessageTemplate?: string;
  sentCount: number;
  provider?: 'baileys' | 'cloud_api' | 'webhook' | 'green_api' | 'ultramsg' | 'direct_link';
  cloudPhoneNumberId?: string;
  hasCloudToken?: boolean;
  webhookUrl?: string;
  instanceId?: string;
  hasApiToken?: boolean;
}

export interface ServerDataResponse {
  teachers: TeacherProfile[];
  currentTeacherId?: string;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  deletedSessionIds?: string[];
  teacherPin: string;
  whatsappLogs?: WhatsAppSendLog[];
  whatsappSession?: Partial<WhatsAppLiveStatus>;
  publishedDomain?: string;
}

export function getCustomBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem(STORAGE_KEY_BACKEND_URL) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setCustomBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = (url || '').trim().replace(/\/+$/, '');
    if (!cleaned) {
      window.localStorage.removeItem(STORAGE_KEY_BACKEND_URL);
    } else {
      window.localStorage.setItem(STORAGE_KEY_BACKEND_URL, cleaned);
    }
  } catch {
    // ignore
  }
}

export function getApiUrl(path: string): string {
  const custom = getCustomBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return custom ? `${custom}${normalizedPath}` : normalizedPath;
}

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

export function hasPendingOfflineChanges(): boolean {
  return false;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/health'), { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function testStudentAttendanceConnectionAndRetry(): Promise<{
  connected: boolean;
  flushedCount: number;
  pendingCount: number;
  mode: 'live_api' | 'cloud_relay' | 'offline';
  message: string;
}> {
  const connected = await checkDatabaseConnection();
  return {
    connected,
    flushedCount: 0,
    pendingCount: 0,
    mode: connected ? 'live_api' : 'offline',
    message: connected
      ? 'تم الاتصال المباشر بخادم الحضور الموحد بنجاح!'
      : 'تعذر الاتصال بالخادم حالياً، يرجى التحقق من اتصال الإنترنت.',
  };
}

/**
 * Strictly merges attendance records for a SINGLE session without cross-session bleed.
 */
export function mergeAttendanceRecordsClient(
  existing: AttendanceRecord[] = [],
  incoming: AttendanceRecord[] = [],
  lastResetAt?: string
): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();
  const resetTime = lastResetAt ? new Date(lastResetAt).getTime() : 0;

  const getKey = (rec: AttendanceRecord): string => {
    if (rec.studentId) return `id:${rec.studentId}`;
    const norm = normalizeText(rec.matchedRosterName || rec.studentName || '');
    if (norm) return `name:${norm}`;
    return `raw:${rec.id}`;
  };

  for (const r of [...existing, ...incoming]) {
    if (!r) continue;
    if (resetTime > 0) {
      const recTime = new Date(r.lastJoinedAt || r.timestamp || 0).getTime();
      if (!isNaN(recTime) && recTime < resetTime) continue;
    }
    const key = getKey(r);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r, joinCount: typeof r.joinCount === 'number' ? r.joinCount : 1 });
    } else {
      const prevCount = typeof prev.joinCount === 'number' ? prev.joinCount : 1;
      const incCount = typeof r.joinCount === 'number' ? r.joinCount : 1;
      const prevJoin = prev.lastJoinedAt || prev.timestamp || '';
      const incJoin = r.lastJoinedAt || r.timestamp || '';
      map.set(key, {
        ...prev,
        ...r,
        timestamp:
          prev.timestamp && r.timestamp
            ? prev.timestamp < r.timestamp
              ? prev.timestamp
              : r.timestamp
            : prev.timestamp || r.timestamp,
        lastJoinedAt: incJoin > prevJoin ? incJoin : prevJoin,
        joinCount: Math.max(prevCount, incCount),
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Strictly merges session arrays by exact session.id, respecting deletedSessionIds.
 */
export function mergeSessionArrays(
  localSessions: ClassSession[] = [],
  remoteSessions: ClassSession[] = []
): ClassSession[] {
  const deletedSet = storage.getDeletedSessionIds();
  const map = new Map<string, ClassSession>();

  for (const s of localSessions) {
    if (!s || !s.id || deletedSet.has(s.id)) continue;
    map.set(s.id, {
      ...s,
      teacherId: 'teacher_ahmed_badawi',
      attendance: Array.isArray(s.attendance) ? s.attendance : [],
    });
  }

  for (const r of remoteSessions) {
    if (!r || !r.id || deletedSet.has(r.id)) continue;
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, {
        ...r,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(r.attendance) ? r.attendance : [],
      });
    } else {
      const effectiveReset =
        existing.lastAttendanceResetAt && r.lastAttendanceResetAt
          ? existing.lastAttendanceResetAt > r.lastAttendanceResetAt
            ? existing.lastAttendanceResetAt
            : r.lastAttendanceResetAt
          : existing.lastAttendanceResetAt || r.lastAttendanceResetAt;

      map.set(r.id, {
        ...existing,
        ...r,
        id: r.id,
        teacherId: 'teacher_ahmed_badawi',
        lastAttendanceResetAt: effectiveReset,
        attendance: mergeAttendanceRecordsClient(
          existing.attendance || [],
          r.attendance || [],
          effectiveReset
        ),
      });
    }
  }

  return Array.from(map.values());
}

export async function fetchServerData(): Promise<ServerDataResponse | null> {
  try {
    const res = await fetch(getApiUrl(`/api/data?t=${Date.now()}`), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    if (Array.isArray(data.deletedSessionIds) && data.deletedSessionIds.length > 0) {
      storage.addDeletedSessionIds(data.deletedSessionIds);
    }
    const deletedSet = storage.getDeletedSessionIds();

    const cleanTeachers = sanitizeSoleTeacherList(data.teachers);
    const cleanClasses =
      Array.isArray(data.classes) && data.classes.length > 0 ? data.classes : storage.getClasses();
    const cleanStudents = enforceOfficialStudentTracks(
      Array.isArray(data.students) && data.students.length > 0 ? data.students : storage.getStudents()
    );
    const cleanSessions = (Array.isArray(data.sessions) ? data.sessions : [])
      .filter((s: ClassSession) => s && s.id && !deletedSet.has(s.id))
      .map((s: ClassSession) => ({
        ...s,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
      }));

    return {
      teachers: cleanTeachers,
      currentTeacherId: 'teacher_ahmed_badawi',
      classes: cleanClasses,
      students: cleanStudents,
      sessions: cleanSessions,
      deletedSessionIds: Array.from(deletedSet),
      teacherPin: data.teacherPin || '123654',
      whatsappLogs: Array.isArray(data.whatsappLogs) ? data.whatsappLogs : [],
    };
  } catch {
    return null;
  }
}

export async function fetchServerSessions(): Promise<ClassSession[] | null> {
  try {
    const res = await fetch(getApiUrl(`/api/sessions?t=${Date.now()}`), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.sessions)) return null;

    if (Array.isArray(data.deletedSessionIds) && data.deletedSessionIds.length > 0) {
      storage.addDeletedSessionIds(data.deletedSessionIds);
    }
    const deletedSet = storage.getDeletedSessionIds();

    return data.sessions
      .filter((s: ClassSession) => s && s.id && !deletedSet.has(s.id))
      .map((s: ClassSession) => ({
        ...s,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
      }));
  } catch {
    return null;
  }
}

export async function fetchSingleSessionFromServer(sessionId: string): Promise<ClassSession | null> {
  if (!sessionId || storage.isSessionDeleted(sessionId)) return null;
  try {
    const res = await fetch(
      getApiUrl(`/api/sessions/${encodeURIComponent(sessionId)}?t=${Date.now()}`),
      { cache: 'no-store', headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.session && data.session.id === sessionId) {
      return {
        ...data.session,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(data.session.attendance) ? data.session.attendance : [],
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function syncStateToServer(payload: {
  teachers?: TeacherProfile[];
  currentTeacherId?: string;
  classes?: SchoolClass[];
  students?: Student[];
  sessions?: ClassSession[];
  teacherPin?: string;
  whatsappSession?: any;
  publishedDomain?: string;
}): Promise<boolean> {
  const deletedSet = storage.getDeletedSessionIds();
  const cleanPayload: any = {
    deletedSessionIds: Array.from(deletedSet),
    currentTeacherId: 'teacher_ahmed_badawi',
  };

  if (payload.teachers) {
    cleanPayload.teachers = sanitizeSoleTeacherList(payload.teachers);
    storage.saveTeachers(cleanPayload.teachers);
  }
  if (payload.classes) {
    cleanPayload.classes = payload.classes;
    storage.saveClasses(payload.classes);
  }
  if (payload.students) {
    cleanPayload.students = enforceOfficialStudentTracks(payload.students);
    storage.saveStudents(cleanPayload.students);
  }
  if (payload.sessions) {
    cleanPayload.sessions = payload.sessions
      .filter((s) => s && s.id && !deletedSet.has(s.id))
      .map((s) => ({
        ...s,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
      }));
    storage.saveSessions(cleanPayload.sessions);
    saveAppData({ sessions: cleanPayload.sessions }).catch(() => {});
  }
  if (payload.teacherPin) {
    cleanPayload.teacherPin = payload.teacherPin;
    storage.saveTeacherPin(payload.teacherPin);
  }

  try {
    const res = await fetch(getApiUrl('/api/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createOrUpdateSessionOnServer(session: ClassSession): Promise<boolean> {
  if (!session || !session.id) return false;
  storage.clearDeletedSessionId(session.id);

  const normalizedSession: ClassSession = {
    ...session,
    teacherId: 'teacher_ahmed_badawi',
    attendance: Array.isArray(session.attendance) ? session.attendance : [],
  };

  const localSessions = storage.getSessions();
  const exists = localSessions.some((s) => s.id === normalizedSession.id);
  const updatedLocal = exists
    ? localSessions.map((s) => (s.id === normalizedSession.id ? normalizedSession : s))
    : [normalizedSession, ...localSessions];
  storage.saveSessions(updatedLocal);
  saveSingleSessionToFirestore(normalizedSession, updatedLocal).catch(() => {});

  try {
    const res = await fetch(getApiUrl('/api/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: normalizedSession }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Records student attendance strictly for the target sessionId.
 * Supports both positional arguments and object parameter for full compatibility.
 */
export async function recordAttendanceViaServer(
  sessionIdOrParams:
    | string
    | {
        sessionId: string;
        studentName: string;
        studentId?: string;
        deviceFingerprint?: string;
        sessionDetails?: Partial<ClassSession>;
      },
  studentNameArg?: string,
  matchedStudentArg?: Student,
  _confidenceArg?: number,
  sessionDetailsArg?: Partial<ClassSession>
): Promise<{
  success: boolean;
  record: AttendanceRecord;
  session: ClassSession | null;
  alreadyRecorded: boolean;
  isReentry: boolean;
}> {
  const sessionId =
    typeof sessionIdOrParams === 'string' ? sessionIdOrParams : sessionIdOrParams.sessionId;
  const studentName =
    typeof sessionIdOrParams === 'string'
      ? studentNameArg || ''
      : sessionIdOrParams.studentName || '';
  const studentId =
    typeof sessionIdOrParams === 'string' ? matchedStudentArg?.id : sessionIdOrParams.studentId;
  const deviceFingerprint =
    typeof sessionIdOrParams === 'string'
      ? 'student_gateway'
      : sessionIdOrParams.deviceFingerprint || 'student_gateway';
  const sessionDetails =
    typeof sessionIdOrParams === 'string' ? sessionDetailsArg : sessionIdOrParams.sessionDetails;

  const trimmedName = (studentName || '').trim();
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch(getApiUrl('/api/attendance'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        studentName: trimmedName,
        studentId,
        deviceFingerprint,
        sessionDetails: sessionDetails
          ? { ...sessionDetails, id: sessionId, teacherId: 'teacher_ahmed_badawi' }
          : { id: sessionId, teacherId: 'teacher_ahmed_badawi' },
      }),
      keepalive: true,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.record) {
        const serverRecord: AttendanceRecord = {
          ...data.record,
          sessionId,
        };
        const serverSession: ClassSession | null = data.session
          ? { ...data.session, id: sessionId, teacherId: 'teacher_ahmed_badawi' }
          : null;

        const currentSessions = storage.getSessions();
        if (serverSession) {
          const exists = currentSessions.some((s) => s.id === sessionId);
          const nextSessions = exists
            ? currentSessions.map((s) => (s.id === sessionId ? serverSession : s))
            : [serverSession, ...currentSessions];
          storage.saveSessions(nextSessions);
        }

        await recordAttendanceInFirestore(sessionId, serverRecord, {
          classId: serverSession?.classId || sessionDetails?.classId,
          className: serverSession?.className || sessionDetails?.className,
          sessionTitle: serverSession?.sessionTitle || sessionDetails?.sessionTitle,
          zoomUrl: serverSession?.zoomUrl || sessionDetails?.zoomUrl,
          targetTrack: serverSession?.targetTrack || sessionDetails?.targetTrack,
          teacherId: 'teacher_ahmed_badawi',
        });

        broadcastSyncEvent('ATTENDANCE_RECORDED', {
          sessionId,
          record: serverRecord,
          session: serverSession,
        });

        const already = Boolean(data.alreadyRecorded);
        return {
          success: true,
          record: serverRecord,
          session: serverSession,
          alreadyRecorded: already,
          isReentry: already,
        };
      }
    }
  } catch {
    // Fallback to local recording if server is temporarily unreachable
  }

  const localSessions = storage.getSessions();
  const localStudents = storage.getStudents();
  let targetSession = localSessions.find((s) => s.id === sessionId) || null;

  if (!targetSession && sessionDetails) {
    targetSession = {
      id: sessionId,
      teacherId: 'teacher_ahmed_badawi',
      classId: sessionDetails.classId || 'class_auto',
      className: sessionDetails.className || 'الفصل',
      sessionTitle: sessionDetails.sessionTitle || 'حصة الرياضيات (Math)',
      zoomUrl: sessionDetails.zoomUrl || 'https://zoom.us',
      targetTrack: sessionDetails.targetTrack || 'all',
      createdAt: nowIso,
      scheduledTime: sessionDetails.scheduledTime || 'مباشر الآن',
      isActive: true,
      attendance: [],
    };
  }

  const classId = targetSession?.classId || sessionDetails?.classId || '';
  const classRoster = localStudents.filter((st) => st.classId === classId);

  let matchedStudent: Student | undefined = matchedStudentArg;
  let matchConfidence = matchedStudent ? 1 : 0;

  if (!matchedStudent && studentId) {
    matchedStudent = classRoster.find((st) => st.id === studentId);
    if (matchedStudent) matchConfidence = 1;
  }

  if (!matchedStudent && classRoster.length > 0) {
    const fuzzy = findBestMatch(
      trimmedName,
      classRoster.map((st) => ({ id: st.id, name: st.name })),
      0.75
    );
    if (fuzzy) {
      matchedStudent = classRoster.find((st) => st.id === fuzzy.id);
      matchConfidence = fuzzy.similarity;
    }
  }

  const existingAttendance = targetSession?.attendance || [];
  const existingRecord = existingAttendance.find(
    (a) =>
      (matchedStudent && a.studentId === matchedStudent.id) ||
      normalizeText(a.studentName) === normalizeText(trimmedName)
  );

  if (existingRecord) {
    const updatedRecord: AttendanceRecord = {
      ...existingRecord,
      sessionId,
      lastJoinedAt: nowIso,
      joinCount: (existingRecord.joinCount || 1) + 1,
    };
    if (targetSession) {
      const updatedSession: ClassSession = {
        ...targetSession,
        attendance: existingAttendance.map((a) => (a.id === existingRecord.id ? updatedRecord : a)),
      };
      const nextSessions = localSessions.some((s) => s.id === sessionId)
        ? localSessions.map((s) => (s.id === sessionId ? updatedSession : s))
        : [updatedSession, ...localSessions];
      storage.saveSessions(nextSessions);
      targetSession = updatedSession;
    }
    await recordAttendanceInFirestore(sessionId, updatedRecord, sessionDetails);
    broadcastSyncEvent('ATTENDANCE_RECORDED', {
      sessionId,
      record: updatedRecord,
      session: targetSession,
    });
    return {
      success: true,
      record: updatedRecord,
      session: targetSession,
      alreadyRecorded: true,
      isReentry: true,
    };
  }

  const newRecord: AttendanceRecord = {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    studentId: matchedStudent?.id,
    studentName: matchedStudent ? matchedStudent.name : trimmedName,
    matchedRosterName: matchedStudent?.name,
    track: matchedStudent?.track,
    matchConfidence: matchedStudent ? matchConfidence : 0,
    timestamp: nowIso,
    lastJoinedAt: nowIso,
    joinCount: 1,
    deviceFingerprint,
    status: 'present',
  };

  if (targetSession) {
    const updatedSession: ClassSession = {
      ...targetSession,
      attendance: [...existingAttendance, newRecord],
    };
    const nextSessions = localSessions.some((s) => s.id === sessionId)
      ? localSessions.map((s) => (s.id === sessionId ? updatedSession : s))
      : [updatedSession, ...localSessions];
    storage.saveSessions(nextSessions);
    targetSession = updatedSession;
  }

  await recordAttendanceInFirestore(sessionId, newRecord, sessionDetails);
  broadcastSyncEvent('ATTENDANCE_RECORDED', {
    sessionId,
    record: newRecord,
    session: targetSession,
  });

  return {
    success: true,
    record: newRecord,
    session: targetSession,
    alreadyRecorded: false,
    isReentry: false,
  };
}

export async function deleteSessionOnServer(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  storage.addDeletedSessionId(sessionId);
  const remaining = storage.getSessions().filter((s) => s.id !== sessionId);
  storage.saveSessions(remaining);
  await deleteSessionFromFirestore(sessionId);

  try {
    const res = await fetch(getApiUrl(`/api/sessions/${encodeURIComponent(sessionId)}`), {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function batchDeleteSessionsOnServer(sessionIds: string[]): Promise<boolean> {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return false;
  storage.addDeletedSessionIds(sessionIds);
  const idSet = new Set(sessionIds);
  const remaining = storage.getSessions().filter((s) => !idSet.has(s.id));
  storage.saveSessions(remaining);
  await batchDeleteSessionsFromFirestore(sessionIds);

  try {
    const res = await fetch(getApiUrl('/api/sessions/batch-delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resetAttendanceOnServer(
  _teacherId?: string
): Promise<{ success: boolean; sessions?: ClassSession[]; resetCount?: number }> {
  const nowIso = new Date().toISOString();
  const localSessions = storage.getSessions().map((s) => ({
    ...s,
    attendance: [],
    lastAttendanceResetAt: nowIso,
  }));
  storage.saveSessions(localSessions);
  await clearAttendanceInFirestore('teacher_ahmed_badawi');

  try {
    const res = await fetch(getApiUrl('/api/sessions/reset-attendance'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: 'teacher_ahmed_badawi' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        storage.saveSessions(data.sessions);
      }
      return {
        success: true,
        sessions: data?.sessions || localSessions,
        resetCount: data?.resetCount ?? localSessions.length,
      };
    }
  } catch {
    // ignore
  }
  return { success: true, sessions: localSessions, resetCount: localSessions.length };
}

export async function deleteClassOnServer(classId: string): Promise<boolean> {
  if (!classId) return false;
  const remainingClasses = storage.getClasses().filter((c) => c.id !== classId);
  storage.saveClasses(remainingClasses);

  try {
    const res = await fetch(getApiUrl(`/api/classes/${encodeURIComponent(classId)}`), {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function batchDeleteClassesOnServer(classIds: string[]): Promise<boolean> {
  if (!Array.isArray(classIds) || classIds.length === 0) return false;
  const idSet = new Set(classIds);
  const remaining = storage.getClasses().filter((c) => !idSet.has(c.id));
  storage.saveClasses(remaining);

  try {
    const res = await fetch(getApiUrl('/api/classes/batch-delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteStudentOnServer(studentId: string): Promise<boolean> {
  if (!studentId) return false;
  const remaining = storage.getStudents().filter((st) => st.id !== studentId);
  storage.saveStudents(remaining);

  try {
    const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(studentId)}`), {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function batchDeleteStudentsOnServer(studentIds: string[]): Promise<boolean> {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return false;
  const idSet = new Set(studentIds);
  const remaining = storage.getStudents().filter((st) => !idSet.has(st.id));
  storage.saveStudents(remaining);

  try {
    const res = await fetch(getApiUrl('/api/students/batch-delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function batchUpdateStudentsOnServer(
  studentIds: string[],
  updates: Partial<Student>
): Promise<{ success: boolean; students?: Student[] }> {
  const idSet = new Set(studentIds);
  const updated = storage.getStudents().map((st) => (idSet.has(st.id) ? { ...st, ...updates } : st));
  storage.saveStudents(updated);

  try {
    const res = await fetch(getApiUrl('/api/students/batch-update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIds, updates }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.students)) {
        storage.saveStudents(data.students);
        return { success: true, students: data.students };
      }
    }
  } catch {
    // ignore
  }
  return { success: true, students: updated };
}

export async function mergeDuplicateClassesOnServer(): Promise<{
  success: boolean;
  mergedCount: number;
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  teachers?: TeacherProfile[];
}> {
  try {
    const res = await fetch(getApiUrl('/api/classes/merge-duplicates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        mergedCount: data.mergedCount || 0,
        classes: data.classes || storage.getClasses(),
        students: data.students || storage.getStudents(),
        sessions: data.sessions || storage.getSessions(),
        teachers: sanitizeSoleTeacherList(data.teachers),
      };
    }
  } catch {
    // ignore
  }
  return {
    success: true,
    mergedCount: 0,
    classes: storage.getClasses(),
    students: storage.getStudents(),
    sessions: storage.getSessions(),
    teachers: storage.getTeachers(),
  };
}

export async function forceSyncBidirectional(localState: {
  teachers?: TeacherProfile[];
  currentTeacherId?: string;
  classes?: SchoolClass[];
  students?: Student[];
  sessions?: ClassSession[];
  teacherPin?: string;
  adminPassword?: string;
}): Promise<{
  success: boolean;
  structuralUpdateAccepted?: boolean;
  warning?: string;
  data: {
    teachers: TeacherProfile[];
    classes: SchoolClass[];
    students: Student[];
    sessions: ClassSession[];
    teacherPin: string;
  };
}> {
  const serverData = await fetchServerData();
  const cleanTeachers = sanitizeSoleTeacherList(
    serverData?.teachers && serverData.teachers.length > 0
      ? serverData.teachers
      : localState.teachers || storage.getTeachers()
  );
  const cleanClasses =
    serverData?.classes && serverData.classes.length > 0
      ? serverData.classes
      : localState.classes || storage.getClasses();
  const cleanStudents = enforceOfficialStudentTracks(
    serverData?.students && serverData.students.length > 0
      ? serverData.students
      : localState.students || storage.getStudents()
  );
  const mergedSessions = mergeSessionArrays(
    localState.sessions || storage.getSessions(),
    serverData?.sessions || []
  );
  const pin =
    serverData?.teacherPin ||
    localState.teacherPin ||
    localState.adminPassword ||
    storage.getTeacherPin();

  await syncStateToServer({
    teachers: cleanTeachers,
    classes: cleanClasses,
    students: cleanStudents,
    sessions: mergedSessions,
    teacherPin: pin,
  });

  return {
    success: true,
    structuralUpdateAccepted: true,
    data: {
      teachers: cleanTeachers,
      classes: cleanClasses,
      students: cleanStudents,
      sessions: mergedSessions,
      teacherPin: pin,
    },
  };
}

export async function parseScheduleWithAI(params: {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  teacherName?: string;
  defaultSubject?: string;
  existingClasses?: SchoolClass[];
}): Promise<{ success: boolean; schedule: SchedulePeriod[]; error?: string }> {
  try {
    const res = await fetch(getApiUrl('/api/schedule/parse-ai'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        teacherName: 'مستر احمد بدوي',
        defaultSubject: 'Math',
      }),
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.schedule)) {
      return {
        success: true,
        schedule: applyAhmedBadawiScheduleTrackRules(data.schedule),
      };
    }
    return {
      success: false,
      schedule: [],
      error: data?.error || 'تعذر تحليل الجدول بالذكاء الاصطناعي',
    };
  } catch (err: any) {
    return {
      success: false,
      schedule: [],
      error: err?.message || 'خطأ في الاتصال بالخادم',
    };
  }
}

export async function saveTeacherSchedule(
  _teacherId: string,
  weeklySchedule: SchedulePeriod[],
  classZoomLinks?: Record<string, string>,
  classWhatsAppGroups?: Record<string, string | WhatsAppGroupConfig[]>,
  defaultZoomLink?: string
): Promise<{ success: boolean; teacher?: TeacherProfile; classes?: SchoolClass[] }> {
  const cleanSchedule = applyAhmedBadawiScheduleTrackRules(weeklySchedule);
  const currentTeachers = storage.getTeachers();
  const badawi = currentTeachers[0] || DEFAULT_TEACHERS[0];

  const updatedTeacher: TeacherProfile = {
    ...badawi,
    id: 'teacher_ahmed_badawi',
    name: 'مستر احمد بدوي',
    subject: 'الرياضيات (Math)',
    weeklySchedule: cleanSchedule,
    classZoomLinks: classZoomLinks ?? badawi.classZoomLinks,
    classWhatsAppGroups: classWhatsAppGroups ?? badawi.classWhatsAppGroups,
    defaultZoomLink: defaultZoomLink !== undefined ? defaultZoomLink : badawi.defaultZoomLink,
  };

  storage.saveTeachers([updatedTeacher]);

  try {
    const res = await fetch(getApiUrl('/api/schedule/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: 'teacher_ahmed_badawi',
        weeklySchedule: cleanSchedule,
        classZoomLinks: updatedTeacher.classZoomLinks,
        classWhatsAppGroups: updatedTeacher.classWhatsAppGroups,
        defaultZoomLink: updatedTeacher.defaultZoomLink,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        teacher: data.teacher || updatedTeacher,
        classes: data.classes || storage.getClasses(),
      };
    }
  } catch {
    // ignore
  }

  return { success: true, teacher: updatedTeacher, classes: storage.getClasses() };
}

export async function saveTeacherWhatsAppGroups(
  _teacherId: string,
  classWhatsAppGroups: Record<string, string | WhatsAppGroupConfig[]>
): Promise<{ success: boolean; teacher?: TeacherProfile; classes?: SchoolClass[] }> {
  const currentTeachers = storage.getTeachers();
  const badawi = currentTeachers[0] || DEFAULT_TEACHERS[0];
  return saveTeacherSchedule(
    'teacher_ahmed_badawi',
    badawi.weeklySchedule || AHMED_BADAWI_OFFICIAL_SCHEDULE,
    badawi.classZoomLinks,
    classWhatsAppGroups,
    badawi.defaultZoomLink
  );
}

function findExactClassForPeriod(
  period: SchedulePeriod,
  classes: SchoolClass[]
): SchoolClass | undefined {
  if (period.classId) {
    const byId = classes.find((c) => c.id === period.classId);
    if (byId) return byId;
  }
  const pName = (period.className || '').trim();
  if (!pName) return undefined;

  const exactByName = classes.find((c) => c.name.trim().toLowerCase() === pName.toLowerCase());
  if (exactByName) return exactByName;

  const codeMatch = pName.match(/\b([4-9])\s*([AB])\b/i);
  if (codeMatch) {
    const targetCode = `gr${codeMatch[1]}${codeMatch[2]}`.toLowerCase();
    return classes.find((c) => c.name.toLowerCase().replace(/[\s\-_]+/g, '') === targetCode);
  }
  return undefined;
}

export function generateDailySessions(params: {
  teacher: TeacherProfile;
  classes: SchoolClass[];
  existingSessions: ClassSession[];
  dayOfWeek?: string;
}): { createdCount: number; updatedSessions: ClassSession[]; updatedClasses: SchoolClass[] } {
  const { teacher, classes, existingSessions, dayOfWeek } = params;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = (dayOfWeek || days[new Date().getDay()]).toLowerCase();
  const todayDatePrefix = new Date().toISOString().split('T')[0];

  const schedule = applyAhmedBadawiScheduleTrackRules(
    Array.isArray(teacher.weeklySchedule) && teacher.weeklySchedule.length > 0
      ? teacher.weeklySchedule
      : AHMED_BADAWI_OFFICIAL_SCHEDULE
  );

  const dayPeriods = schedule.filter((p) => (p.dayOfWeek || '').toLowerCase() === targetDay);
  if (dayPeriods.length === 0) {
    return { createdCount: 0, updatedSessions: existingSessions, updatedClasses: classes };
  }

  const nextSessions = [...existingSessions];
  let createdCount = 0;

  for (const period of dayPeriods) {
    const matchedClass = findExactClassForPeriod(period, classes);
    const classId = matchedClass?.id || period.classId || `class_${period.id}`;
    const className = matchedClass?.name || period.className;
    const deterministicId = `ses_${todayDatePrefix}_${period.id}`;

    if (storage.isSessionDeleted(deterministicId)) {
      continue;
    }

    const alreadyExists = nextSessions.some(
      (s) =>
        s.id === deterministicId ||
        (s.classId === classId &&
          s.scheduledTime === period.startTime &&
          (s.createdAt || '').startsWith(todayDatePrefix))
    );

    if (alreadyExists) continue;

    const zoomUrl =
      period.zoomUrl ||
      teacher.classZoomLinks?.[classId] ||
      matchedClass?.zoomUrl ||
      teacher.defaultZoomLink ||
      '';

    const newSession: ClassSession = {
      id: deterministicId,
      teacherId: 'teacher_ahmed_badawi',
      classId,
      className,
      sessionTitle: `الرياضيات (Math) - ${className}`,
      zoomUrl,
      targetTrack: period.targetTrack || 'all',
      createdAt: new Date().toISOString(),
      scheduledTime: period.startTime,
      isActive: true,
      attendance: [],
    };

    nextSessions.unshift(newSession);
    createdCount++;
  }

  return {
    createdCount,
    updatedSessions: nextSessions,
    updatedClasses: classes,
  };
}

export async function generateTodaySessionsOnServer(
  _teacherId?: string,
  dayOfWeek?: string
): Promise<{
  success: boolean;
  createdCount: number;
  sessions: ClassSession[];
  classes: SchoolClass[];
}> {
  const teacher = storage.getTeachers()[0] || DEFAULT_TEACHERS[0];
  const classes = storage.getClasses();
  const existingSessions = storage.getSessions();

  try {
    const res = await fetch(getApiUrl('/api/schedule/generate-today'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: 'teacher_ahmed_badawi',
        dayOfWeek,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        storage.saveSessions(data.sessions);
        return {
          success: true,
          createdCount: data.createdCount || 0,
          sessions: data.sessions,
          classes: data.classes || classes,
        };
      }
    }
  } catch {
    // fallback to local generation
  }

  const localGen = generateDailySessions({
    teacher,
    classes,
    existingSessions,
    dayOfWeek,
  });
  storage.saveSessions(localGen.updatedSessions);
  await syncStateToServer({ sessions: localGen.updatedSessions });

  return {
    success: true,
    createdCount: localGen.createdCount,
    sessions: localGen.updatedSessions,
    classes: localGen.updatedClasses,
  };
}

export function getLocalWhatsAppSession(): WhatsAppLiveStatus {
  const defaultState: WhatsAppLiveStatus = {
    status: 'connected',
    qrDataUrl: null,
    pairingCode: null,
    phoneNumber: 'مستر احمد بدوي',
    lastError: null,
    autoRemindEnabled: true,
    reminderMinutesBefore: 5,
    customTemplate: DEFAULT_REMINDER_TEMPLATE,
    customMessageTemplate: DEFAULT_REMINDER_TEMPLATE,
    sentCount: 0,
    provider: 'direct_link',
  };
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_WA_SESSION);
    if (raw) {
      return { ...defaultState, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

export function saveLocalWhatsAppSession(partial: Partial<WhatsAppLiveStatus>): WhatsAppLiveStatus {
  const merged = { ...getLocalWhatsAppSession(), ...partial };
  if (partial.customMessageTemplate && !partial.customTemplate) {
    merged.customTemplate = partial.customMessageTemplate;
  }
  if (partial.customTemplate && !partial.customMessageTemplate) {
    merged.customMessageTemplate = partial.customTemplate;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_WA_SESSION, JSON.stringify(merged));
    } catch {
      // ignore
    }
  }
  return merged;
}

export async function getWhatsAppStatus(): Promise<WhatsAppLiveStatus | null> {
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/status'), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return saveLocalWhatsAppSession(data);
    }
  } catch {
    // ignore
  }
  return getLocalWhatsAppSession();
}

export async function connectWhatsApp(phoneNumber?: string): Promise<WhatsAppLiveStatus | null> {
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/connect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });
    if (res.ok) {
      const data = await res.json();
      return saveLocalWhatsAppSession(data);
    }
  } catch {
    // ignore
  }
  return saveLocalWhatsAppSession({
    status: 'connected',
    phoneNumber: phoneNumber || 'مستر احمد بدوي',
    lastError: null,
  });
}

export async function disconnectWhatsApp(): Promise<boolean> {
  saveLocalWhatsAppSession({ status: 'disconnected' });
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/disconnect'), { method: 'POST' });
    return res.ok;
  } catch {
    return true;
  }
}

export async function toggleAutoRemind(
  enabled: boolean,
  reminderMinutesBefore?: number
): Promise<boolean> {
  saveLocalWhatsAppSession({
    autoRemindEnabled: enabled,
    ...(typeof reminderMinutesBefore === 'number' ? { reminderMinutesBefore } : {}),
  });
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/toggle-auto'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, reminderMinutesBefore }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function saveWhatsAppTemplate(
  template: string,
  reminderMinutesBefore?: number
): Promise<{ success: boolean; customTemplate?: string; reminderMinutesBefore?: number }> {
  const updated = saveLocalWhatsAppSession({
    customTemplate: template,
    customMessageTemplate: template,
    ...(typeof reminderMinutesBefore === 'number' ? { reminderMinutesBefore } : {}),
  });
  try {
    await fetch(getApiUrl('/api/whatsapp/save-template'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, reminderMinutesBefore }),
    });
  } catch {
    // ignore
  }
  return {
    success: true,
    customTemplate: updated.customTemplate,
    reminderMinutesBefore: updated.reminderMinutesBefore,
  };
}

export async function getWhatsAppTemplate(): Promise<{
  customTemplate: string;
  defaultTemplate: string;
  reminderMinutesBefore: number;
} | null> {
  const local = getLocalWhatsAppSession();
  return {
    customTemplate: local.customTemplate || DEFAULT_REMINDER_TEMPLATE,
    defaultTemplate: DEFAULT_REMINDER_TEMPLATE,
    reminderMinutesBefore: local.reminderMinutesBefore ?? 5,
  };
}

function appendLocalWhatsAppLog(log: WhatsAppSendLog): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_WA_LOGS);
    const list: WhatsAppSendLog[] = raw ? JSON.parse(raw) : [];
    const next = [log, ...list].slice(0, 100);
    window.localStorage.setItem(STORAGE_KEY_WA_LOGS, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function sendWhatsAppNow(
  paramsOrSessionId:
    | string
    | {
        sessionId?: string;
        recipient: string;
        recipientType: 'phone' | 'group';
        message: string;
        className?: string;
        sessionTitle?: string;
        trigger?: 'manual' | 'auto_schedule' | 'test';
      }
): Promise<{
  success: boolean;
  directLinkFallback?: boolean;
  isGroupLink?: boolean;
  error?: string;
  note?: string;
  log?: WhatsAppSendLog;
}> {
  if (typeof paramsOrSessionId === 'string') {
    const remRes = await sendWhatsAppReminder({ sessionId: paramsOrSessionId });
    return {
      success: remRes.success,
      directLinkFallback: remRes.directLinkFallback,
      isGroupLink: remRes.isGroupLink,
      error: remRes.error,
    };
  }

  const params = paramsOrSessionId;
  const recipient = (params.recipient || '').trim();
  if (!recipient) {
    return {
      success: false,
      error: 'لا يوجد مستلم أو رابط جروب مربوط بهذا الفصل.',
    };
  }

  try {
    const res = await fetch(getApiUrl('/api/whatsapp/send-now'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.log) appendLocalWhatsAppLog(data.log);
      return data;
    }
  } catch {
    // fallback to direct link
  }

  const isGroupLink = recipient.includes('chat.whatsapp.com/');
  const logEntry: WhatsAppSendLog = {
    id: `walog_${Date.now()}`,
    timestamp: new Date().toISOString(),
    className: params.className || 'الفصل',
    sessionTitle: params.sessionTitle || 'الرياضيات (Math)',
    recipient,
    recipientType: params.recipientType,
    status: 'sent',
    trigger: params.trigger || 'manual',
  };
  appendLocalWhatsAppLog(logEntry);

  return {
    success: true,
    directLinkFallback: true,
    isGroupLink,
    log: logEntry,
    note: isGroupLink
      ? 'تم تجهيز رسالة الفصل وفتح رابط الجروب المربوط.'
      : 'تم تجهيز الرسالة للفتح المباشر على واتساب.',
  };
}

export async function sendWhatsAppReminder(params: {
  sessionId: string;
  recipient?: string;
  recipientType?: 'phone' | 'group';
  appUrl?: string;
  customMessage?: string;
}): Promise<{
  success: boolean;
  error?: string;
  sentTo?: string;
  directLinkFallback?: boolean;
  isGroupLink?: boolean;
  messageText?: string;
}> {
  const sessions = storage.getSessions();
  const classes = storage.getClasses();
  const teacher = storage.getTeachers()[0] || DEFAULT_TEACHERS[0];

  const session = sessions.find((s) => s.id === params.sessionId);
  if (!session) {
    return { success: false, error: 'لم يتم العثور على الحصة المطلوبة.' };
  }

  const schoolClass = classes.find(
    (c) =>
      c.id === session.classId ||
      c.name.trim().toLowerCase() === session.className.trim().toLowerCase()
  );

  let recipient = (params.recipient || '').trim();
  let recipientType: 'phone' | 'group' = params.recipientType || 'group';

  if (!recipient) {
    const classRecipients = getClassWhatsAppRecipients(schoolClass, teacher);
    if (classRecipients.length === 0) {
      return {
        success: false,
        error: `الفصل (${session.className}) غير مربوط بأي جروب واتساب خاص بمستر أحمد بدوي.`,
      };
    }
    recipient = classRecipients[0].recipient;
    recipientType = classRecipients[0].recipientType;
  }

  const localWa = getLocalWhatsAppSession();
  const messageText =
    params.customMessage ||
    buildWhatsAppReminderMessage({
      session,
      schoolClass,
      teacher,
      appUrl: params.appUrl || getPublishedDomain(),
      customTemplate: localWa.customTemplate,
      minutesBefore: localWa.reminderMinutesBefore ?? 5,
    });

  const sendRes = await sendWhatsAppNow({
    sessionId: session.id,
    recipient,
    recipientType,
    message: messageText,
    className: session.className,
    sessionTitle: session.sessionTitle,
    trigger: 'manual',
  });

  return {
    success: sendRes.success,
    error: sendRes.error,
    sentTo: recipient,
    directLinkFallback: sendRes.directLinkFallback,
    isGroupLink: sendRes.isGroupLink,
    messageText,
  };
}

export async function getWhatsAppLogs(): Promise<WhatsAppSendLog[]> {
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/logs'), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_WA_LOGS);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return [];
}

export async function clearWhatsAppLogs(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY_WA_LOGS);
    } catch {}
  }
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/logs/clear'), { method: 'POST' });
    return res.ok;
  } catch {
    return true;
  }
}

export async function requestWhatsAppPairingCode(phoneNumber: string): Promise<{
  success: boolean;
  pairingCode?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/whatsapp/pair-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return {
    success: false,
    error: 'الإرسال المباشر يعمل عبر روابط جروبات الفصول المربوطة بدون الحاجة لكود ربط خارجي.',
  };
}

export async function saveWhatsAppProviderConfig(config: {
  provider: 'baileys' | 'cloud_api' | 'webhook' | 'green_api' | 'ultramsg' | 'direct_link';
  cloudPhoneNumberId?: string;
  cloudAccessToken?: string;
  webhookUrl?: string;
  instanceId?: string;
  apiToken?: string;
  teacherId?: string;
}): Promise<{ success: boolean; status?: WhatsAppLiveStatus; error?: string }> {
  const status = saveLocalWhatsAppSession({
    provider: config.provider,
    cloudPhoneNumberId: config.cloudPhoneNumberId,
    hasCloudToken: Boolean(config.cloudAccessToken),
    webhookUrl: config.webhookUrl,
    instanceId: config.instanceId,
    hasApiToken: Boolean(config.apiToken),
    status: 'connected',
  });

  try {
    await fetch(getApiUrl('/api/whatsapp/save-provider'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, teacherId: 'teacher_ahmed_badawi' }),
    });
  } catch {
    // ignore
  }

  return { success: true, status };
}

export async function testWhatsAppLiveConnection(params?: {
  recipient?: string;
  appUrl?: string;
}): Promise<{
  success: boolean;
  directLinkFallback?: boolean;
  isGroupLink?: boolean;
  messageText?: string;
  recipient?: string;
  error?: string;
  note?: string;
}> {
  const recipient = (params?.recipient || '').trim();
  const messageText = `✅ رسالة اختبار نظام التحضير الذكي - مستر احمد بدوي (الرياضيات Math)`;
  if (!recipient) {
    return {
      success: false,
      error: 'يرجى إدخال رقم هاتف أو رابط جروب الفصل لاختبار الإرسال.',
    };
  }
  const res = await sendWhatsAppNow({
    recipient,
    recipientType: recipient.includes('chat.whatsapp.com') ? 'group' : 'phone',
    message: messageText,
    className: 'اختبار الاتصال',
    sessionTitle: 'الرياضيات (Math)',
    trigger: 'test',
  });
  return {
    ...res,
    messageText,
    recipient,
  };
}

export async function createDemoClassWithSchedule(
  customTime?: string,
  _link?: string
): Promise<{
  success: boolean;
  demoClass?: SchoolClass;
  demoSession?: ClassSession;
  classes?: SchoolClass[];
  sessions?: ClassSession[];
  teachers?: TeacherProfile[];
  sendResult?: any;
  error?: string;
}> {
  const classes = storage.getClasses();
  const targetClass = classes[0] || DEFAULT_CLASSES[0];
  const teacher = storage.getTeachers()[0] || DEFAULT_TEACHERS[0];

  const demoSession: ClassSession = {
    id: `ses_test_${Date.now()}`,
    teacherId: 'teacher_ahmed_badawi',
    classId: targetClass.id,
    className: targetClass.name,
    sessionTitle: `الرياضيات (Math) - ${targetClass.name}`,
    zoomUrl: teacher.defaultZoomLink || targetClass.zoomUrl || 'https://zoom.us',
    targetTrack: 'all',
    createdAt: new Date().toISOString(),
    scheduledTime: customTime || 'مباشر الآن',
    isActive: true,
    attendance: [],
  };

  await createOrUpdateSessionOnServer(demoSession);

  return {
    success: true,
    demoClass: targetClass,
    demoSession,
    classes,
    sessions: storage.getSessions(),
    teachers: storage.getTeachers(),
  };
}

export async function askAiCopilot(params: {
  prompt: string;
  context?: any;
  history?: { role: 'user' | 'model'; text: string }[];
}): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const res = await fetch(getApiUrl('/api/ai/copilot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'تعذر الاتصال بالمساعد الذكي' };
    }
    return { success: true, reply: data.reply };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الشبكة' };
  }
}

export function listenForServerEvents(onEvent: (msg: any, payload?: any) => void): () => void {
  if (typeof window === 'undefined' || !('EventSource' in window)) {
    return () => {};
  }

  let es: EventSource | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      es = new EventSource(getApiUrl('/api/events'));
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.type) {
            const unifiedMsg = {
              type: parsed.type,
              ...(parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {}),
              payload: parsed.payload,
            };
            onEvent(unifiedMsg, parsed.payload);
          }
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (!isClosed) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch {
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 5000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (es) es.close();
  };
}

const SYNC_CHANNEL_NAME = 'zoom_smart_attendance_sync_v5';

export function broadcastSyncEvent(type: string, payload?: any) {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.postMessage({
        type,
        ...(payload && typeof payload === 'object' ? payload : {}),
        payload,
        timestamp: Date.now(),
      });
      channel.close();
    }
  } catch {
    // ignore
  }
}

export function listenForSyncEvents(onEvent: (msg: any, payload?: any) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let channel: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data && event.data.type) {
          onEvent(event.data, event.data.payload);
        }
      };
    }
  } catch {
    // ignore
  }

  return () => {
    if (channel) {
      try {
        channel.close();
      } catch {}
    }
  };
}

export async function detectVercelApiStatus(): Promise<'connected' | 'local_only'> {
  const ok = await checkDatabaseConnection();
  return ok ? 'connected' : 'local_only';
}

export function exportAllDataAsSyncPayload(): string {
  const payload = {
    version: 5,
    exportedAt: new Date().toISOString(),
    teachers: storage.getTeachers(),
    currentTeacherId: 'teacher_ahmed_badawi',
    classes: storage.getClasses(),
    students: storage.getStudents(),
    sessions: storage.getSessions(),
    teacherPin: storage.getTeacherPin(),
    publishedDomain: getPublishedDomain(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importSyncPayload(jsonString: string): {
  success: boolean;
  error?: string;
  stats?: { classes: number; students: number; sessions: number };
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'صيغة ملف غير صالحة' };
    }

    const teachers = sanitizeSoleTeacherList(parsed.teachers);
    const classes = Array.isArray(parsed.classes) ? parsed.classes : storage.getClasses();
    const students = enforceOfficialStudentTracks(
      Array.isArray(parsed.students) ? parsed.students : storage.getStudents()
    );
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : storage.getSessions();

    storage.saveTeachers(teachers);
    storage.saveClasses(classes);
    storage.saveStudents(students);
    storage.saveSessions(sessions);
    if (parsed.teacherPin) storage.saveTeacherPin(parsed.teacherPin);

    syncStateToServer({
      teachers,
      classes,
      students,
      sessions,
      teacherPin: parsed.teacherPin,
    });

    return {
      success: true,
      stats: {
        classes: classes.length,
        students: students.length,
        sessions: sessions.length,
      },
    };
  } catch {
    return {
      success: false,
      error: 'تعذر قراءة كود المزامنة، تأكد من نسخ الكود بالكامل بشكل صحيح.',
    };
  }
}
