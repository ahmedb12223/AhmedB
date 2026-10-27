import React, { useState, useEffect } from 'react';
import { X, Check, School, MessageCircle, Phone, Users, Send, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { SchoolClass, WhatsAppGroupConfig } from '../types';
import { ensureAbsoluteUrl } from '../utils/urlHelper';
import { sendWhatsAppReminder } from '../utils/apiSync';
import { buildWhatsAppChatUrl } from '../utils/whatsappHelper';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolClass: SchoolClass | null;
  onSave: (updated: {
    id: string;
    name: string;
    gradeLevel: string;
    zoomUrl?: string;
    whatsappRecipient?: string;
    whatsappRecipientType?: 'phone' | 'group';
    whatsappGroups?: WhatsAppGroupConfig[];
  }) => void;
}

export const EditClassModal: React.FC<EditClassModalProps> = ({
  isOpen,
  onClose,
  schoolClass,
  onSave,
}) => {
  const [name, setName] = useState(schoolClass?.name || '');
  const [gradeLevel, setGradeLevel] = useState(schoolClass?.gradeLevel || '');
  const [zoomUrl, setZoomUrl] = useState(schoolClass?.zoomUrl || '');

  // Multi-group state
  const [groups, setGroups] = useState<WhatsAppGroupConfig[]>([]);

  const [testingGroupId, setTestingGroupId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  useEffect(() => {
    if (schoolClass) {
      setName(schoolClass.name);
      setGradeLevel(schoolClass.gradeLevel);
      setZoomUrl(schoolClass.zoomUrl || '');
      setTestResults({});

      // Initialize groups from schoolClass.whatsappGroups or fallback to whatsappRecipient
      if (Array.isArray(schoolClass.whatsappGroups) && schoolClass.whatsappGroups.length > 0) {
        setGroups(schoolClass.whatsappGroups);
      } else if (schoolClass.whatsappRecipient?.trim()) {
        const splits = schoolClass.whatsappRecipient.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        const mapped: WhatsAppGroupConfig[] = splits.map((item, idx) => ({
          id: `wagrp_${Date.now()}_${idx}`,
          name: idx === 0 ? `مجموعة/هاتف الفصل الرئيسي` : `جهة إضافية ${idx + 1}`,
          recipient: item,
          recipientType: schoolClass.whatsappRecipientType || (item.includes('chat.whatsapp.com') || item.includes('@g.us') ? 'group' : 'phone'),
        }));
        setGroups(mapped);
      } else {
        setGroups([
          {
            id: `wagrp_${Date.now()}_0`,
            name: 'جروب الواتساب 1',
            recipient: '',
            recipientType: 'group',
          },
        ]);
      }
    }
  }, [schoolClass?.id, isOpen]);

  if (!isOpen || !schoolClass) return null;

  const handleAddGroup = () => {
    const newGrp: WhatsAppGroupConfig = {
      id: `wagrp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `جروب/رقم ${groups.length + 1}`,
      recipient: '',
      recipientType: 'group',
    };
    setGroups([...groups, newGrp]);
  };

  const handleRemoveGroup = (id: string) => {
    if (groups.length <= 1) {
      // Clear instead of removing last item
      setGroups([
        {
          id: `wagrp_${Date.now()}_0`,
          name: 'جروب الواتساب 1',
          recipient: '',
          recipientType: 'group',
        },
      ]);
      return;
    }
    setGroups(groups.filter((g) => g.id !== id));
  };

  const handleUpdateGroupField = (id: string, field: keyof WhatsAppGroupConfig, value: any) => {
    setGroups(
      groups.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, [field]: value };
        // Auto infer recipientType if recipient link updated
        if (field === 'recipient') {
          if (value.includes('chat.whatsapp.com') || value.includes('@g.us')) {
            updated.recipientType = 'group';
          }
        }
        return updated;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const validGroups = groups.filter((g) => g.recipient && g.recipient.trim().length > 0);
    const primaryRecipient = validGroups.map((g) => g.recipient.trim()).join('\n');
    const primaryType = validGroups[0]?.recipientType || 'group';

    onSave({
      id: schoolClass.id,
      name: name.trim(),
      gradeLevel: gradeLevel.trim() || 'المرحلة الدراسية',
      zoomUrl: zoomUrl.trim() ? ensureAbsoluteUrl(zoomUrl.trim()) : '',
      whatsappRecipient: primaryRecipient || undefined,
      whatsappRecipientType: primaryType,
      whatsappGroups: validGroups,
    });
    onClose();
  };

  const handleTestSingleGroup = async (group: WhatsAppGroupConfig) => {
    if (!group.recipient.trim()) {
      setTestResults((prev) => ({ ...prev, [group.id]: 'يرجى كتابة الرابط أو الرقم أولاً' }));
      return;
    }
    setTestingGroupId(group.id);
    setTestResults((prev) => ({ ...prev, [group.id]: 'جارٍ الإرسال والتجربة...' }));

    try {
      const testMsg = `🔔 *رسالة تجريبية من بوابة تحضير زوم الذكية*
━━━━━━━━━━━━━━━━━
📚 *الفصل:* ${name || schoolClass.name}
🏷️ *المجموعة:* ${group.name || 'مجموعة الفصل'}
✅ تم ربط هذه المجموعة بنجاح لتلقي تذكيرات زوم وبوابة التحضير مباشرة.`;

      const res = await sendWhatsAppReminder({
        recipient: group.recipient.trim(),
        message: testMsg,
        className: name || schoolClass.name,
      });

      if (res.success) {
        if (res.providerUsed === 'direct') {
          setTestResults((prev) => ({
            ...prev,
            [group.id]: `DIRECT_NEED_KEY|⚠️ تم تسجيل الجروب بالنظام! لإرسال الرسائل السحابية تلقائياً دون فتح الهاتف، يرجى التأكد من اختيار نوع المزود وحفظ التوكن (UltraMsg / Green-API / Meta) من صفحة (⚙️ الإعدادات -> ربط واتساب). يمكنك الإرسال المباشر للرسالة الآن عبر تطبيق الواتساب.`,
          }));
        } else {
          setTestResults((prev) => ({
            ...prev,
            [group.id]: `CLOUD_SUCCESS|✅ تم إرسال الرسالة الفكرية/الحقيقية إلى هاتف المستقبل عبر السحابة المباشرة بنجاح! (المزود: ${res.providerUsed})`,
          }));
        }
      } else {
        setTestResults((prev) => ({
          ...prev,
          [group.id]: `ERROR|فشل الإرسال: ${res.error || res.details?.error || 'تحقق من صحة الرقم أو مفتاح الربط'}`,
        }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [group.id]: 'ERROR|خطأ في الاتصال بالخدمة' }));
    } finally {
      setTestingGroupId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                إعدادات الفصل وربط مجموعات الواتساب
              </h2>
              <p className="text-xs text-slate-500">
                تعديل اسم الفصل، رابط زوم، وربطه بجروب واحد أو أكثر في الواتساب للإرسال التلقائي
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                اسم الفصل أو الشعبة:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: Grade 4 - A أو 7A"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-black border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                المرحلة الدراسية:
              </label>
              <input
                type="text"
                required
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="مثال: الصف الرابع (Grade 4)"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                رابط زوم الافتراضي للفصل (Zoom Meeting URL):
              </label>
              {zoomUrl && (
                <button
                  type="button"
                  onClick={() => setZoomUrl('')}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>مسح الرابط</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={zoomUrl}
              onChange={(e) => setZoomUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
            />
          </div>

          {/* Multi-WhatsApp Groups Section */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-950">
                    مجموعات وأرقام الواتساب المرتبطة ({groups.length})
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    يمكنك ربط الفصل بعدة مجموعات (مثل جروب الأمهات + الطلاب) ليصل التذكير إليها جميعاً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddGroup}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة جروب/رقم جديد</span>
              </button>
            </div>

            {/* List of groups */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {groups.map((group, index) => (
                <div
                  key={group.id}
                  className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center font-mono shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {group.recipientType === 'group' ? 'رابط/معرّف الملاحظات أو الجروب' : 'رقم الهاتف'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Type toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateGroupField(
                            group.id,
                            'recipientType',
                            group.recipientType === 'group' ? 'phone' : 'group'
                          )
                        }
                        className={`px-2 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${
                          group.recipientType === 'group'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                        }`}
                      >
                        {group.recipientType === 'group' ? (
                          <>
                            <Users className="w-3 h-3" />
                            <span>مجموعة</span>
                          </>
                        ) : (
                          <>
                            <Phone className="w-3 h-3" />
                            <span>هاتف</span>
                          </>
                        )}
                      </button>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(group.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف هذا الجروب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={group.recipient}
                      onChange={(e) => handleUpdateGroupField(group.id, 'recipient', e.target.value)}
                      placeholder={
                        group.recipientType === 'group'
                          ? 'رابط المجموعة (https://chat.whatsapp.com/...) أو ID'
                          : 'رقم الهاتف (+966501234567)'
                      }
                      className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-left"
                    />

                    {group.recipient.trim() && (
                      <button
                        type="button"
                        disabled={testingGroupId === group.id}
                        onClick={() => handleTestSingleGroup(group)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>{testingGroupId === group.id ? 'جارٍ الإرسال...' : 'تجربة'}</span>
                      </button>
                    )}
                  </div>

                  {testResults[group.id] && (() => {
                    const raw = testResults[group.id];
                    const [statusType, ...msgParts] = raw.includes('|') ? raw.split('|') : ['GENERAL', raw];
                    const msg = msgParts.join('|');
                    const isDirectWarning = statusType === 'DIRECT_NEED_KEY';
                    const isCloudSuccess = statusType === 'CLOUD_SUCCESS';
                    const sampleMsg = `🔔 *تذكير حصة زوم والمناهم - فصل ${name || schoolClass.name}*\nhttps://zoom.us`;
                    const directUrl = buildWhatsAppChatUrl(group.recipient, sampleMsg);

                    return (
                      <div className="space-y-2 pt-1">
                        <div
                          className={`p-2.5 rounded-xl text-xs font-bold leading-relaxed flex items-start gap-2 ${
                            isCloudSuccess
                              ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
                              : isDirectWarning
                              ? 'bg-amber-50 text-amber-950 border border-amber-300/80'
                              : 'bg-rose-50 text-rose-950 border border-rose-200'
                          }`}
                        >
                          {isCloudSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 space-y-1">
                            <p>{msg}</p>

                            {isDirectWarning && (
                              <div className="pt-1">
                                <a
                                  href={directUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>فتح الرسالة الآن في تطبيق الواتساب 💬</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-emerald-800 leading-tight">
              💡 <b>إرسال متعدد تلقائي:</b> في كل مرة يحين موعد حصة هذا الفصل، ستقوم المنصة بإرسال التذكيرات ورابط زوم ورابط الحضور تلقائياً إلى كافة المجموعات والأرقام المذكورة أعلاه.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>حفظ تعديل الفصل وربط المجموعات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


