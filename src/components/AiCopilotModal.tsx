import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  X,
  CheckCircle2,
  Calendar,
  Video,
  Users,
  RotateCcw,
  MessageCircle,
  HelpCircle,
  AlertCircle,
  PlusCircle,
  Bot,
  Trash2,
  CornerDownLeft,
  ChevronRight
} from 'lucide-react';
import { TeacherProfile, ClassSession, SchoolClass, Student } from '../types';
import { askAiCopilot, AiCopilotResponse, AiCopilotMessage } from '../utils/apiSync';

interface AiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeacher: TeacherProfile;
  onStateUpdated?: (db: {
    sessions?: ClassSession[];
    teachers?: TeacherProfile[];
    classes?: SchoolClass[];
    students?: Student[];
  }) => void;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: string;
  actionPayload?: any;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  suggestedAnswers?: string[];
  pendingAction?: any;
  timestamp: string;
}

const PRESET_PROMPTS = [
  { label: '🗓️ خلّي 4A و 4B عام و 8A عربي', prompt: 'عدل الجدول بتاعي بحيث كل الحصص لغات عدا 4a و 4b عام و 8a عربي فقط' },
  { label: '⚡ ولّد حصص النهاردة من الجدول', prompt: 'ولّد حصص النهاردة من جدول الحصص الأسبوعي بتاعي' },
  { label: '➕ ضيف طالب جديد للكشف', prompt: 'عاوز اضيف طالب جديد في الكشف' },
  { label: '👥 مين الغايبين في حصة اليوم؟', prompt: 'مين الطلاب اللي غايبين النهاردة في الحصص الحالية؟' },
  { label: '🔄 تصفير سجل الحضور', prompt: 'صفر سجل الحضور والغياب لكل الحصص عشان نبدأ حصة جديدة' },
  { label: '🔗 غير رابط زوم لحصة', prompt: 'عاوز اغير رابط زوم لحصة' },
  { label: '📲 إرسال تذكير واتساب', prompt: 'ابعت تذكير واتساب لحصة اليوم دلوقتي فورا' },
];

export const AiCopilotModal: React.FC<AiCopilotModalProps> = ({
  isOpen,
  onClose,
  currentTeacher,
  onStateUpdated,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const initialWelcomeMessage: MessageItem = {
    id: 'welcome_1',
    sender: 'assistant',
    text: `أهلاً بيك يا مستر ${currentTeacher.name.split(' ')[0] || currentTeacher.name}! 🌟\nأنا المساعد الذكي الشخصي الخاص بيك وبفهم مصري تماماً.\nاطلب مني أي حاجة (تعديل الجداول، إضافة أو تعديل الحصص، تصفير الحضور، إضافة طلاب، أو روابط زوم والواتساب).\nولو فيه أي تفاصيل ناقصة أو حاجة محتاج أفهمها هسألك فوراً قبل ما أنفذ! 🚀`,
    suggestedAnswers: [
      'خلّي 4A و 4B عام و 8A عربي',
      'ولّد حصص النهاردة من الجدول',
      'مين الطلاب الغايبين؟',
      'صفر الحضور دلوقتي',
    ],
    timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState<MessageItem[]>(() => [initialWelcomeMessage]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recog = new SpeechRecognition();
        recog.lang = 'ar-EG'; // Egyptian Arabic
        recog.continuous = false;
        recog.interimResults = false;

        recog.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript || '';
          if (transcript) {
            setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsRecording(false);
        };

        recog.onerror = () => {
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Speech recognition error:', err);
        setIsRecording(false);
      }
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        ...initialWelcomeMessage,
        id: `welcome_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setPendingAction(null);
    setInputPrompt('');
  };

  const handleCancelPendingAction = () => {
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel_${Date.now()}`,
        sender: 'assistant',
        text: 'تمام يا مستر، لغيت الأمر المعلق. قولي تحب نعمل إيه مكانه؟ 😊',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: MessageItem = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Build conversation history from recent messages
      const historyPayload: AiCopilotMessage[] = messages.slice(-6).map((m) => ({
        role: m.sender,
        content: m.text,
        action: m.action,
        pendingAction: m.pendingAction,
      }));

      const res: AiCopilotResponse = await askAiCopilot(
        text,
        currentTeacher.id,
        historyPayload,
        pendingAction
      );

      // Manage pending action state for multi-turn questions
      if (res.needsClarification && res.pendingAction) {
        setPendingAction(res.pendingAction);
      } else if (res.action !== 'ASK_CLARIFICATION' && res.action !== 'CONFIRM_ACTION') {
        setPendingAction(null);
      }

      const assistantMessage: MessageItem = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: res.message || (res.success ? 'تم تنفيذ طلبك بنجاح يا مستر أحمد!' : 'عذراً، حدث خطأ أثناء تنفيذ الطلب.'),
        action: res.action,
        actionPayload: res.actionPayload,
        needsClarification: res.needsClarification,
        clarificationQuestion: res.clarificationQuestion,
        suggestedAnswers: res.suggestedAnswers,
        pendingAction: res.pendingAction,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (res.success && res.db && onStateUpdated) {
        onStateUpdated(res.db);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_${Date.now()}`,
          sender: 'assistant',
          text: 'معلش حصل خطأ غير متوقع في الاتصال بالذكاء الاصطناعي. جرب تاني بعد ثواني.',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadgeLabel = (action?: string) => {
    switch (action) {
      case 'UPDATE_SCHEDULE':
        return '🗓️ تم تعديل الجدول الأسبوعي وتحديث حصص اليوم';
      case 'GENERATE_TODAY_SESSIONS':
        return '⚡ تم توليد وتحديث حصص اليوم من الجدول';
      case 'CREATE_SESSION':
        return '➕ تم إنشاء الحصة وتفعيلها مباشرة';
      case 'UPDATE_SESSION':
        return '✏️ تم تحديث بيانات الحصة وموعدها';
      case 'UPDATE_CLASS_ZOOM':
        return '🔗 تم تحديث رابط زوم للفصل';
      case 'DELETE_SESSION':
        return '🗑️ تم حذف الحصة من القائمة';
      case 'CLEAR_ALL_SESSIONS':
        return '🧹 تم حذف وتفريغ كل حصص اليوم';
      case 'RESET_ATTENDANCE':
        return '🔄 تم تصفير سجل الحضور للبدء من جديد';
      case 'ADD_STUDENT':
        return '👤 تم إضافة الطالب للكشف بنجاح';
      case 'DELETE_STUDENT':
        return '🗑️ تم حذف الطالب من الكشف بنجاح';
      case 'UPDATE_STUDENT':
        return '📝 تم تعديل مسار وبيانات الطالب';
      case 'SET_CLASS_WHATSAPP':
        return '📲 تم ربط جهة الواتساب بالفصل بنجاح';
      case 'UPDATE_TEACHER_ZOOM':
        return '🎥 تم تحديث رابط زوم الافتراضي للمعلم';
      case 'SEND_WHATSAPP':
        return '📲 تم إرسال تذكير واتساب للحصة فوراً';
      case 'ASK_CLARIFICATION':
        return '❓ بانتظار توضيحك للمتابعة والتنفيذ';
      case 'CONFIRM_ACTION':
        return '⚠️ بانتظار تأكيدك للتنفيذ';
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 dir-rtl animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[92vh] max-h-[740px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header with vibrant AI styling */}
        <div className="bg-gradient-to-r from-violet-700 via-indigo-600 to-purple-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  المساعد الذكي (AI Copilot)
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                  بيفهم مصري 🇪🇬 وبيسأل للتوضيح
                </span>
              </div>
              <p className="text-xs text-indigo-100/90 font-medium mt-0.5">
                يفهم وينفذ ويسألك عند الحاجة لتوضيح أي طلب بدقة متناهية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetChat}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="بدء محادثة جديدة"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preset Quick Chips Bar */}
        <div className="bg-slate-50 border-b border-slate-200/80 p-2.5 sm:p-3 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 whitespace-nowrap min-w-max">
            <span className="text-[11px] font-bold text-slate-400 ml-1">أوامر سريعة:</span>
            {PRESET_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const badge = getActionBadgeLabel(msg.action);
            const isQuestion = msg.needsClarification || msg.action === 'ASK_CLARIFICATION' || msg.action === 'CONFIRM_ACTION';
            const hasOptions = Array.isArray(msg.suggestedAnswers) && msg.suggestedAnswers.length > 0;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isQuestion
                      ? 'bg-gradient-to-tr from-amber-500 to-violet-600 text-white shadow-xs'
                      : 'bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-xs'
                  }`}
                >
                  {isUser ? 'أنت' : isQuestion ? <HelpCircle className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 sm:p-3.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : isQuestion
                      ? 'bg-white text-slate-900 border-2 border-amber-300/80 rounded-tl-none shadow-md ring-2 ring-amber-100'
                      : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-none'
                  }`}
                >
                  {/* Clarification Indicator Ribbon */}
                  {isQuestion && (
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg mb-2 border border-amber-200 w-fit">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                      <span>المساعد الذكي محتاج توضيحك عشان ينفذ بالظبط:</span>
                    </div>
                  )}

                  <p className="whitespace-pre-line font-medium">{msg.text}</p>

                  {/* Clarification Question Highlight if separate */}
                  {msg.clarificationQuestion && msg.clarificationQuestion !== msg.text && (
                    <div className="mt-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl font-bold text-amber-950 text-xs sm:text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
                      <span>{msg.clarificationQuestion}</span>
                    </div>
                  )}

                  {/* Interactive Option Chips for Clarification Answers */}
                  {hasOptions && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <div className="text-[11px] font-extrabold text-slate-500 mb-2 flex items-center gap-1">
                        <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                        <span>اختر إجابتك بضغطة زر أو اكتب/تكلم بصوتك:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedAnswers!.map((answerText, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(answerText)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-indigo-50/90 hover:bg-indigo-600 hover:text-white text-indigo-900 text-xs font-bold rounded-xl border border-indigo-200/80 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <span>{answerText}</span>
                            <ChevronRight className="w-3 h-3 rtl:rotate-180 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Executed Action Badge */}
                  {badge && (
                    <div className={`mt-2.5 pt-2 border-t flex items-center gap-1.5 text-xs font-extrabold p-2 rounded-xl ${
                      isQuestion
                        ? 'border-amber-100 text-amber-800 bg-amber-50/80'
                        : 'border-emerald-100 text-emerald-700 bg-emerald-50/80'
                    }`}>
                      {isQuestion ? (
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>{badge}</span>
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1.5 ${
                      isUser ? 'text-indigo-200 text-left' : 'text-slate-400 text-right'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 p-3 rounded-2xl w-fit border border-indigo-100 animate-pulse">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>المساعد الذكي بيفهم طلبك وبيجهز الإجراء المطلوب... ⏳</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending Action Cancel Bar if active */}
        {pendingAction && (
          <div className="bg-amber-50 px-4 py-2 border-t border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <span className="font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              هناك طلب بانتظار توضيحك
            </span>
            <button
              type="button"
              onClick={handleCancelPendingAction}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              إلغاء هذا الطلب
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Input Button */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse ring-4 ring-rose-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={isRecording ? 'إيقاف التسجيل' : 'التحدث صوتياً باللهجة المصرية'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-indigo-600" />}
              </button>
            )}

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={
                  isRecording
                    ? 'جاري الاستماع لصوتك بالمصري...'
                    : pendingAction
                    ? 'اكتب إجابتك أو توضيحك للمساعد الذكي هنا...'
                    : 'اكتب أو اطلب بالمصري (مثال: ضيف طالب في 4A، أو غير ميعاد الحصة)...'
                }
                disabled={isLoading}
                className="w-full pl-3 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="py-2.5 sm:py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>إرسال</span>
              <Send className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
            <span>✨ ينفذ ويسألك للتوضيح: الجداول · الحصص · روابط زوم · تصفير الحضور · الطلاب · الواتساب</span>
            {isRecording && <span className="text-rose-600 font-bold animate-pulse">🔴 جاري الاستماع...</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
