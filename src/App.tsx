/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  School,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { SimpleNavbar } from './components/SimpleNavbar';
import { SessionHubHome } from './components/SessionHubHome';
import { SessionDetailView } from './components/SessionDetailView';
import { ClassRosterTab } from './components/ClassRosterTab';
import { SimpleRosterModal } from './components/SimpleRosterModal';
import { StudentGateway } from './components/StudentGateway';
import { ConfirmModal } from './components/ConfirmModal';
import { MobileFloatingNav } from './components/MobileFloatingNav';
import { TeacherAuthModal } from './components/TeacherAuthModal';
import { MasterSyncModal } from './components/MasterSyncModal';
import { AiCopilotModal } from './components/AiCopilotModal';
import { normalizeText } from './utils/arabicFuzzy';
import { mergeDuplicateClasses } from './utils/excelParser';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  storage,
  enforceOfficialStudentTracks,
  sanitizeSoleTeacherList,
  DEFAULT_TEACHERS,
} from './utils/storage';
import { WhatsAppHubModal } from './components/WhatsAppHubModal';
import { TeacherScheduleModal } from './components/TeacherScheduleModal';
import { SettingsPage } from './components/SettingsPage';
import {
  ClassSession,
  SchoolClass,
  Student,
  TeacherProfile,
  LanguageTrack,
  AttendanceRecord,
  WhatsAppGroupConfig,
} from './types/index.ts';
import {
  subscribeToAppData,
  subscribeToFirestoreAttendance,
} from './utils/firebase';
import {
  parseAttendanceFromUrl,
  clearAttendanceUrl,
  buildRelativeAttendanceUrl,
  setPublishedDomain,
  ParsedAttendanceInfo,
  getPublishedDomain,
} from './utils/urlHelper';
import {
  fetchServerData,
  fetchServerSessions,
  syncStateToServer,
  listenForSyncEvents,
  listenForServerEvents,
  recordAttendanceViaServer,
  deleteSessionOnServer,
  batchDeleteSessionsOnServer,
  resetAttendanceOnServer,
  createOrUpdateSessionOnServer,
  deleteClassOnServer,
  deleteStudentOnServer,
  batchDeleteStudentsOnServer,
  batchUpdateStudentsOnServer,
  mergeDuplicateClassesOnServer,
  forceSyncBidirectional,
  generateTodaySessionsOnServer,
  createDemoClassWithSchedule,
  getLocalWhatsAppSession,
  saveLocalWhatsAppSession,
  testStudentAttendanceConnectionAndRetry,
  checkDatabaseConnection,
  mergeAttendanceRecordsClient,
  mergeSessionArrays,
} from './utils/apiSync';

export default function App() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testAttendanceConnection = testStudentAttendanceConnectionAndRetry;
      (window as any).checkDbHealth = checkDatabaseConnection;
    }
  }, []);

  const isReceivingRemoteSyncRef = useRef(false);
  const hasLoadedFromServerRef = useRef(false);
  const lastLocalMutationTimeRef = useRef<number>(0);

  // Persistent state exclusively for Mr. Ahmed Badawi
  const [teachers, setTeachers] = useState<TeacherProfile[]>(() => storage.getTeachers());
  const [currentTeacherId, setCurrentTeacherId] = useState<string>('teacher_ahmed_badawi');
  const [classes, setClasses] = useState<SchoolClass[]>(() => storage.getClasses());
  const [students, setStudents] = useState<Student[]>(() => storage.getStudents());
  const [sessions, setSessions] = useState<ClassSession[]>(() => storage.getSessions());

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'sessions' | 'classes' | 'settings'>('sessions');
  const [settingsSubTab, setSettingsSubTab] = useState<
    'schedule' | 'whatsapp' | 'domain' | 'sync' | 'lock' | 'password'
  >('schedule');

  const [selectedSessionIdForDetail, setSelectedSessionIdForDetail] = useState<string | null>(null);
  const [isTeacherUnlocked, setIsTeacherUnlocked] = useState<boolean>(() =>
    storage.isTeacherAuthenticated()
  );

  const [urlAttendance, setUrlAttendance] = useState<ParsedAttendanceInfo>(() =>
    parseAttendanceFromUrl()
  );
  const [attendSessionId, setAttendSessionId] = useState<string | null>(() => {
    const parsed = parseAttendanceFromUrl();
    return parsed.sessionId;
  });

  const isStudentGatewayMode = Boolean(attendSessionId || urlAttendance.isAttendanceMode);

  useEffect(() => {
    const handleUrlChange = () => {
      const parsed = parseAttendanceFromUrl();
      setUrlAttendance(parsed);
      setAttendSessionId(parsed.sessionId);
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Modals state
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMasterSyncModal, setShowMasterSyncModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAiCopilotModal, setShowAiCopilotModal] = useState(false);
  const [whatsAppToast, setWhatsAppToast] = useState<{ message: string; className: string } | null>(
    null
  );
  const [liveAttendanceToast, setLiveAttendanceToast] = useState<{
    studentName: string;
    className: string;
    track?: string;
    joinCount?: number;
  } | null>(null);

  useEffect(() => {
    if (whatsAppToast) {
      const timer = setTimeout(() => setWhatsAppToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [whatsAppToast]);

  useEffect(() => {
    if (liveAttendanceToast) {
      const timer = setTimeout(() => setLiveAttendanceToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [liveAttendanceToast]);

  useEffect(() => {
    storage.saveTeachers(teachers);
  }, [teachers]);

  useEffect(() => {
    storage.setCurrentTeacherId('teacher_ahmed_badawi');
  }, [currentTeacherId]);

  useEffect(() => {
    storage.saveClasses(classes);
  }, [classes]);

  useEffect(() => {
    storage.saveStudents(students);
  }, [students]);

  useEffect(() => {
    storage.saveSessions(sessions);
  }, [sessions]);

  /**
   * Applies an incoming AttendanceRecord strictly to the exact sessionId (s.id === incomingSessionId).
   * Zero cross-session or cross-class fallback.
   */
  const applyIncomingAttendanceRecord = (
    incomingSessionId: string | undefined,
    incomingRecord: AttendanceRecord,
    incomingClassName?: string,
    incomingSessionObj?: ClassSession
  ) => {
    if (!incomingSessionId || storage.isSessionDeleted(incomingSessionId)) return;

    setSessions((prev) => {
      let matchedExact = false;
      const next = prev.map((s) => {
        if (s.id !== incomingSessionId) return s;
        matchedExact = true;

        const mergedAtt = mergeAttendanceRecordsClient(
          s.attendance || [],
          [{ ...incomingRecord, sessionId: s.id }],
          s.lastAttendanceResetAt
        );
        return {
          ...s,
          attendance: mergedAtt,
        };
      });

      if (!matchedExact && incomingSessionObj && incomingSessionObj.id === incomingSessionId) {
        isReceivingRemoteSyncRef.current = true;
        lastLocalMutationTimeRef.current = Date.now();
        const withNew = [
          {
            ...incomingSessionObj,
            id: incomingSessionId,
            teacherId: 'teacher_ahmed_badawi',
            attendance: [{ ...incomingRecord, sessionId: incomingSessionId }],
          },
          ...prev,
        ];
        storage.saveSessions(withNew);
        return withNew;
      }

      if (matchedExact) {
        isReceivingRemoteSyncRef.current = true;
        lastLocalMutationTimeRef.current = Date.now();
        storage.saveSessions(next);
        return next;
      }
      return prev;
    });

    if (!isStudentGatewayMode && incomingRecord?.studentName) {
      setLiveAttendanceToast({
        studentName: incomingRecord.matchedRosterName || incomingRecord.studentName,
        className: incomingClassName || incomingSessionObj?.className || '',
        track: incomingRecord.track,
        joinCount: incomingRecord.joinCount,
      });
    }
  };

  // 1. Initial load from unified server database on mount
  useEffect(() => {
    let isMounted = true;
    isReceivingRemoteSyncRef.current = true;

    fetchServerData()
      .then(async (data) => {
        if (!isMounted) return;
        if (data) {
          if (Array.isArray(data.classes) && data.classes.length > 0) {
            setClasses(data.classes);
            storage.saveClasses(data.classes);
          }
          if (Array.isArray(data.students) && data.students.length > 0) {
            const enforced = enforceOfficialStudentTracks(data.students);
            setStudents(enforced);
            storage.saveStudents(enforced);
          }
          if (Array.isArray(data.teachers) && data.teachers.length > 0) {
            const cleanTeachers = sanitizeSoleTeacherList(data.teachers);
            setTeachers(cleanTeachers);
            storage.saveTeachers(cleanTeachers);
          }
          if (data.teacherPin) {
            storage.saveTeacherPin(data.teacherPin);
          }

          const localSessions = storage.getSessions();
          const serverSessions = Array.isArray(data.sessions) ? data.sessions : [];

          if (serverSessions.length > 0) {
            const merged = mergeSessionArrays(localSessions, serverSessions);
            setSessions(merged);
            storage.saveSessions(merged);
          } else if (localSessions.length > 0 && !isStudentGatewayMode) {
            syncStateToServer({
              sessions: localSessions,
              classes: storage.getClasses(),
              students: storage.getStudents(),
              teachers: storage.getTeachers(),
            });
          } else if (!isStudentGatewayMode) {
            const genRes = await generateTodaySessionsOnServer('teacher_ahmed_badawi');
            if (isMounted && genRes.success && Array.isArray(genRes.sessions)) {
              setSessions(genRes.sessions);
            }
          }
        }
        hasLoadedFromServerRef.current = true;
        isReceivingRemoteSyncRef.current = false;
      })
      .catch(() => {
        if (isMounted) {
          hasLoadedFromServerRef.current = true;
          isReceivingRemoteSyncRef.current = false;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isStudentGatewayMode]);

  // Debounced state sync to unified server when local teacher changes occur
  useEffect(() => {
    if (!hasLoadedFromServerRef.current) return;
    if (isStudentGatewayMode || !isTeacherUnlocked) return;
    if (isReceivingRemoteSyncRef.current) {
      isReceivingRemoteSyncRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      syncStateToServer({
        sessions,
        classes,
        students,
        teachers,
        currentTeacherId: 'teacher_ahmed_badawi',
        whatsappSession: getLocalWhatsAppSession(),
        publishedDomain: getPublishedDomain(),
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [sessions, classes, students, teachers, isStudentGatewayMode, isTeacherUnlocked]);

  // 2. Real-time Cross-Tab BroadcastChannel Listener
  useEffect(() => {
    const unsubscribe = listenForSyncEvents((msg) => {
      if (!msg || !msg.type) return;

      if (msg.type === 'ATTENDANCE_RECORDED' && msg.record) {
        applyIncomingAttendanceRecord(
          msg.sessionId,
          msg.record,
          msg.className,
          msg.session
        );
      } else if (msg.type === 'SESSION_UPDATED' && msg.session) {
        isReceivingRemoteSyncRef.current = true;
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === msg.session.id);
          const next = exists
            ? prev.map((s) =>
                s.id === msg.session.id
                  ? {
                      ...s,
                      ...msg.session,
                      attendance: mergeAttendanceRecordsClient(
                        s.attendance || [],
                        msg.session.attendance || [],
                        msg.session.lastAttendanceResetAt || s.lastAttendanceResetAt
                      ),
                    }
                  : s
              )
            : [msg.session, ...prev];
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'SESSION_DELETED' && msg.sessionId) {
        storage.addDeletedSessionId(msg.sessionId);
        isReceivingRemoteSyncRef.current = true;
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== msg.sessionId);
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'SESSIONS_BATCH_DELETED' && Array.isArray(msg.sessionIds)) {
        storage.addDeletedSessionIds(msg.sessionIds);
        isReceivingRemoteSyncRef.current = true;
        const idSet = new Set(msg.sessionIds);
        setSessions((prev) => {
          const next = prev.filter((s) => !idSet.has(s.id));
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'ATTENDANCE_RESET') {
        isReceivingRemoteSyncRef.current = true;
        const resetAt = new Date().toISOString();
        setSessions((prev) => {
          const next = prev.map((s) => ({
            ...s,
            attendance: [],
            lastAttendanceResetAt: resetAt,
          }));
          storage.saveSessions(next);
          return next;
        });
      }
    });
    return () => unsubscribe();
  }, [isStudentGatewayMode]);

  // 3. Real-time Server-Sent Events (SSE) Live Stream Listener
  useEffect(() => {
    const unsubscribe = listenForServerEvents((msg) => {
      if (!msg || !msg.type) return;

      if (msg.type === 'ATTENDANCE_RECORDED' && msg.record) {
        applyIncomingAttendanceRecord(
          msg.sessionId,
          msg.record,
          msg.className,
          msg.session
        );
      } else if (
        (msg.type === 'SESSION_UPSERTED' || msg.type === 'SESSION_CREATED_OR_UPDATED') &&
        msg.session
      ) {
        isReceivingRemoteSyncRef.current = true;
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === msg.session.id);
          const next =
            idx >= 0
              ? prev.map((s, i) =>
                  i === idx
                    ? {
                        ...s,
                        ...msg.session,
                        attendance: mergeAttendanceRecordsClient(
                          s.attendance || [],
                          msg.session.attendance || [],
                          msg.session.lastAttendanceResetAt || s.lastAttendanceResetAt
                        ),
                      }
                    : s
                )
              : [msg.session, ...prev];
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'SESSION_DELETED' && msg.sessionId) {
        storage.addDeletedSessionId(msg.sessionId);
        isReceivingRemoteSyncRef.current = true;
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== msg.sessionId);
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'SESSIONS_BATCH_DELETED' && Array.isArray(msg.sessionIds)) {
        storage.addDeletedSessionIds(msg.sessionIds);
        isReceivingRemoteSyncRef.current = true;
        const idSet = new Set(msg.sessionIds);
        setSessions((prev) => {
          const next = prev.filter((s) => !idSet.has(s.id));
          storage.saveSessions(next);
          return next;
        });
      } else if (msg.type === 'ATTENDANCE_RESET') {
        isReceivingRemoteSyncRef.current = true;
        if (Array.isArray(msg.sessions)) {
          setSessions(msg.sessions);
          storage.saveSessions(msg.sessions);
        }
      } else if (msg.type === 'STATE_SYNCED') {
        if (Date.now() - lastLocalMutationTimeRef.current < 2500) return;
        isReceivingRemoteSyncRef.current = true;
        if (Array.isArray(msg.classes) && msg.classes.length > 0) {
          setClasses(msg.classes);
          storage.saveClasses(msg.classes);
        }
        if (Array.isArray(msg.students) && msg.students.length > 0) {
          const enforced = enforceOfficialStudentTracks(msg.students);
          setStudents(enforced);
          storage.saveStudents(enforced);
        }
        if (Array.isArray(msg.teachers) && msg.teachers.length > 0) {
          const clean = sanitizeSoleTeacherList(msg.teachers);
          setTeachers(clean);
          storage.saveTeachers(clean);
        }
        if (Array.isArray(msg.sessions)) {
          setSessions((prev) => {
            const merged = mergeSessionArrays(prev, msg.sessions);
            storage.saveSessions(merged);
            return merged;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [isStudentGatewayMode]);

  // 4. Local in-memory attendance subscriber (strictly exact sessionId)
  useEffect(() => {
    const unsubAtt = subscribeToFirestoreAttendance(({ entries }) => {
      if (!entries || entries.length === 0) return;
      setSessions((prev) => {
        let anyChanged = false;
        const next = prev.map((s) => {
          const matchingEntries = entries.filter(
            (env) => env && env.record && env.sessionId === s.id
          );
          if (matchingEntries.length === 0) return s;

          const mergedAtt = mergeAttendanceRecordsClient(
            s.attendance || [],
            matchingEntries.map((e) => ({ ...e.record, sessionId: s.id })),
            s.lastAttendanceResetAt
          );
          if (mergedAtt.length !== (s.attendance || []).length) {
            anyChanged = true;
            return { ...s, attendance: mergedAtt };
          }
          return s;
        });

        if (anyChanged) {
          isReceivingRemoteSyncRef.current = true;
          storage.saveSessions(next);
          return next;
        }
        return prev;
      });
    });

    const unsubShared = subscribeToAppData((fbData) => {
      if (!fbData || Date.now() - lastLocalMutationTimeRef.current < 3000) return;
      if (Array.isArray(fbData.sessions) && fbData.sessions.length > 0) {
        setSessions((prev) => {
          const merged = mergeSessionArrays(prev, fbData.sessions);
          if (JSON.stringify(merged) !== JSON.stringify(prev)) {
            isReceivingRemoteSyncRef.current = true;
            storage.saveSessions(merged);
            return merged;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubAtt();
      unsubShared();
    };
  }, []);

  // 5. Periodic clean server sync every 3 seconds
  useEffect(() => {
    let isSyncing = false;

    const syncRemoteUpdates = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const remoteData = await fetchServerData();
        if (!remoteData) return;

        const recentlyMutatedLocally = Date.now() - lastLocalMutationTimeRef.current < 3000;

        if (Array.isArray(remoteData.sessions)) {
          setSessions((prev) => {
            if (recentlyMutatedLocally) {
              const remoteMap = new Map(remoteData.sessions.map((r) => [r.id, r]));
              let attChanged = false;
              const updated = prev.map((local) => {
                const remote = remoteMap.get(local.id);
                if (!remote) return local;
                const mergedAtt = mergeAttendanceRecordsClient(
                  local.attendance || [],
                  remote.attendance || [],
                  remote.lastAttendanceResetAt || local.lastAttendanceResetAt
                );
                if (mergedAtt.length !== (local.attendance || []).length) {
                  attChanged = true;
                }
                return { ...local, attendance: mergedAtt };
              });
              if (attChanged) {
                isReceivingRemoteSyncRef.current = true;
                storage.saveSessions(updated);
                return updated;
              }
              return prev;
            }

            const merged = mergeSessionArrays(prev, remoteData.sessions);
            if (JSON.stringify(merged) !== JSON.stringify(prev)) {
              isReceivingRemoteSyncRef.current = true;
              storage.saveSessions(merged);
              return merged;
            }
            return prev;
          });
        }
      } finally {
        isSyncing = false;
      }
    };

    const interval = setInterval(syncRemoteUpdates, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sole Teacher Profile (Mr. Ahmed Badawi)
  const currentTeacher = teachers[0] || DEFAULT_TEACHERS[0];
  const teacherSessions = sessions;

  // -------------------------------------------------------------
  // Session Handlers (Add, Update, Delete)
  // -------------------------------------------------------------
  const handleCreateSession = (
    classId: string,
    className: string,
    title: string,
    zoomUrl: string,
    targetTrack: LanguageTrack = 'all',
    customSessionId?: string
  ): ClassSession => {
    lastLocalMutationTimeRef.current = Date.now();
    const newSessionId =
      customSessionId && !storage.isSessionDeleted(customSessionId)
        ? customSessionId
        : `ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    storage.clearDeletedSessionId(newSessionId);

    const newSession: ClassSession = {
      id: newSessionId,
      teacherId: 'teacher_ahmed_badawi',
      classId,
      className,
      sessionTitle: title || `الرياضيات (Math) - ${className}`,
      zoomUrl,
      targetTrack,
      createdAt: new Date().toISOString(),
      scheduledTime: 'مباشر الآن',
      isActive: true,
      attendance: [],
    };

    setSessions((prev) => {
      const normClassName = normalizeText(className || '');
      const deactivatedPrev = prev.map((s) => {
        const isSameClass =
          s.isActive &&
          ((classId && classId !== 'class_auto' && s.classId === classId) ||
            (normClassName && normalizeText(s.className || '') === normClassName));
        if (isSameClass && s.id !== newSessionId) {
          return { ...s, isActive: false };
        }
        return s;
      });

      const updated = [newSession, ...deactivatedPrev.filter((s) => s.id !== newSessionId)];
      storage.saveSessions(updated);
      createOrUpdateSessionOnServer(newSession);
      return updated;
    });

    return newSession;
  };

  const handleUpdateSession = (updated: {
    id: string;
    sessionTitle: string;
    classId: string;
    className: string;
    zoomUrl: string;
    targetTrack?: LanguageTrack;
  }) => {
    lastLocalMutationTimeRef.current = Date.now();
    const cleanedZoom = (updated.zoomUrl || '').trim();

    setSessions((prev) => {
      const newSessions = prev.map((s) =>
        s.id === updated.id
          ? {
              ...s,
              sessionTitle: updated.sessionTitle,
              classId: updated.classId,
              className: updated.className,
              zoomUrl: cleanedZoom,
              targetTrack: updated.targetTrack ?? s.targetTrack,
            }
          : s
      );
      const targetSession = newSessions.find((s) => s.id === updated.id);
      if (targetSession) {
        createOrUpdateSessionOnServer(targetSession);
      }
      storage.saveSessions(newSessions);
      return newSessions;
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!sessionId) return;
    lastLocalMutationTimeRef.current = Date.now();
    storage.addDeletedSessionId(sessionId);

    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      storage.saveSessions(updated);
      return updated;
    });

    if (selectedSessionIdForDetail === sessionId) {
      setSelectedSessionIdForDetail(null);
    }

    deleteSessionOnServer(sessionId);
  };

  const handleBatchDeleteSessions = (sessionIds: string[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    const idSet = new Set(sessionIds);
    storage.addDeletedSessionIds(sessionIds);
    batchDeleteSessionsOnServer(sessionIds);
    setSessions((prev) => {
      const updated = prev.filter((s) => !idSet.has(s.id));
      storage.saveSessions(updated);
      return updated;
    });
    if (selectedSessionIdForDetail && idSet.has(selectedSessionIdForDetail)) {
      setSelectedSessionIdForDetail(null);
    }
  };

  const handleResetAttendance = () => {
    lastLocalMutationTimeRef.current = Date.now();
    const resetAt = new Date().toISOString();
    setSessions((prev) => {
      const updated = prev.map((s) => ({
        ...s,
        attendance: [],
        lastAttendanceResetAt: resetAt,
      }));
      storage.saveSessions(updated);
      return updated;
    });
    resetAttendanceOnServer('teacher_ahmed_badawi');
  };

  const handleUpdateSessionZoom = (sessionId: string, newZoomUrl: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    const cleanedZoom = (newZoomUrl || '').trim();

    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, zoomUrl: cleanedZoom } : s));
      storage.saveSessions(updated);
      const target = updated.find((s) => s.id === sessionId);
      if (target) createOrUpdateSessionOnServer(target);
      return updated;
    });
  };

  const handleUpdateSessionAttendance = (updatedSession: ClassSession) => {
    lastLocalMutationTimeRef.current = Date.now();
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === updatedSession.id ? updatedSession : s));
      storage.saveSessions(updated);
      createOrUpdateSessionOnServer(updatedSession);
      return updated;
    });
  };

  const handleGenerateTodaySessions = async () => {
    lastLocalMutationTimeRef.current = Date.now();
    const result = await generateTodaySessionsOnServer('teacher_ahmed_badawi');
    if (result.success && Array.isArray(result.sessions)) {
      setSessions(result.sessions);
      storage.saveSessions(result.sessions);
    }
  };

  const handleCreateDemoClass = async (customTime?: string, link?: string) => {
    const result = await createDemoClassWithSchedule(customTime, link);
    if (result.success) {
      setClasses(storage.getClasses());
      setTeachers(storage.getTeachers());
      setSessions(storage.getSessions());
    }
  };

  // -------------------------------------------------------------
  // Class & Student Handlers
  // -------------------------------------------------------------
  const handleAddClass = (name: string, gradeLevel: string, zoomUrl?: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    const newClass: SchoolClass = {
      id: `class_${Date.now()}`,
      name,
      gradeLevel,
      zoomUrl,
      createdAt: new Date().toISOString(),
    };
    setClasses((prev) => {
      const updated = [...prev, newClass];
      storage.saveClasses(updated);
      syncStateToServer({ classes: updated, students, sessions });
      return updated;
    });
  };

  const handleUpdateClass = (
    id: string,
    name: string,
    gradeLevel: string,
    zoomUrl?: string,
    whatsappRecipient?: string,
    whatsappRecipientType?: 'phone' | 'group',
    whatsappGroups?: WhatsAppGroupConfig[]
  ) => {
    lastLocalMutationTimeRef.current = Date.now();
    const cleanedZoom = zoomUrl ? zoomUrl.trim() : '';

    setClasses((prev) => {
      const updatedClasses = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name,
              gradeLevel,
              zoomUrl: cleanedZoom,
              whatsappRecipient:
                whatsappRecipient !== undefined ? whatsappRecipient : c.whatsappRecipient,
              whatsappRecipientType:
                whatsappRecipientType !== undefined
                  ? whatsappRecipientType
                  : c.whatsappRecipientType,
              whatsappGroups: whatsappGroups !== undefined ? whatsappGroups : c.whatsappGroups,
            }
          : c
      );
      storage.saveClasses(updatedClasses);
      syncStateToServer({ classes: updatedClasses, students, sessions });
      return updatedClasses;
    });

    setTeachers((prev) => {
      const updatedTeachers = prev.map((t) => {
        const nextLinks = { ...(t.classZoomLinks || {}) };
        if (cleanedZoom) {
          nextLinks[id] = cleanedZoom;
        } else {
          delete nextLinks[id];
        }
        return { ...t, classZoomLinks: nextLinks };
      });
      storage.saveTeachers(updatedTeachers);
      return updatedTeachers;
    });

    setSessions((prev) => {
      const updatedSessions = prev.map((s) =>
        s.classId === id ? { ...s, className: name, zoomUrl: cleanedZoom } : s
      );
      storage.saveSessions(updatedSessions);
      return updatedSessions;
    });
  };

  const handleDeleteClass = (classId: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    deleteClassOnServer(classId);
    const updatedClasses = classes.filter((c) => c.id !== classId);
    const updatedStudents = students.filter((s) => s.classId !== classId);
    const updatedSessions = sessions.filter((s) => s.classId !== classId);

    setClasses(updatedClasses);
    setStudents(updatedStudents);
    setSessions(updatedSessions);

    storage.saveClasses(updatedClasses);
    storage.saveStudents(updatedStudents);
    storage.saveSessions(updatedSessions);

    syncStateToServer({
      classes: updatedClasses,
      students: updatedStudents,
      sessions: updatedSessions,
    });
  };

  const handleSaveFullRoster = (newClasses: SchoolClass[], newStudents: Student[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    const mergeRes = mergeDuplicateClasses(newClasses, newStudents, sessions);
    setClasses(mergeRes.classes);
    setStudents(mergeRes.students);
    setSessions(mergeRes.sessions);

    storage.saveClasses(mergeRes.classes);
    storage.saveStudents(mergeRes.students);
    storage.saveSessions(mergeRes.sessions);

    syncStateToServer({
      classes: mergeRes.classes,
      students: mergeRes.students,
      sessions: mergeRes.sessions,
    });
  };

  const handleMergeDuplicateClasses = async (): Promise<number> => {
    const localRes = mergeDuplicateClasses(classes, students, sessions);
    setClasses(localRes.classes);
    setStudents(localRes.students);
    setSessions(localRes.sessions);

    storage.saveClasses(localRes.classes);
    storage.saveStudents(localRes.students);
    storage.saveSessions(localRes.sessions);

    const serverRes = await mergeDuplicateClassesOnServer();
    if (serverRes.success && serverRes.classes && serverRes.students) {
      setClasses(serverRes.classes);
      setStudents(serverRes.students);
      if (serverRes.sessions) setSessions(serverRes.sessions);
      return serverRes.mergedCount || localRes.mergedCount;
    }

    return localRes.mergedCount;
  };

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    try {
      const pin = storage.getTeacherPin();
      const result = await forceSyncBidirectional({
        teachers,
        currentTeacherId: 'teacher_ahmed_badawi',
        classes,
        students,
        sessions,
        adminPassword: pin,
      });
      if (result.data) {
        setClasses(result.data.classes);
        setStudents(result.data.students);
        setSessions(result.data.sessions);
        setTeachers(result.data.teachers);
      }
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleExecuteMasterSync = async (
    options: {
      syncClasses: boolean;
      syncStudents: boolean;
      syncSessions: boolean;
      syncTeachers: boolean;
    },
    adminPassword?: string
  ) => {
    const payload: any = { currentTeacherId: 'teacher_ahmed_badawi', adminPassword };
    if (options.syncClasses) payload.classes = classes;
    if (options.syncStudents) payload.students = students;
    if (options.syncSessions) payload.sessions = sessions;
    if (options.syncTeachers) payload.teachers = teachers;

    const res = await forceSyncBidirectional(payload);
    if (res.success && res.data) {
      if (options.syncClasses) setClasses(res.data.classes);
      if (options.syncStudents) setStudents(res.data.students);
      if (options.syncSessions) setSessions(res.data.sessions);
      if (options.syncTeachers) setTeachers(res.data.teachers);
    }

    return {
      success: !!res.success,
      structuralUpdateAccepted: res.structuralUpdateAccepted,
      warning: res.warning,
      syncedCounts: {
        classes: options.syncClasses ? (res.data?.classes?.length ?? classes.length) : 0,
        students: options.syncStudents ? (res.data?.students?.length ?? students.length) : 0,
        sessions: options.syncSessions ? (res.data?.sessions?.length ?? sessions.length) : 0,
        teachers: 1,
      },
    };
  };

  const handleAddStudent = (studentData: Omit<Student, 'id'>) => {
    lastLocalMutationTimeRef.current = Date.now();
    const newStudent: Student = {
      ...studentData,
      id: `st_${Date.now()}`,
    };
    setStudents((prev) => {
      const updated = [...prev, newStudent];
      storage.saveStudents(updated);
      syncStateToServer({ students: updated, classes, sessions });
      return updated;
    });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    lastLocalMutationTimeRef.current = Date.now();
    setStudents((prev) => {
      const updated = prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
      storage.saveStudents(updated);
      syncStateToServer({ students: updated, classes, sessions });
      return updated;
    });
  };

  const handleDeleteStudent = (studentId: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    deleteStudentOnServer(studentId);
    setStudents((prev) => {
      const updated = prev.filter((s) => s.id !== studentId);
      storage.saveStudents(updated);
      syncStateToServer({ students: updated, classes, sessions });
      return updated;
    });
  };

  const handleBatchUpdateStudents = (
    studentIds: string[],
    updates: { track?: 'english' | 'arabic'; classId?: string }
  ) => {
    lastLocalMutationTimeRef.current = Date.now();
    batchUpdateStudentsOnServer(studentIds, updates);
    const idSet = new Set(studentIds);
    setStudents((prev) => {
      const updated = prev.map((s) => {
        if (idSet.has(s.id)) {
          return {
            ...s,
            track: updates.track !== undefined ? updates.track : s.track,
            classId: updates.classId !== undefined ? updates.classId : s.classId,
          };
        }
        return s;
      });
      storage.saveStudents(updated);
      syncStateToServer({ students: updated, classes, sessions });
      return updated;
    });
  };

  const handleBatchDeleteStudents = (studentIds: string[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    batchDeleteStudentsOnServer(studentIds);
    const idSet = new Set(studentIds);
    setStudents((prev) => {
      const updated = prev.filter((s) => !idSet.has(s.id));
      storage.saveStudents(updated);
      syncStateToServer({ students: updated, classes, sessions });
      return updated;
    });
  };

  // -------------------------------------------------------------
  // Student Gateway Attendance Recording (Strictly Exact Session Only)
  // -------------------------------------------------------------
  const handleRecordAttendanceFromGateway = (
    sessionId: string,
    studentName: string,
    matchedStudent?: Student,
    confidenceScore = 1.0,
    serverRecord?: AttendanceRecord
  ) => {
    if (!sessionId) return;
    const finalRecord: AttendanceRecord = serverRecord || {
      id: `att_${Date.now()}`,
      sessionId,
      studentId: matchedStudent?.id,
      studentName,
      matchedRosterName: matchedStudent?.name,
      track: matchedStudent?.track,
      timestamp: new Date().toISOString(),
      lastJoinedAt: new Date().toISOString(),
      joinCount: 1,
      status: 'present',
      confidenceScore,
    };

    lastLocalMutationTimeRef.current = Date.now();

    setSessions((prev) => {
      let matchedExact = false;
      const updated = prev.map((s) => {
        if (s.id !== sessionId) return s;
        matchedExact = true;

        const mergedAtt = mergeAttendanceRecordsClient(
          s.attendance || [],
          [{ ...finalRecord, sessionId: s.id }],
          s.lastAttendanceResetAt
        );
        return { ...s, attendance: mergedAtt };
      });

      if (matchedExact) {
        storage.saveSessions(updated);
        return updated;
      }

      if (urlAttendance.reconstructedSession && urlAttendance.reconstructedSession.id === sessionId) {
        const withReconstructed = [
          {
            ...urlAttendance.reconstructedSession,
            id: sessionId,
            teacherId: 'teacher_ahmed_badawi',
            attendance: [finalRecord],
          },
          ...prev,
        ];
        storage.saveSessions(withReconstructed);
        return withReconstructed;
      }
      return prev;
    });
  };

  const handleOpenStudentGateway = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const relativeLink = buildRelativeAttendanceUrl(session, currentTeacher);

    try {
      window.history.pushState(null, '', relativeLink);
    } catch {
      window.location.hash = `attend/${sessionId}`;
    }

    setAttendSessionId(sessionId);
    setUrlAttendance({
      isAttendanceMode: true,
      sessionId,
      reconstructedSession: session,
      reconstructedTeacher: currentTeacher,
    });
  };

  const handleExitStudentGateway = () => {
    clearAttendanceUrl();
    setAttendSessionId(null);
    setUrlAttendance({
      isAttendanceMode: false,
      sessionId: null,
      reconstructedSession: null,
      reconstructedTeacher: null,
    });
    setIsTeacherUnlocked(storage.isTeacherAuthenticated());
  };

  const handleQuickAddClick = () => {
    setSelectedSessionIdForDetail(null);
    setActiveTab('sessions');
    setTimeout(() => {
      const el = document.getElementById('quick-add-session-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const clickable = el.querySelector('[role="button"]') as HTMLElement | null;
        if (clickable && !el.querySelector('form')) {
          clickable.click();
        }
        const input = el.querySelector('input');
        input?.focus();
      }
    }, 120);
  };

  const handleResetData = () => {
    storage.resetToDefault();
    setTeachers(storage.getTeachers());
    setCurrentTeacherId('teacher_ahmed_badawi');
    setClasses(storage.getClasses());
    setStudents(storage.getStudents());
    setSessions(storage.getSessions());
    setSelectedSessionIdForDetail(null);
    setActiveTab('sessions');
    setShowResetConfirmModal(false);
  };

  // -----------------------------------------------------------------
  // Student Gateway Screen
  // -----------------------------------------------------------------
  if (attendSessionId || urlAttendance.isAttendanceMode) {
    const activeId = attendSessionId || urlAttendance.sessionId;
    let targetSession = sessions.find((s) => s.id === activeId);
    if (!targetSession && urlAttendance.reconstructedSession) {
      targetSession = urlAttendance.reconstructedSession;
    }

    if (!targetSession) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 dir-rtl text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-2">رابط الحصة غير متاح</h2>
            <p className="text-xs text-slate-500 mb-4">
              تأكد من صحة الرابط المرسل من مستر أحمد بدوي.
            </p>
            <button
              onClick={handleExitStudentGateway}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }

    return (
      <StudentGateway
        session={targetSession}
        allStudents={students}
        teacher={currentTeacher}
        onRecordAttendance={handleRecordAttendanceFromGateway}
        onBackToDashboard={handleExitStudentGateway}
      />
    );
  }

  // -----------------------------------------------------------------
  // Teacher Access Guard
  // -----------------------------------------------------------------
  if (!isTeacherUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 flex items-center justify-center p-4 dir-rtl text-center font-sans">
        <TeacherAuthModal
          isOpen={true}
          onSuccess={() => setIsTeacherUnlocked(true)}
          onStudentRedirect={
            sessions.length > 0 ? () => setAttendSessionId(sessions[0].id) : undefined
          }
          title="لوحة تحكم مستر أحمد بدوي"
          description="هذه المنطقة مخصصة لمستر أحمد بدوي (معلم الرياضيات Math) ومحمية برمز مرور سري لمنع دخول الطلاب."
        />
      </div>
    );
  }

  const currentDetailSession = sessions.find((s) => s.id === selectedSessionIdForDetail);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-slate-100/70 flex flex-col dir-rtl text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      <SimpleNavbar
        currentTeacher={currentTeacher}
        allTeachers={teachers}
        onSwitchTeacher={() => setCurrentTeacherId('teacher_ahmed_badawi')}
        onOpenRosterModal={() => setShowRosterModal(true)}
        onResetData={() => setShowResetConfirmModal(true)}
        onOpenPasswordModal={() => {
          setSettingsSubTab('password');
          setActiveTab('settings');
        }}
        onLockDashboard={() => {
          storage.setTeacherAuthenticated(false);
          setIsTeacherUnlocked(false);
        }}
        onGoHome={() => {
          setSelectedSessionIdForDetail(null);
          setActiveTab('sessions');
        }}
        currentClassName={currentDetailSession?.className}
        activeMainTab={activeTab}
        onTabChange={(tab) => {
          setSelectedSessionIdForDetail(null);
          setActiveTab(tab);
        }}
        onManualSync={handleManualSync}
        syncStatus={syncStatus}
        onOpenMasterSyncModal={() => {
          setSettingsSubTab('sync');
          setActiveTab('settings');
        }}
        onOpenWhatsAppHub={() => {
          setSettingsSubTab('whatsapp');
          setActiveTab('settings');
        }}
        onOpenScheduleModal={() => {
          setSettingsSubTab('schedule');
          setActiveTab('settings');
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-2.5 sm:p-4 lg:p-5 pb-28 sm:pb-24">
        {selectedSessionIdForDetail && currentDetailSession ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedSessionIdForDetail(null)}
                className="flex items-center gap-2 text-xs font-black text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للوحة الحصص</span>
              </button>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                حصة فصل {currentDetailSession.className} · الرياضيات (Math)
              </span>
            </div>

            <SessionDetailView
              session={currentDetailSession}
              currentTeacher={currentTeacher}
              students={students}
              classes={classes}
              onBackToSessions={() => setSelectedSessionIdForDetail(null)}
              onUpdateSessionAttendance={handleUpdateSessionAttendance}
              onUpdateSessionZoom={handleUpdateSessionZoom}
              onUpdateSession={handleUpdateSession}
              onDeleteSession={handleDeleteSession}
              onOpenStudentGateway={handleOpenStudentGateway}
            />
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-3.5">
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('sessions')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'sessions'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>الحصص وزوم المباشر</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    activeTab === 'sessions'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {teacherSessions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('classes')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'classes'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <School className="w-4 h-4" />
                <span>إدارة الفصول والطلاب</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    activeTab === 'classes'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {classes.length}
                </span>
              </button>
            </div>

            {activeTab === 'settings' ? (
              <SettingsPage
                currentTeacher={currentTeacher}
                teachers={teachers}
                classes={classes}
                students={students}
                sessions={sessions}
                initialSubTab={settingsSubTab}
                onScheduleSaved={(updatedTeacher, _count) => {
                  lastLocalMutationTimeRef.current = Date.now();
                  const clean = sanitizeSoleTeacherList([updatedTeacher]);
                  setTeachers(clean);
                  storage.saveTeachers(clean);
                  syncStateToServer({
                    teachers: clean,
                    classes,
                    students,
                    sessions,
                  });
                }}
                onDailySessionsGenerated={(_count) => {
                  fetchServerSessions().then((serverSessions) => {
                    if (serverSessions) setSessions(serverSessions);
                  });
                }}
                onLockDashboard={() => {
                  storage.setTeacherAuthenticated(false);
                  setIsTeacherUnlocked(false);
                }}
                onExecuteSync={handleExecuteMasterSync}
                onTeachersUpdated={(updated) => {
                  lastLocalMutationTimeRef.current = Date.now();
                  const clean = sanitizeSoleTeacherList(updated);
                  setTeachers(clean);
                  storage.saveTeachers(clean);
                  setClasses(storage.getClasses());
                  setSessions(storage.getSessions());
                }}
                onSessionsUpdated={(updated) => {
                  lastLocalMutationTimeRef.current = Date.now();
                  setSessions(updated);
                  storage.saveSessions(updated);
                }}
              />
            ) : activeTab === 'classes' ? (
              <ClassRosterTab
                currentTeacher={currentTeacher}
                classes={classes}
                students={students}
                onAddClass={handleAddClass}
                onUpdateClass={handleUpdateClass}
                onDeleteClass={handleDeleteClass}
                onSaveFullRoster={handleSaveFullRoster}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onBatchUpdateStudents={handleBatchUpdateStudents}
                onBatchDeleteStudents={handleBatchDeleteStudents}
                onMergeDuplicateClasses={handleMergeDuplicateClasses}
              />
            ) : (
              <SessionHubHome
                currentTeacher={currentTeacher}
                allTeachers={teachers}
                classes={classes}
                students={students}
                sessions={sessions}
                onEnterSession={(sessionId) => setSelectedSessionIdForDetail(sessionId)}
                onCreateSession={handleCreateSession}
                onUpdateSession={handleUpdateSession}
                onDeleteSession={handleDeleteSession}
                onBatchDeleteSessions={handleBatchDeleteSessions}
                onResetAttendance={handleResetAttendance}
                onOpenStudentGateway={handleOpenStudentGateway}
                onSwitchToClassesTab={() => setActiveTab('classes')}
                onOpenPasswordModal={() => {
                  setSettingsSubTab('password');
                  setActiveTab('settings');
                }}
                onOpenWhatsAppHub={() => {
                  setSettingsSubTab('whatsapp');
                  setActiveTab('settings');
                }}
                onOpenScheduleModal={() => {
                  setSettingsSubTab('schedule');
                  setActiveTab('settings');
                }}
                onGenerateTodaySessions={handleGenerateTodaySessions}
                onCreateDemoClass={handleCreateDemoClass}
              />
            )}
          </div>
        )}
      </main>

      {liveAttendanceToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-emerald-400">حضور لحظي مباشر</span>
                {liveAttendanceToast.className && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                    فصل {liveAttendanceToast.className}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white truncate mt-0.5">
                {liveAttendanceToast.studentName}
                {liveAttendanceToast.joinCount && liveAttendanceToast.joinCount > 1
                  ? ` (أعاد الدخول ${liveAttendanceToast.joinCount}×)`
                  : ' — سجل حضوره الآن'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLiveAttendanceToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <MobileFloatingNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedSessionIdForDetail(null);
          setActiveTab(tab);
        }}
        onQuickAddClick={handleQuickAddClick}
        currentTeacher={currentTeacher}
        allTeachers={teachers}
        onSwitchTeacher={() => setCurrentTeacherId('teacher_ahmed_badawi')}
        sessionsCount={teacherSessions.length}
        classesCount={classes.length}
        latestSession={teacherSessions[0] || null}
        onOpenAiCopilot={() => setShowAiCopilotModal(true)}
      />

      <AiCopilotModal
        isOpen={showAiCopilotModal}
        onClose={() => setShowAiCopilotModal(false)}
        currentTeacher={currentTeacher}
        onStateUpdated={(updatedDb) => {
          lastLocalMutationTimeRef.current = Date.now();
          if (Array.isArray(updatedDb.classes)) {
            setClasses(updatedDb.classes);
            storage.saveClasses(updatedDb.classes);
          }
          if (Array.isArray(updatedDb.students)) {
            const enforced = enforceOfficialStudentTracks(updatedDb.students);
            setStudents(enforced);
            storage.saveStudents(enforced);
          }
          if (Array.isArray(updatedDb.teachers)) {
            const clean = sanitizeSoleTeacherList(updatedDb.teachers);
            setTeachers(clean);
            storage.saveTeachers(clean);
          }
          if (Array.isArray(updatedDb.sessions)) {
            setSessions(updatedDb.sessions);
            storage.saveSessions(updatedDb.sessions);
          }
        }}
      />

      <WhatsAppHubModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        classes={classes}
        sessions={sessions}
        currentTeacher={currentTeacher}
      />

      <TeacherScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        teacher={currentTeacher}
        classes={classes}
        onScheduleSaved={(updatedTeacher, _newCount) => {
          lastLocalMutationTimeRef.current = Date.now();
          const clean = sanitizeSoleTeacherList([updatedTeacher]);
          setTeachers(clean);
          storage.saveTeachers(clean);
          syncStateToServer({
            teachers: clean,
            classes,
            students,
            sessions,
          });
        }}
        onDailySessionsGenerated={(_count) => {
          fetchServerSessions().then((serverSessions) => {
            if (serverSessions) setSessions(serverSessions);
          });
        }}
      />

      <SimpleRosterModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        classes={classes}
        students={students}
        onSaveRoster={handleSaveFullRoster}
      />

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        currentTeacher={currentTeacher}
      />

      <MasterSyncModal
        isOpen={showMasterSyncModal}
        onClose={() => setShowMasterSyncModal(false)}
        classes={classes}
        students={students}
        sessions={sessions}
        teachers={teachers}
        currentTeacherId="teacher_ahmed_badawi"
        onExecuteSync={handleExecuteMasterSync}
      />

      {showResetConfirmModal && (
        <ConfirmModal
          isOpen={showResetConfirmModal}
          title="استعادة البيانات الافتراضية"
          message="هل أنت متأكد من رغبتك في إعادة ضبط النظام إلى بياناته الرسمية الافتراضية لمستر أحمد بدوي؟"
          confirmText="نعم، إعادة الضبط"
          cancelText="تراجع"
          isDestructive={false}
          onConfirm={handleResetData}
          onCancel={() => setShowResetConfirmModal(false)}
        />
      )}
    </div>
  );
}
