import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Settings,
  Calendar,
  MessageCircle,
  Globe,
  RefreshCw,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Send,
  Clock,
  Plus,
  Trash2,
  Save,
  Play,
  Upload,
  Download,
  FileText,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  Database,
  Layers,
  Users,
  School,
  Video,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Bell,
  Edit3,
  Cpu,
  Key,
  PhoneCall,
  Zap,
  HelpCircle,
  Server,
  ExternalLink,
} from 'lucide-react';
import { SchedulePeriod, SchoolClass, Student, ClassSession, TeacherProfile, DayOfWeek, LanguageTrack, WhatsAppSessionState, WhatsAppLog, WhatsAppProvider, WhatsAppGroupConfig } from '../types';
import {
  parseScheduleWithAI,
  saveTeacherSchedule,
  saveTeacherWhatsAppGroups,
  generateDailySessions,
  getWhatsAppStatus,
  getLocalWhatsAppSession,
  saveWhatsAppProviderConfig,
  saveWhatsAppTemplate,
  toggleAutoRemind,
  testWhatsAppLiveConnection,
  getWhatsAppLogs,
  clearWhatsAppLogs,
  sendWhatsAppReminder,
  sendWhatsAppNow,
  fetchServerSessions,
  syncStateToServer,
  getCustomBackendUrl,
  setCustomBackendUrl,
  detectVercelApiStatus,
  exportAllDataAsSyncPayload,
  importSyncPayload,
  VercelApiCheckResult
} from '../utils/apiSync';
import {
  getPublishedDomain,
  setPublishedDomain,
  getActiveSiteOrigin,
  ensureAbsoluteDomain,
  buildStudentAttendanceLink
} from '../utils/urlHelper';
import {
  DEFAULT_REMINDER_TEMPLATE,
  buildWhatsAppChatUrl,
  buildWhatsAppReminderMessage,
  getTimingLabel,
  formatTimeTo12Hour
} from '../utils/whatsappHelper';
import { storage, isAhmedBadawi } from '../utils/storage';

interface SettingsPageProps {
  currentTeacher: TeacherProfile;
  teachers: TeacherProfile[];
  classes: SchoolClass[];
  students: Student[];
  sessions: ClassSession[];
  onScheduleSaved: (updatedTeacher: TeacherProfile, newCount: number) => void;
  onDailySessionsGenerated: (count: number) => void;
  onLockDashboard: () => void;
  onExecuteSync: (
    options: { syncClasses: boolean; syncStudents: boolean; syncSessions: boolean; syncTeachers: boolean },
    adminPassword?: string
  ) => Promise<{
    success: boolean;
    structuralUpdateAccepted?: boolean;
    warning?: string;
    syncedCounts: { classes: number; students: number; sessions: number; teachers: number };
  }>;
  onTeachersUpdated: (teachers: TeacherProfile[]) => void;
  onSessionsUpdated: (sessions: ClassSession[]) => void;
  initialSubTab?: 'schedule' | 'whatsapp' | 'domain' | 'sync' | 'lock' | 'password';
}

const DAYS_ARABIC: { key: DayOfWeek; name: string }[] = [
  { key: 'sunday', name: 'الأحد' },
  { key: 'monday', name: 'الإثنين' },
  { key: 'tuesday', name: 'الثلاثاء' },
  { key: 'wednesday', name: 'الأربعاء' },
  { key: 'thursday', name: 'الخميس' },
  { key: 'friday', name: 'الجمعة' },
  { key: 'saturday', name: 'السبت' },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentTeacher,
  teachers,
  classes,
  students,
  sessions,
  onScheduleSaved,
  onDailySessionsGenerated,
  onLockDashboard,
  onExecuteSync,
  onTeachersUpdated,
  onSessionsUpdated,
  initialSubTab = 'schedule'
}) => {
  const isOwner = isAhmedBadawi(currentTeacher);
  const [activeTab, setActiveTab] = useState<'schedule' | 'whatsapp' | 'domain' | 'sync' | 'lock' | 'password'>(initialSubTab);

  // -----------------------------------------------------------------
  // 1. SMART SCHEDULE STATE
  // -----------------------------------------------------------------
  const [schedule, setSchedule] = useState<SchedulePeriod[]>(() => currentTeacher.weeklySchedule || []);
  const [scheduleSubTab, setScheduleSubTab] = useState<'upload' | 'table'>('table');
  const [selectedScheduleFile, setSelectedScheduleFile] = useState<File | null>(null);
  const [scheduleFilePreview, setScheduleFilePreview] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [isAnalyzingSchedule, setIsAnalyzingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string>('all');
  const [scheduleViewMode, setScheduleViewMode] = useState<'matrix' | 'list'>('matrix');

  useEffect(() => {
    setSchedule(currentTeacher.weeklySchedule || []);
  }, [currentTeacher.id]);

  const persistScheduleImmediately = (nextSchedule: SchedulePeriod[]) => {
    setSchedule(nextSchedule);
    const updatedTeacher: TeacherProfile = {
      ...currentTeacher,
      weeklySchedule: nextSchedule,
    };
    onScheduleSaved(updatedTeacher, 0);
    saveTeacherSchedule(currentTeacher.id, nextSchedule).catch(() => {});
  };

  const handleScheduleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedScheduleFile(file);
    setScheduleError(null);
    setScheduleSuccess(null);

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || file.type.includes('spreadsheet') || file.type.includes('excel')) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        setPasteText(csvText);
        setScheduleSuccess('📊 تم قراءة ملف Excel (.xlsx/.csv) بنجاح وتحويله إلى جدول نصي دقيق جاهز للتحليل الفوري بالذكاء الاصطناعي!');
      } catch (err: any) {
        setScheduleError('تعذر قراءة ملف Excel، يرجى التأكد من أن الملف غير مغلق أو محاولة لصق محتوى الجدول نصياً.');
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setScheduleFilePreview(event.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScheduleFilePreview(null);
    }
  };

  const handleDownloadExcelTemplate = () => {
    const templateData = [
      ["دليل إعداد جدول الحصص الذكي - بوابة تحضير الطلاب", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["اليوم (Day)", "وقت البدء (Start Time)", "وقت الانتهاء (End Time)", "اسم الفصل (Class Name)", "المادة / العنوان (Subject)", "المسار (Track: all/english/arabic)"],
      ["الأحد", "08:30", "09:15", "Grade 4 - A", "Science & Biology", "english"],
      ["الأحد", "09:20", "10:05", "Grade 4 - B", "علوم ولغات", "all"],
      ["الإثنين", "08:30", "09:15", "Grade 5 - A", "Math / رياضيات", "arabic"],
      ["الإثنين", "10:15", "11:00", "Grade 6 - A", "Science", "english"],
      ["الثلاثاء", "08:30", "09:15", "Grade 7 - A", "علوم ولغات", "all"],
      ["الأربعاء", "09:20", "10:05", "Grade 8 - A", "Math", "english"],
      ["الخميس", "10:15", "11:00", "Grade 4 - A", "Science & Biology", "english"]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    worksheet['!cols'] = [
      {wch: 15}, {wch: 22}, {wch: 22}, {wch: 25}, {wch: 25}, {wch: 20}
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الجدول الأسبوعي");
    XLSX.writeFile(workbook, "Weekly_Schedule_Template.xlsx");
  };

  const handleAnalyzeSchedule = async () => {
    if (!selectedScheduleFile && !pasteText.trim()) {
      setScheduleError('يرجى اختيار صورة، ملف PDF/TXT، أو كتابة نص الجدول لتحليله');
      return;
    }
    setIsAnalyzingSchedule(true);
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let textContent: string = pasteText.trim();

      if (selectedScheduleFile) {
        mimeType = selectedScheduleFile.type || 'application/octet-stream';
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedScheduleFile);
        });
      }

      const res = await parseScheduleWithAI({ imageBase64, mimeType, textContent: textContent || undefined });
      if (res.success && Array.isArray(res.periods) && res.periods.length > 0) {
        persistScheduleImmediately(res.periods);
        setScheduleSubTab('table');
        setScheduleSuccess(`نجح الذكاء الاصطناعي في استخراج وتثبيت ${res.periods.length} حصة مجدولة!`);
      } else {
        setScheduleError(res.error || 'لم يتم العثور على حصص واضحة في الملف. حاول إرفاق صورة أوضح أو لصق النص.');
      }
    } catch (err: any) {
      setScheduleError(err.message || 'حدث خطأ أثناء تحليل الجدول');
    } finally {
      setIsAnalyzingSchedule(false);
    }
  };

  const handleAddPeriodRow = () => {
    const newPeriod: SchedulePeriod = {
      id: `period_${Date.now()}`,
      dayOfWeek: 'sunday',
      dayNameArabic: 'الأحد',
      className: classes[0]?.name || 'Grade 4 - A',
      classId: classes[0]?.id,
      startTime: '09:00',
      endTime: '09:45',
      subject: currentTeacher.subject || 'علوم ولغات',
      targetTrack: 'all',
      zoomUrl: classes[0]?.zoomUrl || currentTeacher.defaultZoomLink || '',
    };
    const next = [...schedule, newPeriod];
    persistScheduleImmediately(next);
  };

  const handleUpdatePeriod = (id: string, updates: Partial<SchedulePeriod>) => {
    const next = schedule.map((p) => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      if (updates.dayOfWeek) {
        const match = DAYS_ARABIC.find((d) => d.key === updates.dayOfWeek);
        if (match) updated.dayNameArabic = match.name;
      }
      if (updates.classId !== undefined) {
        const cls = classes.find((c) => c.id === updates.classId);
        if (cls) {
          updated.className = cls.name;
          if (!updated.zoomUrl) updated.zoomUrl = cls.zoomUrl || '';
        }
      }
      return updated;
    });
    persistScheduleImmediately(next);
  };

  const handleDeletePeriod = (id: string) => {
    const next = schedule.filter((p) => p.id !== id);
    persistScheduleImmediately(next);
  };

  const handleSaveSchedule = async () => {
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      const res = await saveTeacherSchedule(currentTeacher.id, schedule);
      if (res.success) {
        const updatedTeacher: TeacherProfile = { ...currentTeacher, weeklySchedule: schedule };
        onScheduleSaved(updatedTeacher, res.newSessionsCount || 0);
        setScheduleSuccess(`تم تثبيت الجدول الأسبوعي بنجاح (${schedule.length} حصة). سيتم إنشاء الحصص يومياً تلقائياً!`);
      } else {
        setScheduleError(res.error || 'فشل حفظ الجدول في الخادم');
      }
    } catch {
      setScheduleError('تعذر الاتصال بالخادم');
    }
  };

  const handleTriggerDailyNow = async () => {
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      const res = await generateDailySessions();
      if (res.success) {
        onDailySessionsGenerated(res.count);
        setScheduleSuccess(
          res.count > 0
            ? `تم توليد ${res.count} حصة لهذا اليوم بنجاح وربطها بالتذكيرات التلقائية!`
            : 'تم فحص الجدول: جميع حصص اليوم الحالي موجودة مسبقاً.'
        );
      }
    } catch {
      setScheduleError('تعذر توليد الحصص');
    }
  };

  // -----------------------------------------------------------------
  // 2. WHATSAPP HUB STATE
  // -----------------------------------------------------------------
  const initialWaSession = getLocalWhatsAppSession();

  const [waSession, setWaSession] = useState<WhatsAppSessionState>(initialWaSession);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<WhatsAppProvider>(initialWaSession.provider || 'green_api');
  const [greenInstanceId, setGreenInstanceId] = useState(initialWaSession.greenApiInstanceId || '');
  const [greenToken, setGreenToken] = useState(initialWaSession.greenApiToken || '');
  const [ultraInstanceId, setUltraInstanceId] = useState(initialWaSession.ultraMsgInstanceId || '');
  const [ultraToken, setUltraToken] = useState(initialWaSession.ultraMsgToken || '');
  const [customWebhookUrl, setCustomWebhookUrl] = useState(initialWaSession.webhookUrl || '');
  const [metaPhoneId, setMetaPhoneId] = useState(initialWaSession.metaPhoneNumberId || '');
  const [metaToken, setMetaToken] = useState(initialWaSession.metaAccessToken || '');
  const [liveTestPhone, setLiveTestPhone] = useState(initialWaSession.phoneNumber || '');
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [liveTestSuccess, setLiveTestSuccess] = useState<string | null>(null);
  const [liveTestError, setLiveTestError] = useState<string | null>(null);
  const [waSaveSuccess, setWaSaveSuccess] = useState(false);
  const [selectedMinutesBefore, setSelectedMinutesBefore] = useState<number>(initialWaSession.reminderMinutesBefore ?? 5);
  const [isCustomMinutesMode, setIsCustomMinutesMode] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('15');
  const [templateText, setTemplateText] = useState<string>(
    () => currentTeacher.whatsappConfig?.customMessageTemplate || initialWaSession.customMessageTemplate || DEFAULT_REMINDER_TEMPLATE
  );
  const [isTestingTemplate, setIsTestingTemplate] = useState(false);
  const [templateTestFeedback, setTemplateTestFeedback] = useState<string | null>(null);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState(false);
  const [sendNowTarget, setSendNowTarget] = useState<string>('all');
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [sendNowFeedback, setSendNowFeedback] = useState<string | null>(null);

  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariableAtCursor = (variableTag: string) => {
    const textarea = templateTextareaRef.current;
    if (!textarea) {
      setTemplateText((prev) => `${prev} ${variableTag} `);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const updated = text.substring(0, start) + variableTag + text.substring(end);
    setTemplateText(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
    }, 0);
  };

  const getLivePreviewText = () => {
    const sampleClass = classes[0] || { id: 'c1', name: 'الصف الرابع - أ', gradeLevel: 'الرابع الابتدائي', zoomUrl: 'https://zoom.us' };
    const sampleSession: ClassSession = {
      id: 'sample_1',
      teacherId: currentTeacher.id,
      classId: sampleClass.id,
      className: sampleClass.name,
      sessionTitle: currentTeacher.subject ? `حصة ${currentTeacher.subject}` : 'حصة العلوم والرياضيات',
      zoomUrl: currentTeacher.defaultZoomLink || sampleClass.zoomUrl || 'https://zoom.us/j/123456789',
      targetTrack: 'all',
      createdAt: new Date().toISOString(),
      scheduledTime: '16:30',
      isActive: true,
      attendance: [],
    };
    return buildWhatsAppReminderMessage({
      session: sampleSession,
      schoolClass: sampleClass,
      teacher: currentTeacher,
      appUrl: getActiveSiteOrigin(),
      customTemplate: templateText,
      minutesBefore: selectedMinutesBefore,
    });
  };

  // -----------------------------------------------------------------
  // TEACHER-SPECIFIC WHATSAPP GROUPS PER CLASS
  // -----------------------------------------------------------------
  const [teacherClassGroups, setTeacherClassGroups] = useState<Record<string, WhatsAppGroupConfig[]>>(
    () => currentTeacher.classWhatsAppGroups || {}
  );
  const [teacherClassZoomLinks, setTeacherClassZoomLinks] = useState<Record<string, string>>(
    () => currentTeacher.classZoomLinks || {}
  );
  const [teacherGroupsSaveNotice, setTeacherGroupsSaveNotice] = useState<string | null>(null);
  const [isSavingTeacherGroups, setIsSavingTeacherGroups] = useState(false);

  useEffect(() => {
    setTeacherClassGroups(currentTeacher.classWhatsAppGroups || {});
    setTeacherClassZoomLinks(currentTeacher.classZoomLinks || {});
  }, [currentTeacher.id]);

  const handleAddTeacherGroupForClass = (classId: string) => {
    setTeacherClassGroups((prev) => {
      const existing = prev[classId] || [];
      const newGrp: WhatsAppGroupConfig = {
        id: `twagrp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipient: '',
        recipientType: 'group',
      };
      return { ...prev, [classId]: [...existing, newGrp] };
    });
  };

  const handleRemoveTeacherGroupForClass = (classId: string, groupId: string) => {
    setTeacherClassGroups((prev) => {
      const existing = prev[classId] || [];
      return { ...prev, [classId]: existing.filter((g) => g.id !== groupId) };
    });
  };

  const handleUpdateTeacherGroupForClass = (classId: string, groupId: string, field: keyof WhatsAppGroupConfig, value: any) => {
    setTeacherClassGroups((prev) => {
      const existing = prev[classId] || [];
      const updated = existing.map((g) => {
        if (g.id !== groupId) return g;
        const grp = { ...g, [field]: value };
        if (field === 'recipient') {
          if (value.includes('chat.whatsapp.com') || value.includes('@g.us')) {
            grp.recipientType = 'group';
          }
        }
        return grp;
      });
      return { ...prev, [classId]: updated };
    });
  };

  const handleSaveTeacherGroups = async () => {
    setIsSavingTeacherGroups(true);
    setTeacherGroupsSaveNotice(null);
    try {
      const updatedTeacher: TeacherProfile = {
        ...currentTeacher,
        classWhatsAppGroups: teacherClassGroups,
        classZoomLinks: teacherClassZoomLinks,
      };

      const res = await saveTeacherWhatsAppGroups(currentTeacher.id, teacherClassGroups, teacherClassZoomLinks);
      await syncStateToServer({
        teachers: teachers.map((t) => (t.id === currentTeacher.id ? updatedTeacher : t)),
        currentTeacherId: currentTeacher.id,
      });

      if (res.success) {
        if (res.teachers) onTeachersUpdated(res.teachers);
        else {
          onTeachersUpdated(teachers.map((t) => (t.id === currentTeacher.id ? updatedTeacher : t)));
        }
        setTeacherGroupsSaveNotice('✅ تم حفظ مجموعات الواتساب وروابط زوم الخاصة بفصولك بنجاح! سيتم ربط كل حصة بالرابط المحدد تلقائياً.');
      } else {
        setTeacherGroupsSaveNotice(`❌ فشل الحفظ: ${res.error}`);
      }
    } catch {
      setTeacherGroupsSaveNotice('❌ تعذر الاتصال بالخادم لحفظ المجموعات وروابط زوم.');
    } finally {
      setIsSavingTeacherGroups(false);
    }
  };

  const loadWaData = async () => {
    setWaLoading(true);
    try {
      const statusRes = await getWhatsAppStatus(currentTeacher.id);
      if (statusRes.session) {
        setWaSession(statusRes.session);
        if (statusRes.session.provider) setSelectedProvider(statusRes.session.provider);
        if (statusRes.session.greenApiInstanceId) setGreenInstanceId(statusRes.session.greenApiInstanceId);
        if (statusRes.session.greenApiToken) setGreenToken(statusRes.session.greenApiToken);
        if (statusRes.session.ultraMsgInstanceId) setUltraInstanceId(statusRes.session.ultraMsgInstanceId);
        if (statusRes.session.ultraMsgToken) setUltraToken(statusRes.session.ultraMsgToken);
        if (statusRes.session.webhookUrl) setCustomWebhookUrl(statusRes.session.webhookUrl);
        if (statusRes.session.metaPhoneNumberId) setMetaPhoneId(statusRes.session.metaPhoneNumberId);
        if (statusRes.session.metaAccessToken) setMetaToken(statusRes.session.metaAccessToken);
        if (statusRes.session.phoneNumber) setLiveTestPhone(statusRes.session.phoneNumber);

        const minutes = statusRes.session.reminderMinutesBefore ?? 5;
        setSelectedMinutesBefore(minutes);
        if (![0, 5, 10, 15, 30].includes(minutes)) {
          setIsCustomMinutesMode(true);
          setCustomMinutesInput(String(minutes));
        }
        if (statusRes.session.customMessageTemplate) {
          setTemplateText(statusRes.session.customMessageTemplate);
        }
      }
      const logsRes = await getWhatsAppLogs();
      setWaLogs(logsRes.logs || []);
    } catch (err) {
      console.warn('Error loading WA data:', err);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    loadWaData();
  }, [currentTeacher.id]);

  const getFullWhatsAppPayload = (): Partial<WhatsAppSessionState> & { teacherId: string } => {
    const minutesToSave = isCustomMinutesMode ? (parseInt(customMinutesInput, 10) || 5) : selectedMinutesBefore;
    return {
      teacherId: currentTeacher.id,
      provider: selectedProvider,
      greenApiInstanceId: greenInstanceId.trim(),
      greenApiToken: greenToken.trim(),
      ultraMsgInstanceId: ultraInstanceId.trim(),
      ultraMsgToken: ultraToken.trim(),
      webhookUrl: customWebhookUrl.trim(),
      metaPhoneNumberId: metaPhoneId.trim(),
      metaAccessToken: metaToken.trim(),
      phoneNumber: liveTestPhone.trim() || waSession.phoneNumber,
      autoRemindEnabled: waSession.autoRemindEnabled,
      reminderMinutesBefore: minutesToSave,
      customMessageTemplate: templateText,
    };
  };

  const handleSaveWaProviderSettings = async () => {
    setWaLoading(true);
    setWaSaveSuccess(false);
    try {
      const payload = getFullWhatsAppPayload();
      const res = await saveWhatsAppProviderConfig(payload);
      if (res.success && res.session) {
        setWaSession(res.session);
        setWaSaveSuccess(true);
        setTimeout(() => setWaSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    setWaLoading(true);
    setSettingsSavedNotice(false);
    try {
      const payload = getFullWhatsAppPayload();
      const res = await saveWhatsAppProviderConfig(payload);
      // Dedicated atomic save of custom message template
      await saveWhatsAppTemplate(templateText, currentTeacher.id);

      if (res.success && res.session) {
        setWaSession(res.session);
        const savedMins = res.session.reminderMinutesBefore ?? payload.reminderMinutesBefore ?? 5;
        setSelectedMinutesBefore(savedMins);

        // Update current teacher in memory and notify parent App
        const updatedTeacher: TeacherProfile = {
          ...currentTeacher,
          whatsappConfig: {
            ...(currentTeacher.whatsappConfig || {}),
            ...res.session,
            customMessageTemplate: templateText,
          },
        };
        const updatedTeachersList = teachers.map((t) => (t.id === currentTeacher.id ? updatedTeacher : t));
        onTeachersUpdated(updatedTeachersList);

        // Persist updated teachers to server
        await syncStateToServer({
          teachers: updatedTeachersList,
          currentTeacherId: currentTeacher.id,
        });

        setSettingsSavedNotice(true);
        setTimeout(() => setSettingsSavedNotice(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleTestSendTemplate = async () => {
    const targetPhone = liveTestPhone.trim() || currentTeacher.whatsappConfig?.phoneNumber || waSession.phoneNumber;
    if (!targetPhone) {
      setTemplateTestFeedback('❌ يرجى كتابة رقم الهاتف في قسم الربط السحابي بالأسفل لتلقي الرسالة التجريبية.');
      setTimeout(() => setTemplateTestFeedback(null), 5000);
      return;
    }
    setIsTestingTemplate(true);
    setTemplateTestFeedback(null);
    try {
      const sampleMessage = getLivePreviewText();
      const res = await testWhatsAppLiveConnection({
        provider: selectedProvider,
        testPhone: targetPhone,
        instanceId: selectedProvider === 'green_api' ? greenInstanceId.trim() : selectedProvider === 'ultramsg' ? ultraInstanceId.trim() : metaPhoneId.trim(),
        token: selectedProvider === 'green_api' ? greenToken.trim() : selectedProvider === 'ultramsg' ? ultraToken.trim() : metaToken.trim(),
        webhookUrl: customWebhookUrl.trim(),
        message: sampleMessage,
      });
      if (res.success) {
        setTemplateTestFeedback(`✅ تم إرسال نموذج القالب بنجاح إلى رقم (${targetPhone})! تحقق من رسائل الواتساب.`);
        if (res.session) setWaSession(res.session);
        const logsRes = await getWhatsAppLogs();
        setWaLogs(logsRes.logs || []);
      } else {
        setTemplateTestFeedback(`❌ فشل الإرسال التجريبي: ${res.error || 'يرجى التأكد من بيانات المزود ورقم الهاتف'}`);
      }
    } catch (err: any) {
      setTemplateTestFeedback(`❌ فشل الاتصال: ${err.message || 'تعذر الإرسال التجريبي'}`);
    } finally {
      setIsTestingTemplate(false);
      setTimeout(() => setTemplateTestFeedback(null), 7000);
    }
  };

  const handleRunLiveTest = async () => {
    if (!liveTestPhone.trim()) {
      setLiveTestError('يرجى كتابة رقم الهاتف مع كود الدولة للإرسال التجريبي (مثال: 966501234567)');
      return;
    }
    setIsTestingLive(true);
    setLiveTestSuccess(null);
    setLiveTestError(null);
    try {
      const res = await testWhatsAppLiveConnection({
        provider: selectedProvider,
        testPhone: liveTestPhone.trim(),
        instanceId: selectedProvider === 'green_api' ? greenInstanceId.trim() : selectedProvider === 'ultramsg' ? ultraInstanceId.trim() : metaPhoneId.trim(),
        token: selectedProvider === 'green_api' ? greenToken.trim() : selectedProvider === 'ultramsg' ? ultraToken.trim() : metaToken.trim(),
        webhookUrl: customWebhookUrl.trim(),
        message: `✅ *تجربة الربط السحابي الفعلي لواتساب - بوابة تحضير الطلاب*\n━━━━━━━━━━━━━━━━━\nتهانينا! تم ربط حسابك السحابي بنجاح.\nالنظام متصل وجاهز وسيقوم بإرسال التذكيرات التلقائية لكافة الحصص قبل موعدها بـ ${selectedMinutesBefore} دقائق.\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}`,
      });
      if (res.success) {
        setLiveTestSuccess(res.message || '✅ نجحت التجربة! وصلت الرسالة الحقيقية إلى هاتفك عبر السحابة.');
        if (res.session) setWaSession(res.session);
        const logsRes = await getWhatsAppLogs();
        setWaLogs(logsRes.logs || []);
      } else {
        setLiveTestError(res.error || 'تعذر إرسال الرسالة التجريبية، يرجى مراجعة معرف الحساب والتوكن.');
      }
    } catch (err: any) {
      setLiveTestError(err.message || 'فشل الاتصال بالخادم لإجراء التجربة');
    } finally {
      setIsTestingLive(false);
    }
  };

  const handleSendNow = async () => {
    setIsSendingNow(true);
    setSendNowFeedback(null);
    try {
      const sessionIdToPass = sendNowTarget === 'all' ? undefined : sendNowTarget;
      const res = await sendWhatsAppNow(sessionIdToPass, templateText, currentTeacher.id);
      if (res.success) {
        setSendNowFeedback(`✅ تم إرسال التذكيرات حالاً بنجاح باستخدام القالب المخصص (${res.dispatchedCount || 1} رسالة تم توجيهها)!`);
        const updatedLogs = await getWhatsAppLogs();
        setWaLogs(updatedLogs.logs || []);
        setTimeout(() => setSendNowFeedback(null), 5000);
      } else {
        setSendNowFeedback(`فشل الإرسال: ${res.error || 'حدث خطأ'}`);
      }
    } catch (err: any) {
      setSendNowFeedback(`فشل الاتصال: ${err.message || 'تعذر الإرسال حالاً'}`);
    } finally {
      setIsSendingNow(false);
    }
  };

  // -----------------------------------------------------------------
  // 3. PUBLISHED DOMAIN STATE
  // -----------------------------------------------------------------
  const [domainInput, setDomainInput] = useState(() => getPublishedDomain());
  const [domainSuccess, setDomainSuccess] = useState(false);
  const [copiedLinkClassId, setCopiedLinkClassId] = useState<string | null>(null);

  const handleSaveDomain = () => {
    const cleaned = ensureAbsoluteDomain(domainInput);
    setPublishedDomain(cleaned);
    setDomainInput(cleaned);
    setDomainSuccess(true);
    syncStateToServer({ publishedDomain: cleaned });
    setTimeout(() => setDomainSuccess(false), 3000);
  };

  const handleResetToCurrentOrigin = () => {
    const origin = getActiveSiteOrigin();
    setPublishedDomain(origin);
    setDomainInput(origin);
    setDomainSuccess(true);
    syncStateToServer({ publishedDomain: origin });
    setTimeout(() => setDomainSuccess(false), 3000);
  };

  // -----------------------------------------------------------------
  // 4. MASTER ADVANCED SYNC STATE
  // -----------------------------------------------------------------
  const [syncMode, setSyncMode] = useState<'full' | 'selective'>('full');
  const [syncClasses, setSyncClasses] = useState(true);
  const [syncStudents, setSyncStudents] = useState(true);
  const [syncSessions, setSyncSessions] = useState(true);
  const [syncTeachers, setSyncTeachers] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    warning?: string;
    counts?: { classes: number; students: number; sessions: number; teachers: number };
    timestamp?: string;
  } | null>(null);

  const englishStudentsCount = students.filter((s) => s.track === 'english').length;
  const arabicStudentsCount = students.filter((s) => s.track === 'arabic').length;

  const handleStartMasterSync = async () => {
    const opts = syncMode === 'full'
      ? { syncClasses: true, syncStudents: true, syncSessions: true, syncTeachers: true }
      : { syncClasses, syncStudents, syncSessions, syncTeachers };

    const touchesStructural = opts.syncClasses || opts.syncStudents || opts.syncTeachers;
    if (touchesStructural && !adminPassword.trim()) {
      setPasswordError('يرجى إدخال كلمة مرور المعلم المشرف (مستر أحمد بدوي) لتأكيد مزامنة بيانات الفصول والطلاب.');
      return;
    }

    setPasswordError(null);
    setIsSyncing(true);
    setSyncProgress(20);
    setSyncResult(null);
    setSyncLogs(['[1/4] جاري التحقق من التوقيع الأمني والاتصال بالسيرفر السحابي...']);

    try {
      setTimeout(() => {
        setSyncProgress(50);
        setSyncLogs((prev) => [...prev, `[2/4] جاري تجهيز حزمة المزامنة (${students.length} طالب، ${classes.length} فصل)...`]);
      }, 400);

      const res = await onExecuteSync(opts, adminPassword.trim());

      setSyncProgress(100);
      setIsSyncing(false);

      if (res.success) {
        if (touchesStructural && res.structuralUpdateAccepted === false) {
          setSyncLogs((prev) => [...prev, '⚠️ كلمة المرور المدخلة غير صحيحة! رفض السيرفر تعديل بيانات الفصول والطلاب.']);
          setSyncResult({ success: false, warning: 'كلمة المرور غير صحيحة.' });
        } else {
          setSyncLogs((prev) => [...prev, '[4/4] اكتملت المزامنة بنجاح 100%! تم اعتماد وتثبيت بيانات السحابة.']);
          setSyncResult({
            success: true,
            counts: res.syncedCounts,
            timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        }
      } else {
        setSyncResult({ success: false });
      }
    } catch {
      setIsSyncing(false);
      setSyncProgress(0);
      setSyncResult({ success: false });
    }
  };

  // -----------------------------------------------------------------
  // 4b. VERCEL & GITHUB CLOUD SYNC STATE & HANDLERS
  // -----------------------------------------------------------------
  const [customBackendUrl, setCustomBackendUrlState] = useState(() => getCustomBackendUrl());
  const [vercelCheckResult, setVercelCheckResult] = useState<VercelApiCheckResult | null>(null);
  const [isCheckingVercel, setIsCheckingVercel] = useState(false);
  const [backendSaveMsg, setBackendSaveMsg] = useState<string | null>(null);
  const [syncCodeString, setSyncCodeString] = useState<string>('');
  const [showSyncCodeModal, setShowSyncCodeModal] = useState(false);
  const [syncCodeCopied, setSyncCodeCopied] = useState(false);
  const [importCodeText, setImportCodeText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string; counts?: any } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleCheckVercelStatus = async () => {
    setIsCheckingVercel(true);
    try {
      const res = await detectVercelApiStatus();
      setVercelCheckResult(res);
    } catch (err: any) {
      setVercelCheckResult({
        ok: false,
        status: 'unreachable',
        message: err.message || 'فشل الاتصال',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        activeApiUrl: '',
      });
    } finally {
      setIsCheckingVercel(false);
    }
  };

  const handleSaveCustomBackendUrl = () => {
    setCustomBackendUrl(customBackendUrl);
    setBackendSaveMsg('تم حفظ رابط السيرفر بنجاح!');
    setTimeout(() => setBackendSaveMsg(null), 3000);
    handleCheckVercelStatus();
  };

  const handleGenerateSyncCode = () => {
    const code = exportAllDataAsSyncPayload();
    setSyncCodeString(code);
    setSyncCodeCopied(false);
    setShowSyncCodeModal(true);
  };

  const handleApplyImportSyncCode = async () => {
    if (!importCodeText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      const res = await importSyncPayload(importCodeText.trim());
      setImportStatus(res);
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: err.message || 'فشل تطبيق المزامنة' });
    } finally {
      setIsImporting(false);
    }
  };

  // -----------------------------------------------------------------
  // 5. CHANGE PASSWORD STATE
  // -----------------------------------------------------------------
  const [currentPin, setCurrentPin] = useState(() => storage.getTeacherPin());
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [isSubmittingPw, setIsSubmittingPw] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (!isOwner) {
      setPwError('عذراً، تعديل كلمة المرور متاح حصرياً من لوحة تحكم مستر أحمد بدوي فقط.');
      return;
    }

    const trimmed = newPin.trim();
    if (!trimmed) {
      setPwError('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }
    if (trimmed.length < 4) {
      setPwError('كلمة المرور يجب أن تكون 4 أرقام أو خانات على الأقل.');
      return;
    }
    if (confirmPin.trim() && confirmPin.trim() !== trimmed) {
      setPwError('تأكيد كلمة المرور غير متطابق.');
      return;
    }

    setIsSubmittingPw(true);
    try {
      storage.saveTeacherPin(trimmed);
      setCurrentPin(trimmed);
      try {
        await fetch('/api/teacher-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: trimmed, teacherId: currentTeacher.id }),
        });
      } catch (e) {
        console.warn('PIN server sync failed, saved locally', e);
      }
      setPwSaved(true);
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPwSaved(false), 4000);
    } catch {
      setPwError('حدث خطأ أثناء حفظ كلمة المرور.');
    } finally {
      setIsSubmittingPw(false);
    }
  };

  const currentTimingLabel = selectedMinutesBefore === 0
    ? 'حالاً (مع البداية)'
    : `قبل ${selectedMinutesBefore} دقائق`;

  const displayedPeriods = filterDay === 'all'
    ? schedule
    : schedule.filter((p) => p.dayOfWeek === filterDay);

  return (
    <div className="space-y-4 sm:space-y-6 dir-rtl font-sans animate-in fade-in pb-12">
      {/* Settings Header Badge */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <Settings className="w-7 h-7 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                ⚙️ إعدادات المنصة ولوحة التحكّم الشاملة
              </h1>
              <span className="text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                إدارة موحدة 100%
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              الجدول الذكي، ربط واتساب، نطاق نشر الطلاب، المزامنة السحابية، القفل وتعديل كلمة المرور
            </p>
          </div>
        </div>

        {/* Quick Lock Action Button in Top Badge */}
        <button
          type="button"
          onClick={onLockDashboard}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Lock className="w-4 h-4" />
          <span>قفل لوحة التحكم الآن 🔒</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 الجدول الذكي</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold bg-white/20 text-current">
            {schedule.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>💬 ربط واتساب وتذكيرات الـ 5 دقائق</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('domain')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'domain'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>🌐 نطاق نشر المنصة والباركود</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'sync'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>🔄 لوحة المزامنة المتقدمة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lock')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'lock'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>🔒 قفل المنصة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'password'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>🔑 تعديل كلمة المرور</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: SMART SCHEDULE & AI TIMETABLE                          */}
      {/* ================================================================= */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">📅 الجدول الأسبوعي واستخراج المواعيد الذكي</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Gemini AI</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تثبيت مواعيد حصصك الأسبوعية لتوليدها يومياً بصفة تلقائية دون إدخال يدوي مكرر
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleSubTab(scheduleSubTab === 'table' ? 'upload' : 'table')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {scheduleSubTab === 'table' ? (
                  <>
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>رفع صورة/ملف جدول بالذكاء الاصطناعي</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>مراجعة وتعديل الجدول اليدوي ({schedule.length} حصة)</span>
                  </>
                )}
              </button>

              {schedule.length > 0 && (
                <button
                  type="button"
                  onClick={handleTriggerDailyNow}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="توليد حصص اليوم تلقائياً فوراً استناداً لليوم الحالي"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>توليد حصص اليوم الآن</span>
                </button>
              )}
            </div>
          </div>

          {scheduleError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{scheduleError}</span>
            </div>
          )}

          {scheduleSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{scheduleSuccess}</span>
            </div>
          )}

          {scheduleSubTab === 'upload' ? (
            <div className="space-y-4 p-4 bg-slate-50/70 border border-slate-200 rounded-2xl">
              {/* Detailed Excel & Timetable Upload Guide */}
              <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-950 font-black text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>📊 دليل إكسيل الشامل والمحدد لضمان دقة مواعيد الحصص 100%:</span>
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                  لضمان استخراج الحصص والمواعيد بذكاء ودقة تامة عند رفع ملف إكسيل (<code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">.xlsx</code> / <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">.csv</code>)، تأكد أن يحتوي الملف على الأعمدة التالية أو كتابتها بالترتيب:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-indigo-950">
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">1. اليوم (الأحد / Monday...)</div>
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">2. وقت البدء (08:30 أو 16:30)</div>
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">3. الفصل (Grade 4 - A)</div>
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">4. المادة / العنوان (Science)</div>
                </div>
                <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-indigo-200/60 mt-2">
                  <span className="text-[10px] text-indigo-700 font-bold">
                    ⚡ حمل النموذج، عدل الحصص وافتح الملف مجدداً لرفعه للذكاء الاصطناعي بدقة 100%.
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📥 تنزيل نموذج إكسيل جاهز للاستخدام (Excel Template)</span>
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-6 text-center transition-all bg-white">
                <input
                  type="file"
                  id="schedule-settings-file"
                  accept="image/*,.xlsx,.xls,.csv,.pdf,.txt"
                  onChange={handleScheduleFileChange}
                  className="hidden"
                />
                <label htmlFor="schedule-settings-file" className="flex flex-col items-center cursor-pointer space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-800">
                    اضغط لاختيار ملف Excel (.xlsx/.csv)، صورة الجدول، أو ملف PDF / TXT
                  </h4>
                  <p className="text-[11px] text-slate-500">يدعم جداول إكسيل Excel، صور الجدول، مستندات Word، وPDF</p>
                  {selectedScheduleFile && (
                    <div className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{selectedScheduleFile.name}</span>
                    </div>
                  )}
                </label>
                {scheduleFilePreview && (
                  <div className="mt-3 max-h-40 overflow-hidden rounded-xl border border-slate-200 inline-block">
                    <img src={scheduleFilePreview} alt="Schedule preview" className="max-h-40 object-contain" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">أو الصق نص الجدول هنا مباشرة:</label>
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="مثال: الأحد: الحصة الأولى 8:30 رابع لغات، الحصة الثالثة 10:00 سابع عام..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAnalyzeSchedule}
                  disabled={isAnalyzingSchedule}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnalyzingSchedule ? 'جارٍ تحليل الجدول بالذكاء الاصطناعي...' : 'تحليل واستخراج الحصص بالذكاء الاصطناعي'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* View Mode Toggle Switcher */}
              <div className="flex items-center justify-between p-2 bg-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('matrix')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                      scheduleViewMode === 'matrix'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span>📊 الجدول الشبكي (Matrix Grid)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('list')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                      scheduleViewMode === 'list'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span>📋 جدول التعديل الشامل (List)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddPeriodRow}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة حصة يدوياً</span>
                </button>
              </div>

                            {scheduleViewMode === 'matrix' ? (
                /* Editable Matrix Grid View without Break */
                <div className="space-y-4">
                  <div className="p-4 bg-[#0b1d3a] text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div>
                      <h3 className="text-sm font-black flex items-center gap-2 tracking-wide font-mono">
                        <span>TEACHER {currentTeacher.name.toUpperCase()} TIMETABLE (EDITABLE MATRIX)</span>
                        <span className="text-[10px] bg-emerald-600 px-2.5 py-0.5 rounded-md font-sans">Editable Grid</span>
                      </h3>
                      <p className="text-[11px] text-slate-300 mt-0.5 font-sans">
                        قم بتعديل أو إضافة الفصول، المواد، والمسارات (عربي / لغات / عام) مباشرة لكل حصة في الجدول الشبكي أدناه بدون فترات راحة.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-2xl border border-slate-300 shadow-sm">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#0b1d3a] text-white text-[11px] font-black">
                          <th className="p-3 border border-slate-700 min-w-[100px]">DAY</th>
                          {[
                            { key: 'p1', label: 'PERIOD 1', time: '8:00 - 8:35 AM', defaultTime: '08:00' },
                            { key: 'p2', label: 'PERIOD 2', time: '8:40 - 9:15 AM', defaultTime: '08:40' },
                            { key: 'p3', label: 'PERIOD 3', time: '9:20 - 9:55 AM', defaultTime: '09:20' },
                            { key: 'p4', label: 'PERIOD 4', time: '10:00 - 10:35 AM', defaultTime: '10:00' },
                            { key: 'p5', label: 'PERIOD 5', time: '10:45 - 11:20 AM', defaultTime: '10:45' },
                            { key: 'p6', label: 'PERIOD 6', time: '11:25 - 12:00 PM', defaultTime: '11:25' },
                            { key: 'p7', label: 'PERIOD 7', time: '12:05 - 12:30 PM', defaultTime: '12:05' },
                          ].map((slot) => (
                            <th key={slot.key} className="p-2.5 border border-slate-700 min-w-[150px]">
                              <div className="font-extrabold">{slot.label}</div>
                              <div className="text-[9px] font-mono text-emerald-300 mt-0.5">{slot.time}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                        {[
                          { key: 'sunday', name: 'الأحد' },
                          { key: 'monday', name: 'الإثنين' },
                          { key: 'tuesday', name: 'الثلاثاء' },
                          { key: 'wednesday', name: 'الأربعاء' },
                          { key: 'thursday', name: 'الخميس' },
                        ].map((day) => (
                          <tr key={day.key} className="hover:bg-slate-50/50">
                            <td className="p-3 bg-slate-100 border border-slate-300 font-black text-slate-900 text-sm whitespace-nowrap">
                              {day.name}
                            </td>
                            {[
                              { key: 'p1', match: (t: string) => t >= '08:00' && t < '08:40', defaultTime: '08:00' },
                              { key: 'p2', match: (t: string) => t >= '08:40' && t < '09:20', defaultTime: '08:40' },
                              { key: 'p3', match: (t: string) => t >= '09:20' && t < '10:00', defaultTime: '09:20' },
                              { key: 'p4', match: (t: string) => t >= '10:00' && t < '10:45', defaultTime: '10:00' },
                              { key: 'p5', match: (t: string) => t >= '10:45' && t < '11:25', defaultTime: '10:45' },
                              { key: 'p6', match: (t: string) => t >= '11:25' && t < '12:05', defaultTime: '11:25' },
                              { key: 'p7', match: (t: string) => t >= '12:05', defaultTime: '12:05' },
                            ].map((slot) => {
                              const matchedPeriod = schedule.find(
                                (p) => (p.dayOfWeek || '').toLowerCase() === day.key.toLowerCase() && slot.match && slot.match(p.startTime || '')
                              );

                              const resolvedClassId = (() => {
                                if (!matchedPeriod) return '';
                                if (matchedPeriod.classId && classes.some((c) => c.id === matchedPeriod.classId)) {
                                  return matchedPeriod.classId;
                                }
                                if (matchedPeriod.className) {
                                  const byName = classes.find(
                                    (c) =>
                                      c.name.toLowerCase() === matchedPeriod.className.toLowerCase() ||
                                      matchedPeriod.className.toLowerCase().includes(c.name.toLowerCase())
                                  );
                                  if (byName) return byName.id;
                                }
                                return matchedPeriod.classId || '';
                              })();

                              return (
                                <td key={slot.key} className="p-2 border border-slate-300 align-middle bg-white hover:bg-indigo-50/20 transition-colors">
                                  <div className="space-y-1.5 text-right">
                                    <select
                                      value={resolvedClassId}
                                      onChange={(e) => {
                                        const clsId = e.target.value;
                                        const clsObj = classes.find(c => c.id === clsId);
                                        const existing = schedule.find(p => (p.dayOfWeek || '').toLowerCase() === day.key.toLowerCase() && slot.match && slot.match(p.startTime || ''));
                                        if (!clsId) {
                                          if (existing) {
                                            handleDeletePeriod(existing.id);
                                          }
                                          return;
                                        }
                                        if (existing) {
                                          handleUpdatePeriod(existing.id, {
                                            classId: clsId,
                                            className: clsObj ? clsObj.name : 'الفصل'
                                          });
                                        } else {
                                          const newPeriod: SchedulePeriod = {
                                            id: 'period_' + Date.now() + Math.random().toString(36).substring(2, 6),
                                            dayOfWeek: day.key as DayOfWeek,
                                            dayNameArabic: day.name,
                                            startTime: slot.defaultTime,
                                            classId: clsId,
                                            className: clsObj ? clsObj.name : 'الفصل',
                                            subject: currentTeacher.subject || 'Math',
                                            targetTrack: 'all',
                                            zoomUrl: clsObj?.zoomUrl || ''
                                          };
                                          persistScheduleImmediately([...schedule, newPeriod]);
                                        }
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-900 shadow-2xs cursor-pointer"
                                    >
                                      <option value="">-- بدون حصة (فارغ) --</option>
                                      {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>

                                    <div className="grid grid-cols-2 gap-1">
                                      <select
                                        value={matchedPeriod?.targetTrack || 'all'}
                                        onChange={(e) => {
                                          const track = e.target.value as LanguageTrack;
                                          const existing = schedule.find(p => (p.dayOfWeek || '').toLowerCase() === day.key.toLowerCase() && slot.match && slot.match(p.startTime || ''));
                                          if (existing) {
                                            handleUpdatePeriod(existing.id, { targetTrack: track });
                                          } else {
                                            const clsObj = classes[0];
                                            const newPeriod: SchedulePeriod = {
                                              id: 'period_' + Date.now() + Math.random().toString(36).substring(2, 6),
                                              dayOfWeek: day.key as DayOfWeek,
                                              dayNameArabic: day.name,
                                              startTime: slot.defaultTime,
                                              classId: clsObj ? clsObj.id : '',
                                              className: clsObj ? clsObj.name : 'الفصل الأول',
                                              subject: currentTeacher.subject || 'Math',
                                              targetTrack: track,
                                              zoomUrl: clsObj?.zoomUrl || ''
                                            };
                                            persistScheduleImmediately([...schedule, newPeriod]);
                                          }
                                        }}
                                        className="w-full px-1 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 shadow-2xs cursor-pointer"
                                      >
                                        <option value="all">🌐 عام</option>
                                        <option value="arabic">🌙 عربي</option>
                                        <option value="english">⭐ لغات</option>
                                      </select>

                                      <input
                                        type="text"
                                        value={matchedPeriod?.subject || ''}
                                        onChange={(e) => {
                                          const subj = e.target.value;
                                          const existing = schedule.find(p => (p.dayOfWeek || '').toLowerCase() === day.key.toLowerCase() && slot.match && slot.match(p.startTime || ''));
                                          if (existing) {
                                            handleUpdatePeriod(existing.id, { subject: subj });
                                          } else {
                                            const clsObj = classes[0];
                                            const newPeriod: SchedulePeriod = {
                                              id: 'period_' + Date.now() + Math.random().toString(36).substring(2, 6),
                                              dayOfWeek: day.key as DayOfWeek,
                                              dayNameArabic: day.name,
                                              startTime: slot.defaultTime,
                                              classId: clsObj ? clsObj.id : '',
                                              className: clsObj ? clsObj.name : 'الفصل الأول',
                                              subject: subj,
                                              targetTrack: 'all',
                                              zoomUrl: clsObj?.zoomUrl || ''
                                            };
                                            persistScheduleImmediately([...schedule, newPeriod]);
                                          }
                                        }}
                                        placeholder="المادة"
                                        className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-800 shadow-2xs"
                                      />
                                    </div>

                                    {matchedPeriod && (
                                      <div className="flex justify-end pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePeriod(matchedPeriod.id)}
                                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5 cursor-pointer px-1 py-0.5 hover:bg-rose-50 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>حذف</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* List / Unified Master Table View */
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <span>📋 جدول موحد شامل لجميع أيام ومواعيد الحصص الأسبوعية</span>
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        يمكنك تعديل اليوم، وقت البدء، الفصل، المادة، والمسار (عربي / لغات / عام) مباشرة من الجدول الموحد أدناه.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPeriodRow}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة حصة جديدة</span>
                    </button>
                  </div>

                  {schedule.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                      لا توجد حصص مجدولة بعد. اضغط "إضافة حصة جديدة" أو ارفع ملف الإكسيل.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-700">
                            <th className="p-3">اليوم</th>
                            <th className="p-3">وقت البدء</th>
                            <th className="p-3">الفصل الدراسي والمسار (4B + عربي/لغات)</th>
                            <th className="p-3">المادة / العنوان</th>
                            <th className="p-3 text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                          {schedule
                            .slice()
                            .sort((a, b) => {
                              const dayOrder: Record<string, number> = { sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6, saturday: 7 };
                              const dayDiff = (dayOrder[a.dayOfWeek] || 0) - (dayOrder[b.dayOfWeek] || 0);
                              if (dayDiff !== 0) return dayDiff;
                              return (a.startTime || '').localeCompare(b.startTime || '');
                            })
                            .map((period) => (
                              <tr key={period.id} className="hover:bg-slate-50/60 transition-colors">
                                {/* Day Selector */}
                                <td className="p-3 align-top">
                                  <select
                                    value={period.dayOfWeek}
                                    onChange={(e) => handleUpdatePeriod(period.id, { dayOfWeek: e.target.value as DayOfWeek })}
                                    className="w-28 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-slate-900 text-xs shadow-2xs"
                                  >
                                    {DAYS_ARABIC.map((d) => (
                                      <option key={d.key} value={d.key}>{d.name}</option>
                                    ))}
                                  </select>
                                </td>

                                {/* Start Time */}
                                <td className="p-3 align-top">
                                  <input
                                    type="time"
                                    value={period.startTime}
                                    onChange={(e) => handleUpdatePeriod(period.id, { startTime: e.target.value })}
                                    className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-black text-indigo-600 text-center text-xs shadow-2xs"
                                  />
                                </td>

                                {/* Class Name + Track Dropdown Directly Underneath */}
                                <td className="p-3 align-top space-y-1.5 min-w-[210px]">
                                  <select
                                    value={period.classId || ''}
                                    onChange={(e) => handleUpdatePeriod(period.id, { classId: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-slate-900 text-xs shadow-2xs"
                                  >
                                    <option value="">{period.className || '-- اختر الفصل --'}</option>
                                    {classes.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name} ({c.gradeLevel})</option>
                                    ))}
                                  </select>

                                  <select
                                    value={period.targetTrack || 'all'}
                                    onChange={(e) => handleUpdatePeriod(period.id, { targetTrack: e.target.value as LanguageTrack })}
                                    className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md font-bold text-[11px] text-slate-700 shadow-2xs"
                                  >
                                    <option value="all">🌐 عام (للجميع)</option>
                                    <option value="arabic">🌙 عربي</option>
                                    <option value="english">⭐ لغات (English)</option>
                                  </select>
                                </td>

                                {/* Subject */}
                                <td className="p-3 align-top">
                                  <input
                                    type="text"
                                    value={period.subject || ''}
                                    onChange={(e) => handleUpdatePeriod(period.id, { subject: e.target.value })}
                                    placeholder="مثال: Science أو Math"
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs shadow-2xs"
                                  />
                                </td>

                                {/* Actions */}
                                <td className="p-3 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="حذف الحصة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}


              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">
                  إجمالي الحصص المحددة بالجدول: {schedule.length} حصة أسبوعياً
                </span>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>تثبيت واعتماد الجدول الأسبوعي</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 2: WHATSAPP HUB & REMINDER TIMING                         */}
      {/* ================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">💬 ربط واتساب السحابي وتخصيص التذكيرات</h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  توقيت الإرسال الحالي: {currentTimingLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تعديل نص الرسالة، واختيار توقيت الإرسال (قبل 5د، 10د، أو حالاً)، والربط السحابي لرسائل التذكير
              </p>
            </div>
          </div>

          {/* TIMING SELECTION CARD */}
          <div className="p-4 bg-linear-to-r from-emerald-50/70 to-indigo-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>اختر موعد إرسال التذكيرات للطلاب والمجموعات:</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextEnabled = !waSession.autoRemindEnabled;
                    setWaSession(prev => ({ ...prev, autoRemindEnabled: nextEnabled }));
                    saveWhatsAppProviderConfig({ ...getFullWhatsAppPayload(), autoRemindEnabled: nextEnabled });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    waSession.autoRemindEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {waSession.autoRemindEnabled ? '✅ الإرسال الآلي مفعل' : '❌ الإرسال الآلي متوقف'}
                </button>
                <span className="text-[10px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                  المحدد: {currentTimingLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedMinutesBefore(0); setIsCustomMinutesMode(false); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isCustomMinutesMode && selectedMinutesBefore === 0
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⚡ حالاً</div>
                <div className="text-[9px] opacity-80 mt-0.5">مع بداية الحصة</div>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedMinutesBefore(5); setIsCustomMinutesMode(false); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isCustomMinutesMode && selectedMinutesBefore === 5
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⏱️ قبل 5 دقائق</div>
                <div className="text-[9px] opacity-80 mt-0.5">الموصى به ⭐</div>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedMinutesBefore(10); setIsCustomMinutesMode(false); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isCustomMinutesMode && selectedMinutesBefore === 10
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⏱️ قبل 10 دقائق</div>
                <div className="text-[9px] opacity-80 mt-0.5">تحضير مبكر</div>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedMinutesBefore(15); setIsCustomMinutesMode(false); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isCustomMinutesMode && selectedMinutesBefore === 15
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⏱️ قبل 15 دقيقة</div>
                <div className="text-[9px] opacity-80 mt-0.5">ربع ساعة</div>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedMinutesBefore(30); setIsCustomMinutesMode(false); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isCustomMinutesMode && selectedMinutesBefore === 30
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⏱️ قبل 30 دقيقة</div>
                <div className="text-[9px] opacity-80 mt-0.5">نصف ساعة</div>
              </button>

              <button
                type="button"
                onClick={() => { setIsCustomMinutesMode(true); }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isCustomMinutesMode
                    ? 'border-emerald-600 bg-emerald-600 text-white font-black shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                }`}
              >
                <div className="text-xs">⚙️ وقت مخصص</div>
                <div className="text-[9px] opacity-80 mt-0.5">تحديد يدوي</div>
              </button>
            </div>

            {isCustomMinutesMode && (
              <div className="pt-2 p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  اكتب عدد الدقائق قبل موعد الحصة:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={customMinutesInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomMinutesInput(val);
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed) && parsed >= 0) setSelectedMinutesBefore(parsed);
                    }}
                    className="w-20 px-3 py-1.5 text-xs font-black font-mono border border-slate-300 rounded-lg bg-white text-center"
                  />
                  <span className="text-xs text-slate-600 font-bold">دقيقة</span>
                </div>
              </div>
            )}
          </div>

          {/* ENHANCED TEMPLATE EDITOR & LIVE PREVIEW CARD */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                  <span>تعديل وتحرير قالب رسالة التذكير تلقائياً:</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  يمكنك تخصيص كل كلمة، وإدراج المتغيرات الديناميكية كالوقت ({'وقت_التذكير'}) والموعد 12h ({'الموعد'})
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">نماذج جاهزة:</span>
                <button
                  type="button"
                  onClick={() => setTemplateText(DEFAULT_REMINDER_TEMPLATE)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  📋 الرسمي
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateText(`🔔 *تذكير بموعد الحصة ({وقت_التذكير})*
📚 فصل *{الفصل}* | 📖 *{المادة}*
👤 المعلم: *{المعلم}*
⏰ الموعد: *{الموعد}*
🎯 الفئة: *{الفئة}*

🔗 رابط زوم: {رابط_زوم}
📝 رابط التحضير الفوري: {رابط_الحضور}`)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ⚡ مختصر
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateText(`🌟 *أهلاً أبطال {الفصل}! استعدوا للحصة المباشرة ({وقت_التذكير})*
━━━━━━━━━━━━━━━━━
📖 *درس اليوم:* {المادة}
👤 *المعلم المشرف:* {المعلم}
⏰ *موعد الحصة:* {الموعد}

👉 *اضغط فوراً على رابط التحضير للدخول وتسجيل اسمك:*
{رابط_الحضور}
━━━━━━━━━━━━━━━━━
_نتمنى لكم حصة ممتعة ومفيدة! 🚀_`)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  🌟 تحفيزي
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Code Editor + Variable Insertion Badges */}
              <div className="lg:col-span-7 space-y-3">
                <textarea
                  ref={templateTextareaRef}
                  rows={8}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  placeholder="اكتب قالب رسالة التذكير هنا واضغط على أي متغيّر بالأسفل لإدراجه..."
                  className="w-full p-3.5 text-xs font-mono border border-slate-300 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed text-slate-900 shadow-2xs"
                />

                {/* Variable insertion chips */}
                <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">
                      ✨ اضغط لإدراج متغيّر في موضع المؤشر:
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">10 متغيرات متاحة</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { tag: '{وقت_التذكير}', label: 'وقت التذكير (قبل 5 دقائق/الآن)', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                      { tag: '{الموعد}', label: 'الموعد (04:30 م)', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
                      { tag: '{الفصل}', label: 'اسم الفصل', color: 'bg-blue-100 text-blue-900 border-blue-300' },
                      { tag: '{المادة}', label: 'المادة / العنوان', color: 'bg-purple-100 text-purple-900 border-purple-300' },
                      { tag: '{المعلم}', label: 'اسم المعلم', color: 'bg-amber-100 text-amber-900 border-amber-300' },
                      { tag: '{رابط_الحضور}', label: 'رابط تسجيل الحضور', color: 'bg-teal-100 text-teal-900 border-teal-300' },
                      { tag: '{رابط_زوم}', label: 'رابط زوم المباشر', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
                      { tag: '{الفئة}', label: 'المسار (لغات/عربي)', color: 'bg-rose-100 text-rose-900 border-rose-300' },
                      { tag: '{تاريخ_اليوم}', label: 'تاريخ اليوم بالعربي', color: 'bg-orange-100 text-orange-900 border-orange-300' },
                      { tag: '{المدرسة}', label: 'اسم المدرسة', color: 'bg-slate-200 text-slate-900 border-slate-300' },
                    ].map((chip) => (
                      <button
                        key={chip.tag}
                        type="button"
                        onClick={() => insertVariableAtCursor(chip.tag)}
                        className={`px-2.5 py-1 text-[11px] font-mono font-black border rounded-lg transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xs ${chip.color}`}
                        title={chip.label}
                      >
                        + {chip.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Real-Time Live WhatsApp Message Preview */}
              <div className="lg:col-span-5 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>معاينة حية لشكل الرسالة على واتساب:</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    مباشر (Real-time)
                  </span>
                </div>

                {/* Simulated WhatsApp Phone Screen */}
                <div className="flex-1 bg-[#efeae2] border border-slate-300 rounded-2xl p-3 shadow-inner flex flex-col justify-between space-y-2 min-h-[220px]">
                  {/* Message Bubble */}
                  <div className="bg-white rounded-xl rounded-tr-none p-3 shadow-xs border border-emerald-100 text-xs text-slate-800 dir-rtl whitespace-pre-wrap font-sans leading-relaxed select-text">
                    {getLivePreviewText()}
                    <div className="text-[10px] text-slate-400 text-left mt-1 font-mono flex items-center justify-end gap-1">
                      <span>16:25</span>
                      <span className="text-emerald-500 font-bold">✓✓</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center font-bold bg-white/60 backdrop-blur-xs py-1 px-2 rounded-lg">
                    💡 هكذا ستظهر الرسالة تماماً للطلاب وأولياء الأمور
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                تذكر أن تضغط "حفظ القالب وتوقيت الإرسال" لتأكيد وتعميم القالب على جميع التذكيرات التلقائية لكافة الحصص.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestSendTemplate}
                  disabled={isTestingTemplate || waLoading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  title="إرسال نموذج حقيقي من هذا القالب مباشرة على هاتفك للتأكد من وصوله بالشكل المطلوب"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isTestingTemplate ? 'جارٍ إرسال التجربة...' : '📱 تجربة القالب على هاتفي'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveReminderSettings}
                  disabled={waLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ القالب وتوقيت الإرسال الآن</span>
                </button>
              </div>
            </div>

            {templateTestFeedback && (
              <div className={`p-3 text-xs font-bold rounded-xl border flex items-center gap-1.5 animate-in fade-in ${
                templateTestFeedback.startsWith('✅') ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}>
                {templateTestFeedback.startsWith('✅') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{templateTestFeedback}</span>
              </div>
            )}

            {settingsSavedNotice && (
              <div className="p-3 bg-emerald-50 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ إعدادات توقيت وقالب الرسالة بنجاح وتثبيتها وتعميمها على جميع الحصص والتذكيرات التلقائية!</span>
              </div>
            )}
          </div>

          {/* TEACHER SPECIFIC CLASS WHATSAPP GROUPS CARD */}
          <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200/80">
              <div>
                <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>ربط مجموعات الواتساب الخاصة بفصولي ({currentTeacher.name})</span>
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  يمكن لكل معلم تخصيص مجموعات الواتساب أو الأرقام الخاصة به لكل فصل. سنكتفي بوضع رابط المجموعة أو الرقم المباشر.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveTeacherGroups}
                disabled={isSavingTeacherGroups}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingTeacherGroups ? 'جارٍ الحفظ...' : 'حفظ مجموعات الفصول الخاصة بي'}</span>
              </button>
            </div>

            {teacherGroupsSaveNotice && (
              <div className="p-3 bg-white border border-emerald-300 text-emerald-950 text-xs font-bold rounded-xl">
                {teacherGroupsSaveNotice}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes.map((cls) => {
                const classGrps = teacherClassGroups[cls.id] || [];
                return (
                  <div key={cls.id} className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{cls.name}</span>
                        <span className="text-[10px] text-slate-500 font-bold">{cls.gradeLevel}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddTeacherGroupForClass(cls.id)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة رابط/رقم</span>
                      </button>
                    </div>

                    {classGrps.length === 0 ? (
                      <p className="text-[11px] text-slate-400 font-semibold text-center py-2">
                        لم تقم بربط أي مجموعة خاصة بك بعد لهذا الفصل.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {classGrps.map((grp, idx) => (
                          <div key={grp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-700 font-mono">
                                #{idx + 1} ({grp.recipientType === 'group' ? 'مجموعة' : 'هاتف'})
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateTeacherGroupForClass(
                                      cls.id,
                                      grp.id,
                                      'recipientType',
                                      grp.recipientType === 'group' ? 'phone' : 'group'
                                    )
                                  }
                                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                  {grp.recipientType === 'group' ? 'مجموعة' : 'هاتف'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeacherGroupForClass(cls.id, grp.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={grp.recipient}
                              onChange={(e) => handleUpdateTeacherGroupForClass(cls.id, grp.id, 'recipient', e.target.value)}
                              placeholder={
                                grp.recipientType === 'group'
                                  ? 'رابط المجموعة (chat.whatsapp.com/...) أو ID'
                                  : 'رقم الهاتف (+966501234567)'
                              }
                              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white dir-ltr text-left"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Teacher-Specific Zoom Link for this Class */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-indigo-950 flex items-center gap-1">
                          <span>🔗 رابط زوم المباشر لهذا الفصل (خاص بك):</span>
                        </label>
                        {(teacherClassZoomLinks[cls.id] || cls.zoomUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherClassZoomLinks((prev) => ({ ...prev, [cls.id]: '' }));
                            }}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-0.5 cursor-pointer px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>مسح الرابط</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={teacherClassZoomLinks[cls.id] ?? cls.zoomUrl ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTeacherClassZoomLinks((prev) => ({ ...prev, [cls.id]: val }));
                        }}
                        placeholder="https://zoom.us/j/..."
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-indigo-200 rounded-lg bg-indigo-50/40 text-slate-900 dir-ltr text-left"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEND NOW IMMEDIATE DISPATCH CARD */}
          <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>إرسال التذكيرات حالاً وبدون انتظار (إرسال فوري بنقرة واحدة)</span>
                </h3>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  تتيح لك هذه الميزة إرسال رسائل التذكير فوراً للطلاب الآن دون انتظار موعد الـ 5 دقائق التلقائي
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sendNowTarget}
                  onChange={(e) => setSendNowTarget(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold border border-amber-300 rounded-xl bg-white text-slate-900"
                >
                  <option value="all">جميع الحصص النشطة ({sessions.filter(s => s.isActive).length})</option>
                  {sessions.filter(s => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.className} - {s.sessionTitle}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSendNow}
                  disabled={isSendingNow}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isSendingNow ? (
                    <span>جارٍ الإرسال...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>🚀 إرسال التذكيرات حالاً</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {sendNowFeedback && (
              <div className="p-2.5 bg-white border border-amber-300 text-amber-950 text-xs font-bold rounded-xl">
                {sendNowFeedback}
              </div>
            )}
          </div>

          {/* CLOUD CREDENTIALS PROVIDER FORM */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-600" />
                <span>إعدادات المزود السحابي (Green-API / UltraMsg / Webhook / Meta):</span>
              </span>

              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedProvider('green_api')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedProvider === 'green_api' ? 'bg-emerald-600 text-white font-black' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Green-API
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('ultramsg')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedProvider === 'ultramsg' ? 'bg-emerald-600 text-white font-black' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  UltraMsg
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('webhook')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedProvider === 'webhook' ? 'bg-emerald-600 text-white font-black' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Webhook / API
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('meta')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedProvider === 'meta' ? 'bg-emerald-600 text-white font-black' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Meta API
                </button>
              </div>
            </div>

            {selectedProvider === 'green_api' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">IdInstance (Green-API):</label>
                  <input
                    type="text"
                    value={greenInstanceId}
                    onChange={(e) => setGreenInstanceId(e.target.value)}
                    placeholder="مثال: 1101923456"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ApiTokenInstance (Green-API):</label>
                  <input
                    type="password"
                    value={greenToken}
                    onChange={(e) => setGreenToken(e.target.value)}
                    placeholder="رمز ApiTokenInstance السري"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
              </div>
            )}

            {selectedProvider === 'ultramsg' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Instance ID (UltraMsg):</label>
                  <input
                    type="text"
                    value={ultraInstanceId}
                    onChange={(e) => setUltraInstanceId(e.target.value)}
                    placeholder="مثال: instance104351"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Token (UltraMsg):</label>
                  <input
                    type="password"
                    value={ultraToken}
                    onChange={(e) => setUltraToken(e.target.value)}
                    placeholder="مثال: xyz123abc456token"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
              </div>
            )}

            {selectedProvider === 'webhook' && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-700">رابط Webhook / API Custom Endpoint:</label>
                <input
                  type="text"
                  value={customWebhookUrl}
                  onChange={(e) => setCustomWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/api/send-whatsapp"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                />
              </div>
            )}

            {selectedProvider === 'meta' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Phone Number ID (Meta):</label>
                  <input
                    type="text"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value)}
                    placeholder="مثال: 108392019283"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Access Token (Meta):</label>
                  <input
                    type="password"
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    placeholder="EAA..."
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-slate-700">رقم الهاتف لتجربة الفحص الحي:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={liveTestPhone}
                  onChange={(e) => setLiveTestPhone(e.target.value)}
                  placeholder="مثال: 966501234567"
                  className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={handleRunLiveTest}
                  disabled={isTestingLive}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingLive ? 'جارٍ التجربة...' : 'اختبار رسالة تجريبية بالهاتف'}</span>
                </button>
              </div>
            </div>

            {liveTestSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{liveTestSuccess}</span>
              </div>
            )}

            {liveTestError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{liveTestError}</span>
              </div>
            )}

            {waSaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ وتثبيت إعدادات المزود السحابي بنجاح!</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveWaProviderSettings}
                disabled={waLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ بيانات المزود السحابي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 3: PUBLISHED DOMAIN & STUDENT QR LINK SETTINGS           */}
      {/* ================================================================= */}
      {activeTab === 'domain' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">🌐 نطاق نشر المنصة لروابط وباركود الطلاب</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد الرابط العام النهائي المستعمل في توليد روابط وباركود التحضير المباشر للطلاب
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 block">
                نطاق النشر النشط (Published Domain / URL):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://zoom123.ai.studio"
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={handleSaveDomain}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ النطاق</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">
                رابط الموقع الحالي بالمتصفح: <code className="font-mono text-slate-800 bg-white px-2 py-0.5 rounded border">{getActiveSiteOrigin()}</code>
              </span>
              <button
                type="button"
                onClick={handleResetToCurrentOrigin}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                إعادة ضبط للرابط الحالي تلقائياً
              </button>
            </div>

            {domainSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ وتثبيت نطاق نشر روابط الباركود بنجاح!</span>
              </div>
            )}
          </div>

          {/* Sample Student Link Preview Card */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
            <h3 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>معاينة الرابط المولد لفصولك استناداً لهذا النطاق:</span>
            </h3>

            <div className="space-y-2">
              {classes.slice(0, 3).map((c) => {
                const sampleSession: ClassSession = {
                  id: `class_${c.id}`,
                  teacherId: currentTeacher.id,
                  classId: c.id,
                  className: c.name,
                  sessionTitle: `حصة ${currentTeacher.subject} - ${c.name}`,
                  zoomUrl: c.zoomUrl || currentTeacher.defaultZoomLink || 'https://zoom.us/j/123456789',
                  targetTrack: 'all',
                  createdAt: new Date().toISOString(),
                  scheduledTime: 'مباشر الآن',
                  isActive: true,
                  attendance: [],
                };
                const link = buildStudentAttendanceLink(sampleSession, currentTeacher, domainInput);

                return (
                  <div key={c.id} className="p-3 bg-white rounded-xl border border-blue-100 flex items-center justify-between gap-3 text-xs">
                    <div className="overflow-hidden text-right">
                      <div className="font-bold text-slate-900">{c.name} ({c.gradeLevel})</div>
                      <div className="text-[10px] text-blue-700 font-mono truncate dir-ltr text-left mt-0.5">{link}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        setCopiedLinkClassId(c.id);
                        setTimeout(() => setCopiedLinkClassId(null), 2000);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedLinkClassId === c.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 4: MASTER ADVANCED SYNC DASHBOARD                          */}
      {/* ================================================================= */}
      {activeTab === 'sync' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">🔄 لوحة المزامنة المتقدمة والنسخ الاحتياطي</h2>
                <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                  مستر أحمد بدوي
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                مزامنة فورية ودقيقة للفصول والطلاب والحصص مع الخادم السحابي مع العرض المباشر
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSyncMode('full')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer ${
                syncMode === 'full' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>مزامنة شاملة لكل البيانات</span>
            </button>

            <button
              type="button"
              onClick={() => setSyncMode('selective')}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer ${
                syncMode === 'selective' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Layers className="w-4 h-4 text-purple-600" />
              <span>تحديد عناصر معينة</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <School className="w-4 h-4 text-emerald-600 mb-1" />
              <div className="text-lg font-mono font-black text-slate-900">{classes.length}</div>
              <div className="text-[10px] font-bold text-slate-500">فصل دراسي</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <Users className="w-4 h-4 text-blue-600 mb-1" />
              <div className="text-lg font-mono font-black text-slate-900">{students.length}</div>
              <div className="text-[10px] font-bold text-slate-500">طالب ({englishStudentsCount} لغات · {arabicStudentsCount} عربي)</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <Video className="w-4 h-4 text-purple-600 mb-1" />
              <div className="text-lg font-mono font-black text-slate-900">{sessions.length}</div>
              <div className="text-[10px] font-bold text-slate-500">حصة دراسية</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <ArrowLeftRight className="w-4 h-4 text-amber-600 mb-1" />
              <div className="text-lg font-mono font-black text-slate-900">{teachers.length}</div>
              <div className="text-[10px] font-bold text-slate-500">معلم بالنظام</div>
            </div>
          </div>

          {/* Admin Security PIN */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
            <label className="text-xs font-black text-amber-950 block">
              كلمة مرور المعلم المشرف (Admin PIN):
            </label>
            <div className="relative">
              <input
                type={showAdminPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(null); }}
                placeholder="أدخل كلمة مرور مستر أحمد بدوي (الافتراضية: 123654)"
                className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 pl-10 text-xs font-bold text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <div className="text-[11px] font-bold text-rose-600">{passwordError}</div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-bold">حالة الاتصال السحابي: متصل تلقائياً مع SSE</span>
            <button
              type="button"
              onClick={handleStartMasterSync}
              disabled={isSyncing}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جارٍ المزامنة السحابية...' : 'بدء المزامنة الفورية الآن'}</span>
            </button>
          </div>

          {syncResult && syncResult.success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تمت المزامنة بنجاح وحفظ كافة بيانات السحابة! ({syncResult.timestamp})</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* SPECIAL SECTION: VERCEL & GITHUB HOSTING CLOUD SYNC HUB           */}
          {/* ================================================================= */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-3xl space-y-4 shadow-xl border border-slate-700/60 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-indigo-400 flex items-center justify-center border border-white/10">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>🚀 تطوير وربط المزامنة مع Vercel و GitHub</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-mono font-bold">
                      zoom2000.vercel.app
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    حل مشكلة عدم المزامنة على Vercel وربط السيرفر السحابي لحفظ الحضور والبيانات فورياً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckVercelStatus}
                disabled={isCheckingVercel}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingVercel ? 'animate-spin' : ''}`} />
                <span>{isCheckingVercel ? 'جارٍ الفحص الحي...' : 'فحص الاتصال مع Vercel'}</span>
              </button>
            </div>

            {/* Vercel Status Diagnostic Alert */}
            {vercelCheckResult && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold border flex items-start gap-2.5 ${
                  vercelCheckResult.status === 'connected'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : vercelCheckResult.status === 'static_spa_fallback'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                }`}
              >
                {vercelCheckResult.status === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 overflow-hidden">
                  <div className="font-extrabold">{vercelCheckResult.message}</div>
                  <div className="text-[10px] opacity-80 font-mono dir-ltr text-right">
                    Target API: {vercelCheckResult.activeApiUrl} {vercelCheckResult.pingMs ? `(${vercelCheckResult.pingMs}ms)` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions: Sync Code & Portable Sync (1-Click Laptop <-> Phone) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Upload className="w-4 h-4" />
                  <span>تصدير كود المزامنة (من اللابتوب)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  احصل على كود شامل لكل فصولك وطلابك وجدولك، وانسخه بنقرة واحدة لتطبيقه على هاتفك فوراً دون انتظار.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateSyncCode}
                  className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>توليد ونسخ كود المزامنة السحابي</span>
                </button>
              </div>

              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <Download className="w-4 h-4" />
                  <span>استيراد كود المزامنة (على الموبايل)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  افتح الموقع على هاتفك، ثم الصق كود المزامنة هنا واضغط تطبيق، ليصبح هاتفك مطابقاً تماماً للابتوب في ثانية.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importCodeText}
                    onChange={(e) => setImportCodeText(e.target.value)}
                    placeholder="الصق كود المزامنة هنا..."
                    className="flex-1 px-3 py-1.5 text-xs bg-black/40 border border-white/20 rounded-xl text-white placeholder:text-slate-500 font-mono dir-ltr"
                  />
                  <button
                    type="button"
                    onClick={handleApplyImportSyncCode}
                    disabled={isImporting || !importCodeText.trim()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <span>{isImporting ? 'جارٍ التطبيق...' : 'تطبيق'}</span>
                  </button>
                </div>
                {importStatus && (
                  <div className={`text-[10px] font-bold ${importStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {importStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Backend URL Configuration */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-slate-200 block">
                رابط السيرفر السحابي الخلفي (Backend Server URL):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={customBackendUrl}
                  onChange={(e) => setCustomBackendUrlState(e.target.value)}
                  placeholder="اتركه فارغاً للاعتماد على /api التلقائي على Vercel، أو أدخل رابط سيرفرك الخارجي"
                  className="flex-1 px-3 py-2 text-xs bg-black/40 border border-white/20 rounded-xl text-white placeholder:text-slate-500 font-mono dir-ltr text-left focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomBackendUrl}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  حفظ الرابط
                </button>
              </div>
              {backendSaveMsg && (
                <div className="text-[11px] font-bold text-emerald-400">{backendSaveMsg}</div>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                💡 تم الآن تجهيز وتضمين ملف <code className="text-indigo-300 font-mono">api/index.ts</code> وملف <code className="text-indigo-300 font-mono">vercel.json</code> المحدث في مستودع GitHub، حيث يقوم Vercel تلقائياً بتشغيل السيرفر بدون أي إعدادات إضافية فور عمل Push على GitHub!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Code Modal */}
      {showSyncCodeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>كود المزامنة السحابي الموحد (JSON Sync Code)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSyncCodeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              انسخ هذا الكود بالكامل، ثم افتح الموقع على هاتفك (أو أي جهاز آخر)، واذهب إلى الإعدادات &gt; المزامنة، والصق الكود واضغط "تطبيق" ليتم نقل وتحديث كافة بياناتك فوراً!
            </p>

            <textarea
              readOnly
              value={syncCodeString}
              rows={8}
              className="w-full p-3 text-[10px] font-mono bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 dir-ltr text-left focus:outline-none select-all"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(syncCodeString);
                  setSyncCodeCopied(true);
                  setTimeout(() => setSyncCodeCopied(false), 2500);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {syncCodeCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{syncCodeCopied ? 'تم النسخ بنجاح!' : 'نسخ الكود إلى الحافظة'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSyncCodeModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 5: LOCK PLATFORM PORTAL                                   */}
      {/* ================================================================= */}
      {activeTab === 'lock' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-black text-slate-900">قفل المنصة وحماية الحساب</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              عند إغلاق لوحة التحكم أو قفلها، سيتطلب إعادة فتحها إدخال رمز المرور السري (Teacher PIN)، لمنع أي شخص أو طالب من الوصول لكشوف ودرجات وإعدادات المنصة.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onLockDashboard}
              className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-black shadow-xl hover:scale-105 transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <Lock className="w-5 h-5 text-amber-400" />
              <span>تأكيد قفل المنصة الآن</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 6: CHANGE PASSWORD FORM                                   */}
      {/* ================================================================= */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5 max-w-lg mx-auto animate-in fade-in">
          <div className="text-center space-y-1 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900">تعديل كلمة مرور المشرف (Teacher PIN)</h2>
            <p className="text-xs text-slate-500">
              حماية لوحة التحكم ومنع دخول الطلاب برمز مرور مخصص للمشرف العام
            </p>
          </div>

          {!isOwner ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-center text-xs font-bold">
              تعديل كلمة المرور متاح حصرياً عبر حساب المشرف العام (مستر أحمد بدوي).
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-bold">كلمة المرور الحالية:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border">
                    {showCurrentPin ? currentPin : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    {showCurrentPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  كلمة المرور الجديدة (Teacher PIN):
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    required
                    value={newPin}
                    onChange={(e) => { setNewPin(e.target.value); setPwError(null); }}
                    placeholder="أدخل كلمة المرور الجديدة (مثال: 123654)"
                    className="w-full pr-10 pl-10 py-2.5 text-center text-base font-mono font-bold border border-slate-200 rounded-2xl bg-white text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {pwError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 text-center">
                  {pwError}
                </div>
              )}

              {pwSaved && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-black rounded-xl border border-emerald-200 text-center flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>تم تحديث وحفظ كلمة المرور بنجاح!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!newPin.trim() || isSubmittingPw}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmittingPw ? 'جارٍ الحفظ...' : 'تأكيد وحفظ كلمة المرور الجديدة'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
