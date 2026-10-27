import { AttendanceRecord, ClassSession } from '../types';
import { normalizeText } from './arabicFuzzy';

export interface FirestoreAttendanceEnvelope {
  key: string;
  sessionId: string;
  classId?: string;
  className?: string;
  sessionTitle?: string;
  zoomUrl?: string;
  targetTrack?: string;
  teacherId?: string;
  record: AttendanceRecord;
  updatedAt: number;
}

export const db = null;

type AttendanceSubscriber = (payload: {
  entries: FirestoreAttendanceEnvelope[];
  lastCheckIn?: FirestoreAttendanceEnvelope | null;
  lastResetAt?: string;
}) => void;

type AppDataSubscriber = (data: any) => void;

const attSubscribers = new Set<AttendanceSubscriber>();
const appDataSubscribers = new Set<AppDataSubscriber>();

const localMemoryState: {
  entries: Record<string, FirestoreAttendanceEnvelope>;
  sessions: Record<string, ClassSession>;
  deletedSessionIds: Set<string>;
  lastResetAt?: string;
  lastUpdatedAt: number;
} = {
  entries: {},
  sessions: {},
  deletedSessionIds: new Set<string>(),
  lastResetAt: undefined,
  lastUpdatedAt: Date.now(),
};

function getStudentUniqueKey(sessionId: string, record: AttendanceRecord): string {
  const studentIdentifier =
    record.studentId ||
    normalizeText(record.matchedRosterName || record.studentName || '') ||
    record.id;
  return `${sessionId}__${studentIdentifier}`.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
}

function getValidEntries(): FirestoreAttendanceEnvelope[] {
  const resetMs = localMemoryState.lastResetAt ? new Date(localMemoryState.lastResetAt).getTime() : 0;
  return Object.values(localMemoryState.entries).filter((env) => {
    if (!env || !env.record || !env.sessionId) return false;
    if (localMemoryState.deletedSessionIds.has(env.sessionId)) return false;
    if (resetMs > 0) {
      const recMs = new Date(env.record.lastJoinedAt || env.record.timestamp || env.updatedAt).getTime();
      if (!isNaN(recMs) && recMs < resetMs) return false;
    }
    return true;
  });
}

function buildAppDataSnapshot() {
  const validEntries = getValidEntries();
  const entriesMap: Record<string, FirestoreAttendanceEnvelope> = {};
  for (const e of validEntries) {
    entriesMap[e.key] = e;
  }
  const cleanSessions = Object.values(localMemoryState.sessions).filter(
    (s) => s && s.id && !localMemoryState.deletedSessionIds.has(s.id)
  );
  return {
    sessions: cleanSessions,
    attendanceRegistry: {
      entries: entriesMap,
      lastResetAt: localMemoryState.lastResetAt,
    },
    lastUpdatedAt: localMemoryState.lastUpdatedAt,
  };
}

function notifyAttendanceSubscribers(lastCheckIn?: FirestoreAttendanceEnvelope | null) {
  const payload = {
    entries: getValidEntries(),
    lastCheckIn: lastCheckIn || null,
    lastResetAt: localMemoryState.lastResetAt,
  };
  attSubscribers.forEach((cb) => {
    try {
      cb(payload);
    } catch {}
  });
}

function notifyAppDataSubscribers() {
  const snapshot = buildAppDataSnapshot();
  appDataSubscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

export async function pollCloudRelayNow(_force = false): Promise<void> {
  // Legacy ntfy.sh cloud relay permanently disabled to prevent ghost sessions and stale attendance replay
}

export async function recordAttendanceInFirestore(
  sessionId: string,
  record: AttendanceRecord,
  sessionDetails?: {
    classId?: string;
    className?: string;
    sessionTitle?: string;
    zoomUrl?: string;
    targetTrack?: string;
    teacherId?: string;
  }
): Promise<boolean> {
  if (!sessionId || !record || localMemoryState.deletedSessionIds.has(sessionId)) {
    return false;
  }
  const key = getStudentUniqueKey(sessionId, record);
  const envelope: FirestoreAttendanceEnvelope = {
    key,
    sessionId,
    classId: sessionDetails?.classId,
    className: sessionDetails?.className,
    sessionTitle: sessionDetails?.sessionTitle,
    zoomUrl: sessionDetails?.zoomUrl,
    targetTrack: sessionDetails?.targetTrack,
    teacherId: 'teacher_ahmed_badawi',
    record: {
      ...record,
      sessionId,
    },
    updatedAt: Date.now(),
  };

  localMemoryState.entries[key] = envelope;
  localMemoryState.lastUpdatedAt = envelope.updatedAt;
  notifyAttendanceSubscribers(envelope);
  notifyAppDataSubscribers();
  return true;
}

export async function clearAttendanceInFirestore(_teacherId?: string): Promise<boolean> {
  const resetAt = new Date().toISOString();
  localMemoryState.lastResetAt = resetAt;
  localMemoryState.entries = {};
  for (const s of Object.values(localMemoryState.sessions)) {
    s.attendance = [];
    s.lastAttendanceResetAt = resetAt;
  }
  localMemoryState.lastUpdatedAt = Date.now();
  notifyAttendanceSubscribers(null);
  notifyAppDataSubscribers();
  return true;
}

export function subscribeToFirestoreAttendance(onUpdate: AttendanceSubscriber): () => void {
  attSubscribers.add(onUpdate);
  try {
    onUpdate({
      entries: getValidEntries(),
      lastCheckIn: null,
      lastResetAt: localMemoryState.lastResetAt,
    });
  } catch {}
  return () => {
    attSubscribers.delete(onUpdate);
  };
}

export async function saveAppData(data: {
  sessions?: ClassSession[];
  classes?: any[];
  teachers?: any[];
  currentTeacherId?: string;
  publishedDomain?: string;
}): Promise<void> {
  if (!Array.isArray(data.sessions)) return;
  for (const s of data.sessions) {
    if (!s || !s.id || localMemoryState.deletedSessionIds.has(s.id)) continue;
    localMemoryState.sessions[s.id] = {
      ...s,
      teacherId: 'teacher_ahmed_badawi',
      attendance: Array.isArray(s.attendance) ? s.attendance : [],
    };
  }
  localMemoryState.lastUpdatedAt = Date.now();
  notifyAppDataSubscribers();
}

export async function saveSingleSessionToFirestore(
  session: ClassSession,
  _allSessions?: ClassSession[]
): Promise<void> {
  if (!session || !session.id || localMemoryState.deletedSessionIds.has(session.id)) return;
  localMemoryState.sessions[session.id] = {
    ...session,
    teacherId: 'teacher_ahmed_badawi',
    attendance: Array.isArray(session.attendance) ? session.attendance : [],
  };
  localMemoryState.lastUpdatedAt = Date.now();
  notifyAppDataSubscribers();
}

export function subscribeToAppData(callback: AppDataSubscriber): () => void {
  appDataSubscribers.add(callback);
  try {
    callback(buildAppDataSnapshot());
  } catch {}
  return () => {
    appDataSubscribers.delete(callback);
  };
}

export async function getAppData(): Promise<any> {
  return buildAppDataSnapshot();
}

export async function deleteSessionFromFirestore(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  localMemoryState.deletedSessionIds.add(sessionId);
  delete localMemoryState.sessions[sessionId];
  for (const [k, env] of Object.entries(localMemoryState.entries)) {
    if (env.sessionId === sessionId) {
      delete localMemoryState.entries[k];
    }
  }
  localMemoryState.lastUpdatedAt = Date.now();
  notifyAttendanceSubscribers(null);
  notifyAppDataSubscribers();
  return true;
}

export async function batchDeleteSessionsFromFirestore(sessionIds: string[]): Promise<boolean> {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return false;
  for (const sid of sessionIds) {
    if (!sid) continue;
    localMemoryState.deletedSessionIds.add(sid);
    delete localMemoryState.sessions[sid];
  }
  const idSet = new Set(sessionIds);
  for (const [k, env] of Object.entries(localMemoryState.entries)) {
    if (idSet.has(env.sessionId)) {
      delete localMemoryState.entries[k];
    }
  }
  localMemoryState.lastUpdatedAt = Date.now();
  notifyAttendanceSubscribers(null);
  notifyAppDataSubscribers();
  return true;
}
