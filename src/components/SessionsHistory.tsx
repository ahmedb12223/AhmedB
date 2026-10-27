import React, { useState } from 'react';
import {
  Video,
  Clock,
  Users,
  QrCode,
  MessageCircle,
  ExternalLink,
  Trash2,
  Plus,
  Play
} from 'lucide-react';
import { ClassSession, Student, TeacherProfile } from '../types';
import { generateWhatsAppAbsenteeReport, getTrackLabel } from '../utils/whatsappFormatter';

interface SessionsHistoryProps {
  sessions: ClassSession[];
  students: Student[];
  teacher: TeacherProfile;
  onSelectSession: (session: ClassSession) => void;
  onOpenCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const SessionsHistory: React.FC<SessionsHistoryProps> = ({
  sessions,
  students,
  teacher,
  onSelectSession,
  onOpenCreateSession,
  onDeleteSession,
}) => {
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  const teacherSessions = sessions.filter(
    (s) => s.teacherId === teacher.id
  );

  const handleCopyWhatsApp = async (session: ClassSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const targeted = students.filter((s) => {
      if (s.classId !== session.classId) return false;
      if (session.targetTrack === 'all') return true;
      return s.track === session.targetTrack;
    });

    const checkedInIds = new Set(session.attendance.filter((r) => r.studentId).map((r) => r.studentId));
    const absent = targeted.filter((s) => !checkedInIds.has(s.id));

    const text = generateWhatsAppAbsenteeReport(session, absent, teacher.name, teacher.subject);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Video className="w-6 h-6 text-indigo-600" />
            <span>حصص زوم وسجل التحضير (Sessions Archive)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جميع حصصك السابقة والجارية، وتقارير الغياب ومعدلات الحضور
          </p>
        </div>

        <button
          onClick={onOpenCreateSession}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء حصة جديدة</span>
        </button>
      </div>

      {/* Sessions Grid */}
      {teacherSessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teacherSessions.map((session) => {
            const targeted = students.filter((s) => {
              if (s.classId !== session.classId) return false;
              if (session.targetTrack === 'all') return true;
              return s.track === session.targetTrack;
            });
            const present = session.attendance.length;
            const total = targeted.length;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all p-5 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-[11px] font-bold rounded-md font-mono">
                        {session.className}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          session.targetTrack === 'english'
                            ? 'bg-blue-100 text-blue-900'
                            : session.targetTrack === 'arabic'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {getTrackLabel(session.targetTrack)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`هل أنت متأكد من حذف حصة "${session.sessionTitle}"؟`)) {
                          onDeleteSession(session.id);
                        }
                      }}
                      className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="حذف الحصة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1.5 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {session.sessionTitle}
                  </h3>

                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{session.scheduledTime || new Date(session.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                {/* Attendance stats */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600">الحضور:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {present} / {total} طالب ({rate}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, rate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={(e) => handleCopyWhatsApp(session, e)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                        copiedSessionId === session.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                      }`}
                      title="نسخ تقرير الغياب للواتساب"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>{copiedSessionId === session.id ? 'تم النسخ! ✅' : 'تقرير واتساب'}</span>
                    </button>

                    <button
                      onClick={() => onSelectSession(session)}
                      className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span>متابعة</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Video className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">
            لا توجد حصص منشأة حتى الآن
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            قم بإنشاء أول حصة دراسية لإنشاء بوابة تحضير برمز QR ورابط زوم ومشاركتها مع الطلاب فورياً.
          </p>
          <button
            onClick={onOpenCreateSession}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm"
          >
            إنشاء أول حصة الآن
          </button>
        </div>
      )}
    </div>
  );
};
