import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Download, ExternalLink, Globe, Smartphone, MessageCircle, Edit3 } from 'lucide-react';
import { getPublishedDomain, setPublishedDomain, DEFAULT_PUBLISHED_DOMAIN } from '../utils/urlHelper';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  subtitle: string;
  onDomainChanged?: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  subtitle,
  onDomainChanged,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [domainInput, setDomainInput] = useState(getPublishedDomain());

  useEffect(() => {
    if (isOpen) {
      setDomainInput(getPublishedDomain());
      setIsEditingDomain(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      })
        .then((dataUri) => {
          setQrDataUrl(dataUri);
        })
        .catch((err) => {
          console.error('Failed to generate QR code', err);
        });
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `📢 رابط حضور الحصة المباشرة (${title} - ${subtitle})\n\nسجل حضورك بالضغط على اسمك للانتقال مباشرة إلى زوم:\n${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR_Attendance_${title.slice(0, 15).replace(/\s+/g, '_')}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleSaveDomain = () => {
    if (domainInput.trim()) {
      setPublishedDomain(domainInput.trim());
      setIsEditingDomain(false);
      if (onDomainChanged) onDomainChanged();
    }
  };

  const handleResetDefaultDomain = () => {
    setPublishedDomain('');
    const liveOrigin = getPublishedDomain();
    setDomainInput(liveOrigin);
    setIsEditingDomain(false);
    if (onDomainChanged) onDomainChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative bg-white rounded-3xl max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-100 my-auto overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="min-w-0 pr-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0 cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col items-center text-center space-y-3.5">
          {/* Universal Browser & Device Compatibility Badge */}
          <div className="w-full bg-emerald-50 border border-emerald-200/90 rounded-2xl p-2.5 flex items-center justify-between text-right text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-emerald-950 text-xs">يعمل على كافة الأجهزة والمتصفحات</p>
                <p className="text-[10px] text-emerald-700">الآيفون (Safari) والأندرويد دون الحاجة لأي حساب جيميل</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-md shrink-0">
              عام ومباشر
            </span>
          </div>

          {/* QR Code Container */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-inner flex items-center justify-center max-w-full">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-44 h-44 sm:w-56 sm:h-56 rounded-xl object-contain max-w-full aspect-square"
              />
            ) : (
              <div className="w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs">
                جاري توليد الرمز...
              </div>
            )}
          </div>

          <div>
            <p className="text-xs sm:text-sm font-black text-slate-900">
              وجّه كاميرا الهاتف نحو الرمز للدخول والتحضير
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              اعرض الرمز على الشاشة أو شارك الرابط المباشر مع الطلاب
            </p>
          </div>

          {/* Published Domain Controller */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-right">
            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span>رابط النطاق الفعلي المعتمد لحضور الطلاب:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingDomain(!isEditingDomain)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingDomain ? 'إلغاء' : 'تغيير النطاق'}</span>
              </button>
            </div>

            {isEditingDomain ? (
              <div className="space-y-1.5 mt-1.5">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dir-ltr text-left"
                />
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={handleResetDefaultDomain}
                    className="text-slate-500 hover:text-indigo-700 underline cursor-pointer font-bold"
                  >
                    استعادة رابط الموقع التلقائي
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDomain}
                    className="bg-indigo-600 text-white font-bold px-3 py-1 rounded-md hover:bg-indigo-700 cursor-pointer"
                  >
                    حفظ وتطبيق
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-indigo-900 bg-indigo-50/70 px-2 py-1 rounded-md truncate dir-ltr text-left font-semibold">
                {getPublishedDomain() || 'رابط الموقع الحالي (تلقائي)'}
              </div>
            )}
          </div>

          {/* Copyable Link Input */}
          <div className="w-full max-w-full bg-slate-50 rounded-xl border border-slate-200 p-1.5 sm:p-2 flex items-center gap-1.5 text-left dir-ltr overflow-hidden">
            <input
              type="text"
              readOnly
              value={url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full flex-1 min-w-0 bg-transparent text-[11px] sm:text-xs font-mono text-slate-600 select-all outline-none truncate px-1"
              aria-label="رابط الحضور"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط</span>
                </>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 w-full pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-1 py-2 px-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="مشاركة الرابط مع أولياء الأمور أو الطلاب عبر واتساب"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>{copiedWhatsApp ? 'جاري الفتح...' : 'واتساب'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-1 py-2 px-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>تحميل QR</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 py-2 px-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors shadow-2xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span>تجربة</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
