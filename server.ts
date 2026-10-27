import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_TEACHERS,
  DEFAULT_CLASSES,
  DEFAULT_STUDENTS,
  AHMED_BADAWI_OFFICIAL_SCHEDULE,
  enforceOfficialStudentTracks,
  applyAhmedBadawiScheduleTrackRules,
  sanitizeSoleTeacherList,
} from './src/utils/storage';
import { findBestMatch, normalizeText } from './src/utils/arabicFuzzy';
import { DEFAULT_REMINDER_TEMPLATE } from './src/utils/whatsappHelper';
import type {
  TeacherProfile,
  SchoolClass,
  Student,
  ClassSession,
  AttendanceRecord,
  WhatsAppSendLog,
  SchedulePeriod,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  teachers: TeacherProfile[];
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  deletedSessionIds: string[];
  teacherPin: string;
  whatsappLogs: WhatsAppSendLog[];
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDatabase(): DatabaseSchema {
  const defaultDb: DatabaseSchema = {
    teachers: sanitizeSoleTeacherList(DEFAULT_TEACHERS),
    classes: DEFAULT_CLASSES,
    students: enforceOfficialStudentTracks(DEFAULT_STUDENTS),
    sessions: [],
    deletedSessionIds: [],
    teacherPin: '123654',
    whatsappLogs: [],
  };

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const deletedIds: string[] = Array.isArray(parsed.deletedSessionIds)
        ? parsed.deletedSessionIds
        : [];
      const deletedSet = new Set(deletedIds);

      const teachers = sanitizeSoleTeacherList(parsed.teachers);
      const classes =
        Array.isArray(parsed.classes) && parsed.classes.length > 0
          ? parsed.classes
          : DEFAULT_CLASSES;
      const students = enforceOfficialStudentTracks(
        Array.isArray(parsed.students) && parsed.students.length > 0
          ? parsed.students
          : DEFAULT_STUDENTS
      );
      const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : [])
        .filter((s: ClassSession) => s && s.id && !deletedSet.has(s.id))
        .map((s: ClassSession) => ({
          ...s,
          teacherId: 'teacher_ahmed_badawi',
          attendance: Array.isArray(s.attendance) ? s.attendance : [],
        }));

      const cleanDb: DatabaseSchema = {
        teachers,
        classes,
        students,
        sessions,
        deletedSessionIds: Array.from(deletedSet),
        teacherPin:
          parsed.teacherPin && parsed.teacherPin !== '1234' ? parsed.teacherPin : '123654',
        whatsappLogs: Array.isArray(parsed.whatsappLogs) ? parsed.whatsappLogs.slice(0, 100) : [],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(cleanDb, null, 2), 'utf-8');
      return cleanDb;
    }
  } catch (err) {
    console.error('Error loading db.json, initializing clean database:', err);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
  return defaultDb;
}

const db: DatabaseSchema = loadDatabase();

function saveDatabase(): void {
  try {
    const deletedSet = new Set(db.deletedSessionIds || []);
    db.teachers = sanitizeSoleTeacherList(db.teachers);
    db.students = enforceOfficialStudentTracks(db.students);
    db.sessions = (db.sessions || [])
      .filter((s) => s && s.id && !deletedSet.has(s.id))
      .map((s) => ({
        ...s,
        teacherId: 'teacher_ahmed_badawi',
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
      }));
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// Server-Sent Events (SSE) clients for instant teacher dashboard updates
const sseClients = new Set<express.Response>();

function broadcastSSE(type: string, payload: any): void {
  const data = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

// WhatsApp Configuration State
let whatsappState = {
  status: 'connected' as
    | 'disconnected'
    | 'initializing'
    | 'qr_ready'
    | 'pairing_code_ready'
    | 'authenticated'
    | 'connected'
    | 'error',
  qrDataUrl: null as string | null,
  pairingCode: null as string | null,
  phoneNumber: 'مستر احمد بدوي' as string | null,
  lastError: null as string | null,
  autoRemindEnabled: true,
  reminderMinutesBefore: 5,
  customTemplate: DEFAULT_REMINDER_TEMPLATE,
  sentCount: 0,
  provider: 'direct_link' as
    | 'baileys'
    | 'cloud_api'
    | 'webhook'
    | 'green_api'
    | 'ultramsg'
    | 'direct_link',
  cloudPhoneNumberId: '',
  cloudAccessToken: '',
  webhookUrl: '',
  instanceId: '',
  apiToken: '',
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '15mb' }));

  // 1. Health & Events
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      teacher: 'مستر احمد بدوي',
      subject: 'الرياضيات (Math)',
      sessionsCount: db.sessions.length,
      studentsCount: db.students.length,
    });
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { ok: true } })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // 2. Unified Data Endpoints
  app.get('/api/data', (_req, res) => {
    res.json({
      teachers: db.teachers,
      classes: db.classes,
      students: db.students,
      sessions: db.sessions,
      deletedSessionIds: db.deletedSessionIds,
      teacherPin: db.teacherPin,
      whatsappLogs: db.whatsappLogs,
    });
  });

  app.get('/api/sessions', (_req, res) => {
    res.json({
      sessions: db.sessions,
      deletedSessionIds: db.deletedSessionIds,
    });
  });

  app.get('/api/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    if (db.deletedSessionIds.includes(sessionId)) {
      return res.status(404).json({ error: 'Session was deleted' });
    }
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ session });
  });

  // 3. Create or Update Session
  app.post('/api/sessions', (req, res) => {
    const incoming: ClassSession | undefined = req.body?.session;
    if (!incoming || !incoming.id) {
      return res.status(400).json({ error: 'Invalid session payload' });
    }

    // Remove from deleted list if explicitly re-created
    db.deletedSessionIds = db.deletedSessionIds.filter((id) => id !== incoming.id);

    const existingIdx = db.sessions.findIndex((s) => s.id === incoming.id);
    const normalizedSession: ClassSession = {
      ...incoming,
      teacherId: 'teacher_ahmed_badawi',
      attendance: Array.isArray(incoming.attendance)
        ? incoming.attendance
        : existingIdx >= 0
        ? db.sessions[existingIdx].attendance || []
        : [],
    };

    if (existingIdx >= 0) {
      db.sessions[existingIdx] = normalizedSession;
    } else {
      db.sessions.unshift(normalizedSession);
    }

    saveDatabase();
    broadcastSSE('SESSION_UPSERTED', { session: normalizedSession, sessions: db.sessions });
    res.json({ success: true, session: normalizedSession, sessions: db.sessions });
  });

  // 4. Delete Session(s)
  app.delete('/api/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    if (!db.deletedSessionIds.includes(sessionId)) {
      db.deletedSessionIds.push(sessionId);
    }
    db.sessions = db.sessions.filter((s) => s.id !== sessionId);
    saveDatabase();
    broadcastSSE('SESSION_DELETED', { sessionId, sessions: db.sessions });
    res.json({ success: true, sessionId, sessions: db.sessions });
  });

  app.post('/api/sessions/batch-delete', (req, res) => {
    const sessionIds: string[] = Array.isArray(req.body?.sessionIds) ? req.body.sessionIds : [];
    const idSet = new Set(sessionIds);
    for (const sid of sessionIds) {
      if (sid && !db.deletedSessionIds.includes(sid)) {
        db.deletedSessionIds.push(sid);
      }
    }
    db.sessions = db.sessions.filter((s) => !idSet.has(s.id));
    saveDatabase();
    broadcastSSE('SESSIONS_BATCH_DELETED', { sessionIds, sessions: db.sessions });
    res.json({ success: true, sessionIds, sessions: db.sessions });
  });

  // 5. Reset Attendance
  app.post('/api/sessions/reset-attendance', (_req, res) => {
    const nowIso = new Date().toISOString();
    let resetCount = 0;
    db.sessions = db.sessions.map((s) => {
      resetCount += (s.attendance || []).length;
      return {
        ...s,
        attendance: [],
        lastAttendanceResetAt: nowIso,
      };
    });
    saveDatabase();
    broadcastSSE('ATTENDANCE_RESET', { resetAt: nowIso, sessions: db.sessions });
    res.json({ success: true, resetCount, sessions: db.sessions });
  });

  // 6. Strict Student Attendance Check-in (Bound exclusively to sessionId)
  app.post('/api/attendance', (req, res) => {
    const {
      sessionId,
      studentName,
      studentId,
      deviceFingerprint,
      sessionDetails,
    }: {
      sessionId?: string;
      studentName?: string;
      studentId?: string;
      deviceFingerprint?: string;
      sessionDetails?: Partial<ClassSession>;
    } = req.body || {};

    const cleanSessionId = (sessionId || '').trim();
    const cleanStudentName = (studentName || '').trim();

    if (!cleanSessionId || !cleanStudentName) {
      return res.status(400).json({ error: 'sessionId and studentName are required' });
    }

    if (db.deletedSessionIds.includes(cleanSessionId)) {
      return res.status(410).json({ error: 'This session has been deleted by the teacher' });
    }

    const nowIso = new Date().toISOString();
    let targetSession = db.sessions.find((s) => s.id === cleanSessionId);

    // If the student opened a valid portable link for a session not yet in db.sessions, create it with its exact sessionId
    if (!targetSession) {
      targetSession = {
        id: cleanSessionId,
        teacherId: 'teacher_ahmed_badawi',
        classId: sessionDetails?.classId || 'class_auto',
        className: sessionDetails?.className || 'الفصل',
        sessionTitle: sessionDetails?.sessionTitle || 'الرياضيات (Math)',
        zoomUrl: sessionDetails?.zoomUrl || 'https://zoom.us',
        targetTrack: sessionDetails?.targetTrack || 'all',
        createdAt: nowIso,
        scheduledTime: sessionDetails?.scheduledTime || 'مباشر الآن',
        isActive: true,
        attendance: [],
      };
      db.sessions.unshift(targetSession);
    }

    // Match student strictly within the targetSession's class roster
    const classStudents = db.students.filter((st) => st.classId === targetSession!.classId);
    let matchedStudent: Student | undefined;
    let matchConfidence = 0;

    if (studentId) {
      matchedStudent = classStudents.find((st) => st.id === studentId);
      if (matchedStudent) matchConfidence = 1;
    }

    if (!matchedStudent && classStudents.length > 0) {
      const fuzzy = findBestMatch(
        cleanStudentName,
        classStudents.map((st) => ({ id: st.id, name: st.name })),
        0.75
      );
      if (fuzzy) {
        matchedStudent = classStudents.find((st) => st.id === fuzzy.id);
        matchConfidence = fuzzy.similarity;
      }
    }

    if (!Array.isArray(targetSession.attendance)) {
      targetSession.attendance = [];
    }

    const existingIdx = targetSession.attendance.findIndex(
      (a) =>
        (matchedStudent && a.studentId === matchedStudent.id) ||
        normalizeText(a.studentName) === normalizeText(cleanStudentName)
    );

    if (existingIdx >= 0) {
      const prev = targetSession.attendance[existingIdx];
      const updatedRecord: AttendanceRecord = {
        ...prev,
        sessionId: cleanSessionId,
        studentId: matchedStudent?.id || prev.studentId,
        studentName: matchedStudent ? matchedStudent.name : prev.studentName,
        matchedRosterName: matchedStudent?.name || prev.matchedRosterName,
        matchConfidence: matchedStudent ? matchConfidence : prev.matchConfidence,
        lastJoinedAt: nowIso,
        joinCount: (prev.joinCount || 1) + 1,
      };
      targetSession.attendance[existingIdx] = updatedRecord;
      saveDatabase();
      broadcastSSE('ATTENDANCE_RECORDED', {
        sessionId: cleanSessionId,
        record: updatedRecord,
        session: targetSession,
      });
      return res.json({
        success: true,
        alreadyRecorded: true,
        record: updatedRecord,
        session: targetSession,
      });
    }

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: cleanSessionId,
      studentId: matchedStudent?.id,
      studentName: matchedStudent ? matchedStudent.name : cleanStudentName,
      matchedRosterName: matchedStudent?.name,
      matchConfidence: matchedStudent ? matchConfidence : 0,
      timestamp: nowIso,
      lastJoinedAt: nowIso,
      joinCount: 1,
      deviceFingerprint: deviceFingerprint || 'unknown',
      status: 'present',
    };

    targetSession.attendance.push(newRecord);
    saveDatabase();

    broadcastSSE('ATTENDANCE_RECORDED', {
      sessionId: cleanSessionId,
      record: newRecord,
      session: targetSession,
    });

    res.json({
      success: true,
      alreadyRecorded: false,
      record: newRecord,
      session: targetSession,
    });
  });

  // 7. Full State Sync
  app.post('/api/sync', (req, res) => {
    const body = req.body || {};

    if (Array.isArray(body.deletedSessionIds)) {
      for (const sid of body.deletedSessionIds) {
        if (sid && !db.deletedSessionIds.includes(sid)) {
          db.deletedSessionIds.push(sid);
        }
      }
    }
    const deletedSet = new Set(db.deletedSessionIds);

    if (Array.isArray(body.teachers) && body.teachers.length > 0) {
      db.teachers = sanitizeSoleTeacherList(body.teachers);
    }
    if (Array.isArray(body.classes)) {
      db.classes = body.classes;
    }
    if (Array.isArray(body.students)) {
      db.students = enforceOfficialStudentTracks(body.students);
    }
    if (Array.isArray(body.sessions)) {
      // Merge incoming sessions with existing server attendance by exact sessionId
      const existingById = new Map<string, ClassSession>();
      for (const s of db.sessions) {
        if (s && s.id && !deletedSet.has(s.id)) {
          existingById.set(s.id, s);
        }
      }

      const nextSessions: ClassSession[] = [];
      const seenIds = new Set<string>();

      for (const inc of body.sessions as ClassSession[]) {
        if (!inc || !inc.id || deletedSet.has(inc.id) || seenIds.has(inc.id)) continue;
        seenIds.add(inc.id);
        const prev = existingById.get(inc.id);
        if (!prev) {
          nextSessions.push({
            ...inc,
            teacherId: 'teacher_ahmed_badawi',
            attendance: Array.isArray(inc.attendance) ? inc.attendance : [],
          });
        } else {
          // Keep union of attendance records for this exact sessionId unless reset
          const resetAt =
            inc.lastAttendanceResetAt && prev.lastAttendanceResetAt
              ? inc.lastAttendanceResetAt > prev.lastAttendanceResetAt
                ? inc.lastAttendanceResetAt
                : prev.lastAttendanceResetAt
              : inc.lastAttendanceResetAt || prev.lastAttendanceResetAt;

          const attMap = new Map<string, AttendanceRecord>();
          const resetMs = resetAt ? new Date(resetAt).getTime() : 0;

          for (const rec of [...(prev.attendance || []), ...(inc.attendance || [])]) {
            if (!rec) continue;
            if (resetMs > 0) {
              const rMs = new Date(rec.lastJoinedAt || rec.timestamp || 0).getTime();
              if (!isNaN(rMs) && rMs < resetMs) continue;
            }
            const key = rec.studentId || normalizeText(rec.studentName) || rec.id;
            attMap.set(key, { ...rec, sessionId: inc.id });
          }

          nextSessions.push({
            ...prev,
            ...inc,
            id: inc.id,
            teacherId: 'teacher_ahmed_badawi',
            lastAttendanceResetAt: resetAt,
            attendance: Array.from(attMap.values()),
          });
        }
      }

      db.sessions = nextSessions;
    }

    if (typeof body.teacherPin === 'string' && body.teacherPin.trim()) {
      db.teacherPin = body.teacherPin.trim();
    }

    saveDatabase();
    broadcastSSE('STATE_SYNCED', {
      teachers: db.teachers,
      classes: db.classes,
      students: db.students,
      sessions: db.sessions,
      deletedSessionIds: db.deletedSessionIds,
    });

    res.json({
      success: true,
      teachers: db.teachers,
      classes: db.classes,
      students: db.students,
      sessions: db.sessions,
      deletedSessionIds: db.deletedSessionIds,
      teacherPin: db.teacherPin,
    });
  });

  // 8. Class & Student Management Endpoints
  app.delete('/api/classes/:id', (req, res) => {
    const classId = req.params.id;
    db.classes = db.classes.filter((c) => c.id !== classId);
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { classes: db.classes });
    res.json({ success: true, classes: db.classes });
  });

  app.post('/api/classes/batch-delete', (req, res) => {
    const classIds: string[] = Array.isArray(req.body?.classIds) ? req.body.classIds : [];
    const idSet = new Set(classIds);
    db.classes = db.classes.filter((c) => !idSet.has(c.id));
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { classes: db.classes });
    res.json({ success: true, classes: db.classes });
  });

  app.post('/api/classes/merge-duplicates', (_req, res) => {
    const byNormName = new Map<string, SchoolClass>();
    const remapIds = new Map<string, string>();
    let mergedCount = 0;

    for (const cls of db.classes) {
      const key = cls.name.trim().toLowerCase().replace(/[\s\-_]+/g, '');
      const existing = byNormName.get(key);
      if (!existing) {
        byNormName.set(key, cls);
      } else {
        remapIds.set(cls.id, existing.id);
        mergedCount++;
      }
    }

    if (mergedCount > 0) {
      db.classes = Array.from(byNormName.values());
      db.students = db.students.map((st) =>
        remapIds.has(st.classId) ? { ...st, classId: remapIds.get(st.classId)! } : st
      );
      db.sessions = db.sessions.map((ses) =>
        remapIds.has(ses.classId) ? { ...ses, classId: remapIds.get(ses.classId)! } : ses
      );
      saveDatabase();
    }

    res.json({
      success: true,
      mergedCount,
      classes: db.classes,
      students: db.students,
      sessions: db.sessions,
      teachers: db.teachers,
    });
  });

  app.delete('/api/students/:id', (req, res) => {
    const studentId = req.params.id;
    db.students = db.students.filter((st) => st.id !== studentId);
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { students: db.students });
    res.json({ success: true, students: db.students });
  });

  app.post('/api/students/batch-delete', (req, res) => {
    const studentIds: string[] = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
    const idSet = new Set(studentIds);
    db.students = db.students.filter((st) => !idSet.has(st.id));
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { students: db.students });
    res.json({ success: true, students: db.students });
  });

  app.post('/api/students/batch-update', (req, res) => {
    const studentIds: string[] = Array.isArray(req.body?.studentIds) ? req.body.studentIds : [];
    const updates = req.body?.updates || {};
    const idSet = new Set(studentIds);
    db.students = db.students.map((st) => (idSet.has(st.id) ? { ...st, ...updates } : st));
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { students: db.students });
    res.json({ success: true, students: db.students });
  });

  // 9. Teacher Schedule & Daily Session Generation
  app.post('/api/schedule/save', (req, res) => {
    const {
      weeklySchedule,
      classZoomLinks,
      classWhatsAppGroups,
      defaultZoomLink,
    } = req.body || {};

    const badawi = db.teachers[0] || DEFAULT_TEACHERS[0];
    const cleanSchedule = Array.isArray(weeklySchedule)
      ? applyAhmedBadawiScheduleTrackRules(weeklySchedule)
      : badawi.weeklySchedule || AHMED_BADAWI_OFFICIAL_SCHEDULE;

    const updatedBadawi: TeacherProfile = {
      ...badawi,
      id: 'teacher_ahmed_badawi',
      name: 'مستر احمد بدوي',
      subject: 'الرياضيات (Math)',
      weeklySchedule: cleanSchedule,
      classZoomLinks: classZoomLinks ?? badawi.classZoomLinks,
      classWhatsAppGroups: classWhatsAppGroups ?? badawi.classWhatsAppGroups,
      defaultZoomLink: defaultZoomLink !== undefined ? defaultZoomLink : badawi.defaultZoomLink,
    };

    db.teachers = [updatedBadawi];
    saveDatabase();
    broadcastSSE('STATE_SYNCED', { teachers: db.teachers, classes: db.classes });

    res.json({
      success: true,
      teacher: updatedBadawi,
      classes: db.classes,
    });
  });

  app.post('/api/schedule/generate-today', (req, res) => {
    const { dayOfWeek } = req.body || {};
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = (dayOfWeek || days[new Date().getDay()]).toLowerCase();
    const todayDatePrefix = new Date().toISOString().split('T')[0];

    const badawi = db.teachers[0] || DEFAULT_TEACHERS[0];
    const schedule = applyAhmedBadawiScheduleTrackRules(
      Array.isArray(badawi.weeklySchedule) && badawi.weeklySchedule.length > 0
        ? badawi.weeklySchedule
        : AHMED_BADAWI_OFFICIAL_SCHEDULE
    );

    const dayPeriods = schedule.filter((p) => (p.dayOfWeek || '').toLowerCase() === targetDay);
    const deletedSet = new Set(db.deletedSessionIds);
    let createdCount = 0;

    for (const period of dayPeriods) {
      const deterministicId = `ses_${todayDatePrefix}_${period.id}`;
      if (deletedSet.has(deterministicId)) continue;

      const matchedClass =
        db.classes.find((c) => c.id === period.classId) ||
        db.classes.find((c) => c.name.trim().toLowerCase() === period.className.trim().toLowerCase());

      const classId = matchedClass?.id || period.classId || `class_${period.id}`;
      const className = matchedClass?.name || period.className;

      const alreadyExists = db.sessions.some(
        (s) =>
          s.id === deterministicId ||
          (s.classId === classId &&
            s.scheduledTime === period.startTime &&
            (s.createdAt || '').startsWith(todayDatePrefix))
      );

      if (alreadyExists) continue;

      const zoomUrl =
        period.zoomUrl ||
        badawi.classZoomLinks?.[classId] ||
        matchedClass?.zoomUrl ||
        badawi.defaultZoomLink ||
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

      db.sessions.unshift(newSession);
      createdCount++;
    }

    if (createdCount > 0) {
      saveDatabase();
      broadcastSSE('STATE_SYNCED', { sessions: db.sessions });
    }

    res.json({
      success: true,
      createdCount,
      sessions: db.sessions,
      classes: db.classes,
    });
  });

  // 10. AI Schedule Parser & Copilot (Exclusively for Mr. Ahmed Badawi - Math)
  app.post('/api/schedule/parse-ai', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'مفتاح GEMINI_API_KEY غير متوفر في الخادم.',
        });
      }

      const { text, imageBase64, imageMimeType } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });

      const parts: any[] = [];
      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
            mimeType: imageMimeType,
          },
        });
      }
      parts.push({
        text: `استخرج جدول حصص مستر أحمد بدوي لمادة الرياضيات (Math) فقط من البيانات التالية.
تجاهل أي معلم آخر وأي مادة أخرى غير الرياضيات (Math).
${text || ''}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayOfWeek: { type: Type.STRING },
                dayNameArabic: { type: Type.STRING },
                className: { type: Type.STRING },
                startTime: { type: Type.STRING },
                endTime: { type: Type.STRING },
                subject: { type: Type.STRING },
                targetTrack: { type: Type.STRING },
              },
              required: ['dayOfWeek', 'className', 'startTime', 'endTime'],
            },
          },
        },
      });

      const parsed: SchedulePeriod[] = JSON.parse(response.text || '[]').map(
        (item: any, idx: number) => ({
          id: `badawi_ai_${Date.now()}_${idx}`,
          dayOfWeek: (item.dayOfWeek || 'sunday').toLowerCase(),
          dayNameArabic: item.dayNameArabic || 'الأحد',
          className: item.className || 'GR4 A',
          startTime: item.startTime || '08:00',
          endTime: item.endTime || '08:40',
          subject: 'Math',
          targetTrack:
            item.targetTrack === 'arabic' || item.targetTrack === 'english'
              ? item.targetTrack
              : 'all',
        })
      );

      res.json({
        success: true,
        schedule: applyAhmedBadawiScheduleTrackRules(parsed),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'فشل تحليل الجدول بالذكاء الاصطناعي',
      });
    }
  });

  app.post('/api/ai/copilot', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          reply:
            'مرحباً بك يا مستر أحمد بدوي! نظام التحضير الذكي لمادة الرياضيات (Math) يعمل بكفاءة. يمكنك إدارة الفصول والطلاب وإرسال روابط التحضير من لوحة التحكم.',
        });
      }
      const { prompt } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `أنت المساعد الذكي الخاص بمستر أحمد بدوي (معلم الرياضيات Math بمدرسة اللغات الحديثة). أجب باختصار وباللغة العربية: ${prompt}`,
      });
      res.json({ success: true, reply: response.text || '' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'تعذر الاتصال بالمساعد الذكي' });
    }
  });

  // 11. Clean WhatsApp Endpoints (Strictly scoped to the requested class/recipient)
  app.get('/api/whatsapp/status', (_req, res) => {
    res.json({
      status: whatsappState.status,
      qrDataUrl: whatsappState.qrDataUrl,
      pairingCode: whatsappState.pairingCode,
      phoneNumber: whatsappState.phoneNumber,
      lastError: whatsappState.lastError,
      autoRemindEnabled: whatsappState.autoRemindEnabled,
      reminderMinutesBefore: whatsappState.reminderMinutesBefore,
      customTemplate: whatsappState.customTemplate,
      sentCount: whatsappState.sentCount,
      provider: whatsappState.provider,
      cloudPhoneNumberId: whatsappState.cloudPhoneNumberId,
      hasCloudToken: Boolean(whatsappState.cloudAccessToken),
      webhookUrl: whatsappState.webhookUrl,
      instanceId: whatsappState.instanceId,
      hasApiToken: Boolean(whatsappState.apiToken),
    });
  });

  app.post('/api/whatsapp/connect', (req, res) => {
    const phone = req.body?.phoneNumber;
    whatsappState.status = 'connected';
    if (phone) whatsappState.phoneNumber = phone;
    whatsappState.lastError = null;
    res.json(whatsappState);
  });

  app.post('/api/whatsapp/disconnect', (_req, res) => {
    whatsappState.status = 'disconnected';
    res.json({ success: true });
  });

  app.post('/api/whatsapp/toggle-auto', (req, res) => {
    const { enabled, reminderMinutesBefore } = req.body || {};
    if (typeof enabled === 'boolean') whatsappState.autoRemindEnabled = enabled;
    if (typeof reminderMinutesBefore === 'number') {
      whatsappState.reminderMinutesBefore = reminderMinutesBefore;
    }
    res.json({
      success: true,
      autoRemindEnabled: whatsappState.autoRemindEnabled,
      reminderMinutesBefore: whatsappState.reminderMinutesBefore,
    });
  });

  app.post('/api/whatsapp/save-template', (req, res) => {
    const { template, reminderMinutesBefore } = req.body || {};
    if (typeof template === 'string' && template.trim()) {
      whatsappState.customTemplate = template.trim();
    }
    if (typeof reminderMinutesBefore === 'number') {
      whatsappState.reminderMinutesBefore = reminderMinutesBefore;
    }
    res.json({
      success: true,
      customTemplate: whatsappState.customTemplate,
      reminderMinutesBefore: whatsappState.reminderMinutesBefore,
    });
  });

  app.post('/api/whatsapp/save-provider', (req, res) => {
    const body = req.body || {};
    if (body.provider) whatsappState.provider = body.provider;
    if (body.cloudPhoneNumberId !== undefined) whatsappState.cloudPhoneNumberId = body.cloudPhoneNumberId;
    if (body.cloudAccessToken !== undefined) whatsappState.cloudAccessToken = body.cloudAccessToken;
    if (body.webhookUrl !== undefined) whatsappState.webhookUrl = body.webhookUrl;
    if (body.instanceId !== undefined) whatsappState.instanceId = body.instanceId;
    if (body.apiToken !== undefined) whatsappState.apiToken = body.apiToken;
    whatsappState.status = 'connected';
    res.json({ success: true, status: whatsappState });
  });

  app.post('/api/whatsapp/send-now', async (req, res) => {
    const {
      recipient,
      recipientType = 'group',
      message,
      className = 'الفصل',
      sessionTitle = 'الرياضيات (Math)',
      trigger = 'manual',
    } = req.body || {};

    const cleanRecipient = (recipient || '').trim();
    if (!cleanRecipient || !message) {
      return res.status(400).json({
        success: false,
        error: 'المستلم ونص الرسالة مطلوبان لإرسال التذكير.',
      });
    }

    const isGroupLink = cleanRecipient.includes('chat.whatsapp.com/');
    let externalSent = false;

    // Optional external webhook if explicitly configured by teacher
    if (!isGroupLink && whatsappState.provider === 'webhook' && whatsappState.webhookUrl) {
      try {
        const whRes = await fetch(whatsappState.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: cleanRecipient,
            recipientType,
            message,
            className,
            sessionTitle,
            teacher: 'مستر احمد بدوي',
            subject: 'الرياضيات (Math)',
          }),
        });
        externalSent = whRes.ok;
      } catch {
        externalSent = false;
      }
    }

    whatsappState.sentCount += 1;
    const logEntry: WhatsAppSendLog = {
      id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      className,
      sessionTitle,
      recipient: cleanRecipient,
      recipientType,
      status: 'sent',
      trigger,
    };

    db.whatsappLogs = [logEntry, ...(db.whatsappLogs || [])].slice(0, 100);
    saveDatabase();

    res.json({
      success: true,
      directLinkFallback: !externalSent,
      isGroupLink,
      log: logEntry,
      note: isGroupLink
        ? 'تم تجهيز رسالة الفصل وفتح رابط جروب الفصل المربوط.'
        : 'تم تجهيز الرسالة للإرسال المباشر.',
    });
  });

  app.get('/api/whatsapp/logs', (_req, res) => {
    res.json({ logs: db.whatsappLogs || [] });
  });

  app.post('/api/whatsapp/logs/clear', (_req, res) => {
    db.whatsappLogs = [];
    saveDatabase();
    res.json({ success: true });
  });

  // 12. Vite Dev Middleware / Production Static Assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running cleanly on http://0.0.0.0:${PORT} (Sole Teacher: Mr. Ahmed Badawi - Math)`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
