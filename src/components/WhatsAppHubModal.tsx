import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Power,
  Globe,
  Sparkles,
  HelpCircle,
  PhoneCall,
  Bell,
  Settings,
  Link2,
  ShieldCheck,
  ArrowRight,
  Zap,
  RefreshCw,
  Cpu,
  Key,
  Sliders,
  RotateCcw,
  Edit3,
  Calendar
} from 'lucide-react';
import { WhatsAppLog, WhatsAppSessionState, SchoolClass, ClassSession, TeacherProfile, WhatsAppProvider } from '../types';
import {
  getWhatsAppStatus,
  disconnectWhatsApp,
  toggleAutoRemind,
  sendWhatsAppReminder,
  getWhatsAppLogs,
  clearWhatsAppLogs,
  saveWhatsAppProviderConfig,
  testWhatsAppLiveConnection,
  sendWhatsAppNow,
} from '../utils/apiSync';
import {
  buildWhatsAppChatUrl,
  buildWhatsAppReminderMessage,
  DEFAULT_REMINDER_TEMPLATE,
  getTimingLabel,
  openWhatsAppDirectly,
} from '../utils/whatsappHelper';
import { getPublishedDomain } from '../utils/urlHelper';

interface WhatsAppHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes?: SchoolClass[];
  sessions?: ClassSession[];
  currentTeacher?: TeacherProfile;
}

export const WhatsAppHubModal: React.FC<WhatsAppHubModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  sessions = [],
  currentTeacher,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'cloud_connect' | 'reminder_settings' | 'direct_dispatch' | 'whatsapp_web' | 'logs'>('cloud_connect');

  const [session, setSession] = useState<WhatsAppSessionState>({
    status: 'connected',
    phoneNumber: '+966 50 123 4567',
    connectedAt: new Date().toISOString(),
    batteryLevel: 98,
    autoRemindEnabled: true,
    reminderMinutesBefore: 5,
    provider: 'green_api',
    greenApiInstanceId: '',
    greenApiToken: '',
    ultraMsgInstanceId: '',
    ultraMsgToken: '',
    webhookUrl: '',
    customMessageTemplate: DEFAULT_REMINDER_TEMPLATE,
  });

  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Cloud Provider Form State
  const [selectedProvider, setSelectedProvider] = useState<WhatsAppProvider>('green_api');
  const [greenInstanceId, setGreenInstanceId] = useState('');
  const [greenToken, setGreenToken] = useState('');
  const [ultraInstanceId, setUltraInstanceId] = useState('');
  const [ultraToken, setUltraToken] = useState('');
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [liveTestPhone, setLiveTestPhone] = useState('');

  // Live Test states
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [liveTestSuccess, setLiveTestSuccess] = useState<string | null>(null);
  const [liveTestError, setLiveTestError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Message customization & timing states
  const [selectedMinutesBefore, setSelectedMinutesBefore] = useState<number>(5);
  const [isCustomMinutesMode, setIsCustomMinutesMode] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('15');
  const [templateText, setTemplateText] = useState<string>(DEFAULT_REMINDER_TEMPLATE);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState(false);

  // Send Now state
  const [sendNowTarget, setSendNowTarget] = useState<string>('all');
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [sendNowFeedback, setSendNowFeedback] = useState<string | null>(null);

  // Quick test sender form for Tab 3
  const [testRecipient, setTestRecipient] = useState('');
  const [testMessage, setTestMessage] = useState('🔔 تجربة تذكير حصة زوم من بوابة تحضير الطلاب الذكية!');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Copy feedback for individual class templates
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const statusRes = await getWhatsAppStatus();
      if (statusRes.session) {
        setSession(statusRes.session);
        if (statusRes.session.provider) {
          setSelectedProvider(statusRes.session.provider);
        }
        if (statusRes.session.greenApiInstanceId) setGreenInstanceId(statusRes.session.greenApiInstanceId);
        if (statusRes.session.greenApiToken) setGreenToken(statusRes.session.greenApiToken);
        if (statusRes.session.ultraMsgInstanceId) setUltraInstanceId(statusRes.session.ultraMsgInstanceId);
        if (statusRes.session.ultraMsgToken) setUltraToken(statusRes.session.ultraMsgToken);
        if (statusRes.session.webhookUrl) setCustomWebhookUrl(statusRes.session.webhookUrl);
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
      setLogs(logsRes.logs || []);
    } catch (err) {
      console.warn('Error fetching WhatsApp data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProviderSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSaveSuccessNotice(false);
    try {
      const payload: Partial<WhatsAppSessionState> = {
        provider: selectedProvider,
        greenApiInstanceId: greenInstanceId.trim(),
        greenApiToken: greenToken.trim(),
        ultraMsgInstanceId: ultraInstanceId.trim(),
        ultraMsgToken: ultraToken.trim(),
        webhookUrl: customWebhookUrl.trim(),
        phoneNumber: liveTestPhone.trim() || session.phoneNumber,
        autoRemindEnabled: session.autoRemindEnabled,
        reminderMinutesBefore: selectedMinutesBefore,
        customMessageTemplate: templateText,
      };

      const res = await saveWhatsAppProviderConfig(payload);
      if (res.success && res.session) {
        setSession(res.session);
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 4000);
      }
    } catch (err) {
      console.error('Failed to save provider config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    setLoading(true);
    setSettingsSavedNotice(false);
    try {
      const minutesToSave = isCustomMinutesMode ? (parseInt(customMinutesInput, 10) || 5) : selectedMinutesBefore;
      const res = await toggleAutoRemind(
        session.autoRemindEnabled,
        minutesToSave,
        customWebhookUrl.trim(),
        templateText
      );
      if (res.success && res.session) {
        setSession(res.session);
        setSelectedMinutesBefore(minutesToSave);
        setSettingsSavedNotice(true);
        setTimeout(() => setSettingsSavedNotice(false), 3500);
      }
    } catch (err) {
      console.error('Failed to save reminder settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetTemplateToDefault = () => {
    setTemplateText(DEFAULT_REMINDER_TEMPLATE);
  };

  const handleInsertVariable = (variableTag: string) => {
    setTemplateText((prev) => `${prev} ${variableTag} `);
  };

  const handleSendNow = async () => {
    setIsSendingNow(true);
    setSendNowFeedback(null);
    try {
      const sessionIdToPass = sendNowTarget === 'all' ? undefined : sendNowTarget;
      const res = await sendWhatsAppNow(sessionIdToPass);
      if (res.success) {
        setSendNowFeedback(`✅ تم إرسال التذكيرات حالاً بنجاح (${res.dispatchedCount || 1} رسالة تم توجيهها)!`);
        const updatedLogs = await getWhatsAppLogs();
        setLogs(updatedLogs.logs || []);
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

  const handleRunLiveTest = async () => {
    if (!liveTestPhone.trim()) {
      setLiveTestError('يرجى كتابة رقم الهاتف مع كود الدولة لإرسال التجربة الحية (مثال: 966501234567)');
      return;
    }

    setIsTestingLive(true);
    setLiveTestSuccess(null);
    setLiveTestError(null);

    try {
      const res = await testWhatsAppLiveConnection({
        provider: selectedProvider,
        testPhone: liveTestPhone.trim(),
        instanceId: selectedProvider === 'green_api' ? greenInstanceId.trim() : ultraInstanceId.trim(),
        token: selectedProvider === 'green_api' ? greenToken.trim() : ultraToken.trim(),
        webhookUrl: customWebhookUrl.trim(),
        message: `✅ *تجربة الربط السحابي الفعلي لواتساب - بوابة تحضير الطلاب*\n━━━━━━━━━━━━━━━━━\nتهانينا! تم ربط حسابك السحابي بنجاح.\nالنظام الآن متصل وجاهز وسيقوم بإرسال التذكيرات التلقائية لكافة الحصص قبل موعدها بـ ${selectedMinutesBefore} دقائق دون أي تدخل منك.\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}`,
      });

      if (res.success) {
        setLiveTestSuccess(res.message || '✅ نجحت التجربة! وصلت الرسالة الحقيقية إلى هاتفك عبر السحابة.');
        if (res.session) setSession(res.session);
        const logsRes = await getWhatsAppLogs();
        setLogs(logsRes.logs || []);
      } else {
        setLiveTestError(res.error || 'تعذر إرسال الرسالة التجريبية، يرجى مراجعة معرف الحساب والتوكن.');
      }
    } catch (err: any) {
      setLiveTestError(err.message || 'فشل الاتصال بالخادم لإجراء التجربة');
    } finally {
      setIsTestingLive(false);
    }
  };

  const handleToggleAutoRemind = async () => {
    const updatedVal = !session.autoRemindEnabled;
    const res = await toggleAutoRemind(
      updatedVal,
      selectedMinutesBefore,
      customWebhookUrl.trim(),
      templateText
    );
    if (res.success && res.session) {
      setSession(res.session);
    } else {
      setSession((prev) => ({ ...prev, autoRemindEnabled: updatedVal }));
    }
  };

  const handleSendManualTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testMessage.trim()) return;

    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const res = await sendWhatsAppReminder({
        recipient: testRecipient.trim(),
        message: testMessage.trim(),
        className: 'رسالة تجريبية',
      });

      if (res.success) {
        setTestStatus('تم إرسال الرسالة بنجاح عبر السحابة وتسجيلها في السجل!');
        const updatedLogs = await getWhatsAppLogs();
        setLogs(updatedLogs.logs || []);
      } else {
        setTestStatus('حدث خطأ أثناء محاولة الإرسال');
      }
    } catch {
      setTestStatus('تعذر الاتصال بالخادم');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenDirectWhatsApp = async (recipient: string, message: string) => {
    const res = await openWhatsAppDirectly(recipient, message);
    if (res.note) {
      setSendNowFeedback(res.note);
      setTimeout(() => setSendNowFeedback(null), 5000);
    }
  };

  const handleCopyMessage = async (classId: string, message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedClassId(classId);
      setTimeout(() => setCopiedClassId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    await clearWhatsAppLogs();
    setLogs([]);
  };

  const buildSampleMessageForClass = (c: SchoolClass) => {
    const publishedDomain = getPublishedDomain();
    const classSession = sessions.find((s) => s.classId === c.id) || {
      id: `preview_${c.id}`,
      teacherId: currentTeacher?.id || 'teacher_ahmed_badawi',
      classId: c.id,
      className: c.name,
      sessionTitle: `حصة ${currentTeacher?.subject || 'المادة'} - فصل ${c.name}`,
      zoomUrl: c.zoomUrl || currentTeacher?.defaultZoomLink || 'https://zoom.us/join',
      targetTrack: 'all' as const,
      createdAt: new Date().toISOString(),
      scheduledTime: selectedMinutesBefore === 0 ? 'مباشر الآن' : `بعد ${selectedMinutesBefore} دقائق`,
      isActive: true,
      attendance: [],
    };

    return buildWhatsAppReminderMessage({
      session: classSession,
      schoolClass: c,
      teacher: currentTeacher,
      appUrl: publishedDomain,
      customTemplate: templateText,
      minutesBefore: selectedMinutesBefore,
    });
  };

  const isConnectedCloud = Boolean(
    (selectedProvider === 'green_api' && greenInstanceId && greenToken) ||
    (selectedProvider === 'ultramsg' && ultraInstanceId && ultraToken) ||
    (selectedProvider === 'webhook' && customWebhookUrl)
  );

  const activeSessions = sessions.filter((s) => s.isActive);

  // Dynamic timing badge text
  const currentTimingLabel = selectedMinutesBefore === 0
    ? 'حالاً (مع البداية)'
    : `قبل ${selectedMinutesBefore} د`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in font-sans dir-rtl">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  مركز واتساب السحابي وتعديل التذكيرات
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>الإرسال: {currentTimingLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                تعديل نص الرسالة، واختيار توقيت الإرسال (قبل 5د، 10د، أو حالاً)، والربط السحابي التلقائي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-100 bg-white shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('cloud_connect')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'cloud_connect'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>الربط السحابي الفعلي ⭐</span>
            </button>

            <button
              onClick={() => setActiveTab('reminder_settings')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'reminder_settings'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل الرسالة وتوقيت الإرسال ({currentTimingLabel})</span>
            </button>

            <button
              onClick={() => setActiveTab('direct_dispatch')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'direct_dispatch'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>إرسال مباشر بنقرة واحدة</span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp_web')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'whatsapp_web'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>واتساب ويب الرسمي</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>سجل الإرسال ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* TAB 1: CLOUD INTEGRATION */}
          {activeTab === 'cloud_connect' && (
            <div className="space-y-4">
              <div className="p-4 bg-linear-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-emerald-950 flex items-center gap-2">
                    <span>الربط السحابي الفعلي المستقل (Cloud WhatsApp Gateway)</span>
                    <span className="text-[9px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">بدون أخطاء الاقتران</span>
                  </h3>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    يربط رقمك مرة واحدة في السحابة، ويتولى خادمنا <strong>إرسال كافة رسائل التذكير وروابط زوم تلقائياً من تلقاء نفسه حسب التوقيت الذي تحدده ({currentTimingLabel})</strong>، دون الحاجة لفتح المتصفح أو أي نقرات إضافية!
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${isConnectedCloud ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <div>
                    <div className="text-xs font-black text-slate-800">
                      {isConnectedCloud ? 'حالة الربط السحابي: متصل ومستعد للإرسال التلقائي' : 'حالة الربط: بانتظار إدخال بيانات الربط السحابي'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      المزود النشط: {selectedProvider === 'green_api' ? 'Green-API (الموصى به)' : selectedProvider === 'ultramsg' ? 'UltraMsg' : 'Webhook مخصص'} • موعد الإرسال: {currentTimingLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                    {session.phoneNumber || 'لا يوجد رقم محدد'}
                  </span>
                </div>
              </div>

              {/* 3-Step Simple Arabic Guide */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>خطوات الربط الفعلي في دقيقة واحدة (تُنفذ لمرة واحدة فقط):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">1</div>
                    <div className="font-bold text-slate-800">سجل في Green-API</div>
                    <p className="text-[10px] text-slate-500">
                      ادخل على <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">green-api.com</a> وسجل مجاناً (Developer Plan).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">2</div>
                    <div className="font-bold text-slate-800">امسح الـ QR هناك</div>
                    <p className="text-[10px] text-slate-500">
                      في لوحة تحكم Green-API امسح كود QR بهاتفك (هناك يتم الربط بنجاح فوري 100% لأن خوادمهم معتمدة).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">3</div>
                    <div className="font-bold text-slate-800">انسخ الرموز هنا واختبر</div>
                    <p className="text-[10px] text-slate-500">
                      انسخ IdInstance و ApiToken وضعهم بالحقول أدناه واضغط "فحص واختبار الإرسال الحي".
                    </p>
                  </div>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">اختر المزود السحابي:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('green_api')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        selectedProvider === 'green_api' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      Green-API (الأفضل والمجاني)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('ultramsg')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        selectedProvider === 'ultramsg' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      UltraMsg
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('webhook')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        selectedProvider === 'webhook' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      Webhook مخصص
                    </button>
                  </div>
                </div>

                {selectedProvider === 'green_api' && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-slate-400" />
                          <span>معرف الحساب (IdInstance):</span>
                        </label>
                        <input
                          type="text"
                          value={greenInstanceId}
                          onChange={(e) => setGreenInstanceId(e.target.value)}
                          placeholder="مثال: 1101923456"
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>رمز الوصول السري (ApiTokenInstance):</span>
                        </label>
                        <input
                          type="password"
                          value={greenToken}
                          onChange={(e) => setGreenToken(e.target.value)}
                          placeholder="مثال: 5d8a9b2c..."
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedProvider === 'ultramsg' && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Instance ID:</label>
                        <input
                          type="text"
                          value={ultraInstanceId}
                          onChange={(e) => setUltraInstanceId(e.target.value)}
                          placeholder="مثال: instance104928"
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Token:</label>
                        <input
                          type="password"
                          value={ultraToken}
                          onChange={(e) => setUltraToken(e.target.value)}
                          placeholder="UltraMsg Token"
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedProvider === 'webhook' && (
                  <div className="space-y-1 pt-2">
                    <label className="text-[11px] font-bold text-slate-700">رابط Webhook المخصص (Zapier / Make / n8n):</label>
                    <input
                      type="url"
                      value={customWebhookUrl}
                      onChange={(e) => setCustomWebhookUrl(e.target.value)}
                      placeholder="https://hook.eu1.make.com/..."
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white dir-ltr text-left"
                    />
                  </div>
                )}

                {/* Test Phone Input & Action Buttons */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                      <span>رقم هاتفك لإرسال رسالة الاختبار الحقيقية والتأكد من وصولها:</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={liveTestPhone}
                        onChange={(e) => setLiveTestPhone(e.target.value)}
                        placeholder="مثال: 966501234567 أو 201012345678"
                        className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
                      />
                      <button
                        type="button"
                        onClick={handleRunLiveTest}
                        disabled={isTestingLive}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        {isTestingLive ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>جارٍ الإرسال الفعلي...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>🚀 فحص واختبار الإرسال الحي الآن</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {liveTestSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div>{liveTestSuccess}</div>
                        <div className="text-[10px] text-emerald-700 font-normal mt-0.5">
                          تم التحقق بنجاح! سيقوم خادمنا الآن بإرسال تذكيرات جميع الحصص تلقائياً حسب توقيت الإرسال المحدد.
                        </div>
                      </div>
                    </div>
                  )}

                  {liveTestError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div>فشل الإرسال التجريبي: {liveTestError}</div>
                        <div className="text-[10px] text-rose-700 font-normal mt-0.5">
                          تأكد من إدخال IdInstance و ApiTokenInstance بشكل صحيح ومسح الـ QR في موقع المزود أولاً.
                        </div>
                      </div>
                    </div>
                  )}

                  {saveSuccessNotice && (
                    <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم حفظ إعدادات الربط السحابي بنجاح!</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveProviderSettings()}
                      disabled={loading}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      حفظ الإعدادات وتأكيد الاتصال
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REMINDER SETTINGS & MESSAGE CUSTOMIZATION */}
          {activeTab === 'reminder_settings' && (
            <div className="space-y-5">
              {/* Top Toggle Switch */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <span>التذكير التلقائي الذكي بالحصص</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    يقوم الخادم بفحص جدولك وإرسال التذكيرات تلقائياً دون أي تدخل منك
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoRemind}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                    session.autoRemindEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  {session.autoRemindEnabled ? '✓ مفعّل حالياً' : 'معطّل'}
                </button>
              </div>

              {/* TIMING SELECTION SECTION */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>تحديد موعد الإرسال التلقائي للتذكير:</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    المحدد حالياً: {currentTimingLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMinutesBefore(0);
                      setIsCustomMinutesMode(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      !isCustomMinutesMode && selectedMinutesBefore === 0
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⚡ حالاً</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">مع بداية الحصة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMinutesBefore(5);
                      setIsCustomMinutesMode(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      !isCustomMinutesMode && selectedMinutesBefore === 5
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⏱️ قبل 5 دقائق</div>
                    <div className="text-[9px] text-emerald-700 font-semibold mt-0.5">الموصى به ⭐</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMinutesBefore(10);
                      setIsCustomMinutesMode(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      !isCustomMinutesMode && selectedMinutesBefore === 10
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⏱️ قبل 10 دقائق</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">تحضير مبكر</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMinutesBefore(15);
                      setIsCustomMinutesMode(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      !isCustomMinutesMode && selectedMinutesBefore === 15
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⏱️ قبل 15 دقيقة</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">ربع ساعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMinutesBefore(30);
                      setIsCustomMinutesMode(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      !isCustomMinutesMode && selectedMinutesBefore === 30
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⏱️ قبل 30 دقيقة</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">نصف ساعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMinutesMode(true);
                      const parsed = parseInt(customMinutesInput, 10) || 20;
                      setSelectedMinutesBefore(parsed);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isCustomMinutesMode
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">⚙️ وقت مخصص</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">تحديد يدوي</div>
                  </button>
                </div>

                {isCustomMinutesMode && (
                  <div className="pt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
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
                          if (!isNaN(parsed) && parsed >= 0) {
                            setSelectedMinutesBefore(parsed);
                          }
                        }}
                        className="w-20 px-3 py-1.5 text-xs font-black font-mono border border-slate-300 rounded-lg bg-white text-center"
                      />
                      <span className="text-xs text-slate-600 font-bold">دقيقة قبل الحصة</span>
                    </div>
                  </div>
                )}
              </div>

              {/* IMMEDIATE DISPATCH "حالا" ACTION CARD */}
              <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>إرسال تذكير "حالاً" الآن دون انتظار الموعد:</span>
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      يمكنك توجيه الرسالة التذكيرية فوراً الآن لكافة فصولك أو لفصل محدد بنقرة واحدة
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={sendNowTarget}
                    onChange={(e) => setSendNowTarget(e.target.value)}
                    className="flex-1 w-full px-3 py-2 text-xs font-bold border border-amber-300 rounded-xl bg-white text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">⚡ إرسال لكافة حصص اليوم النشطة ({activeSessions.length} حصة)</option>
                    {activeSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.className} - {s.sessionTitle} ({s.scheduledTime || 'مباشر'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleSendNow}
                    disabled={isSendingNow}
                    className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {isSendingNow ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جارٍ الإرسال حالاً...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>🚀 إرسال التذكير حالاً عبر واتساب</span>
                      </>
                    )}
                  </button>
                </div>

                {sendNowFeedback && (
                  <div className="p-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{sendNowFeedback}</span>
                  </div>
                )}
              </div>

              {/* MESSAGE TEMPLATE CUSTOMIZATION SECTION */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-emerald-600" />
                      <span>تعديل وتخصيص نص رسالة التذكير:</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      يمكنك كتابة نصك المفضل واستخدام المتغيرات الذكية بالضغط عليها لإدراجها تلقائياً
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetTemplateToDefault}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>استعادة النص الافتراضي</span>
                  </button>
                </div>

                {/* Variable Tags Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-600">
                    اضغط على أي كلمة لإضافتها داخل نص الرسالة:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{الفصل}', label: '📚 اسم الفصل' },
                      { tag: '{المادة}', label: '📖 عنوان الحصة/المادة' },
                      { tag: '{المعلم}', label: '👤 اسم المعلم' },
                      { tag: '{الموعد}', label: '⏰ موعد الحصة' },
                      { tag: '{وقت_التذكير}', label: '⏱️ توقيت الإرسال' },
                      { tag: '{رابط_زوم}', label: '🔗 رابط زوم' },
                      { tag: '{رابط_الحضور}', label: '📝 رابط تحضير الطلاب' },
                      { tag: '{الفئة}', label: '🎯 المسار (عربي/لغات)' },
                    ].map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleInsertVariable(item.tag)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Textarea */}
                <div className="space-y-1">
                  <textarea
                    rows={8}
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 leading-relaxed"
                    placeholder="اكتب نص رسالة التذكير هنا..."
                  />
                </div>

                {/* LIVE PREVIEW BOX */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>معاينة حية لشكل الرسالة على واتساب الطالب وولي الأمر:</span>
                    <span className="text-[10px] text-slate-400 font-normal">تتحدث تلقائياً مع التعديل</span>
                  </div>
                  <div className="p-3.5 bg-emerald-950/5 border border-emerald-200/80 rounded-xl text-[11px] font-mono text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                    {buildWhatsAppReminderMessage({
                      session: sessions[0] || {
                        id: 'demo_ses',
                        className: 'Grade 8 - لغات',
                        sessionTitle: 'Science & Biology',
                        targetTrack: 'english',
                        scheduledTime: '10:00 ص',
                        isActive: true,
                        attendance: [],
                      },
                      schoolClass: classes[0],
                      teacher: currentTeacher,
                      appUrl: getPublishedDomain(),
                      customTemplate: templateText,
                      minutesBefore: selectedMinutesBefore,
                    })}
                  </div>
                </div>

                {settingsSavedNotice && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>تم حفظ نموذج الرسالة وتوقيت الإرسال ({currentTimingLabel}) بنجاح!</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveReminderSettings}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>💾 حفظ إعدادات التذكير والرسالة</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ONE-CLICK DIRECT DISPATCH (BACKUP) */}
          {activeTab === 'direct_dispatch' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  هذا الخيار يتيح لك إرسال تذكير فوري لأي فصل بضغطة زر واحدة في أي وقت دون انتظار موعد الحصة.
                </p>
              </div>

              {/* Classes Quick Dispatch Cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>إرسال التذكيرات الفورية لفصولك الدراسية بنقرة واحدة:</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">
                    جاهز مع روابط زوم وبوابة الطلاب
                  </span>
                </div>

                {classes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {classes.map((cls) => {
                      const sampleMsg = buildSampleMessageForClass(cls);
                      const recipient = cls.whatsappRecipient || '';
                      const isCopied = copiedClassId === cls.id;

                      return (
                        <div
                          key={cls.id}
                          className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                فصل {cls.name}
                              </span>
                              {recipient ? (
                                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md dir-ltr truncate max-w-[180px]">
                                  {recipient}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  لم يُحدد رقم (سيفتح جهات اتصالك)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              رابط زوم المباشر + رابط تحضير الطلاب بحصتك القادمة
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(cls.id, sampleMsg)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                              title="نسخ نص الرسالة"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDirectWhatsApp(recipient, sampleMsg)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>إرسال لواتساب الآن</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    لم يتم تسجيل أي فصول دراسية بعد. يمكنك إرسال رسالة تجريبية أدناه.
                  </div>
                )}
              </div>

              {/* Fast Single Number Dispatcher */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                  <span>إرسال فوري إلى رقم مخصص أو رابط مجموعة:</span>
                </h4>
                <form onSubmit={handleSendManualTest} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder="رقم الهاتف (مثال: 966501234567)"
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
                    />
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="نص الرسالة..."
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenDirectWhatsApp(testRecipient, testMessage)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح في تطبيق واتساب بالهاتف أو اللابتوب</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingTest}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingTest ? 'جارٍ الإرسال...' : 'إرسال سحابي فوري'}</span>
                    </button>
                  </div>
                  {testStatus && (
                    <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{testStatus}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: OFFICIAL WHATSAPP WEB */}
          {activeTab === 'whatsapp_web' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-950 font-black text-sm">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>بوابة واتساب ويب الرسمية (WhatsApp Web)</span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  إذا كنت ترغب في فتح واتساب ويب في نافذة مستقلة لربطه بالطريقة الرسمية لشركة ميتا على لابتوبك:
                </p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 text-center space-y-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">
                    موقع WhatsApp Web الرسمي لشركة ميتا
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    بمجرد فتح واتساب ويب وربطه على لابتوبك لمرة واحدة، ستعمل جميع روابط الإرسال المباشر فوراً!
                  </p>
                </div>

                <div className="pt-2">
                  <a
                    href="https://web.whatsapp.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <span>فتح WhatsApp Web الرسمي في تبويب جديد</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SENT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>سجل الرسائل والتذكيرات الصادرة ({logs.length}):</span>
                </h4>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح السجل</span>
                  </button>
                )}
              </div>

              {logs.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2.5 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            {log.className || 'حصة عامة'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {log.recipient}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            log.status === 'sent'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}>
                            {log.status === 'sent' ? '✓ تم الإرسال السحابي' : 'فشل الإرسال'}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {log.triggerType === 'auto_5min' ? 'تذكير آلي مجدول' : 'إرسال يدوي'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-mono truncate">
                          {log.messagePreview}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(log.sentAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  لا توجد رسائل مسجلة بعد في السجل.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام إرسال سحابي مشفر يرسل تذكيرات الحضور وزوم تلقائياً</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer transition-colors shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
