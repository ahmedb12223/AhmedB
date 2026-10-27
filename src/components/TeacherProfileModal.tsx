import React, { useState, useEffect } from 'react';
import { X, Check, User, BookOpen, School, Video, Plus, SwitchCamera, Search, UserCheck, KeyRound, Lock } from 'lucide-react';
import { SchoolClass, TeacherProfile } from '../types';
import { storage, isAhmedBadawi } from '../utils/storage';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeacher: TeacherProfile;
  allTeachers: TeacherProfile[];
  allClasses: SchoolClass[];
  onSaveProfile: (updated: TeacherProfile) => void;
  onSwitchTeacher: (teacherId: string) => void;
  onAddNewTeacher: (newTeacher: TeacherProfile) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  currentTeacher,
  allTeachers,
  allClasses,
  onSaveProfile,
  onSwitchTeacher,
  onAddNewTeacher,
}) => {
  const [formData, setFormData] = useState<TeacherProfile>({ ...currentTeacher });
  const [teacherPin, setTeacherPin] = useState(() => storage.getTeacherPin());
  const [activeTab, setActiveTab] = useState<'profile' | 'switch' | 'new'>('profile');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');

  const isOwner = isAhmedBadawi(currentTeacher);

  // Keep formData & PIN in sync when currentTeacher changes
  useEffect(() => {
    setFormData({ ...currentTeacher });
    setTeacherPin(storage.getTeacherPin());
  }, [currentTeacher, isOpen]);

  // New teacher form state
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');

  if (!isOpen) return null;

  const handleClassToggle = (classId: string) => {
    const assigned = new Set(formData.assignedClassIds || []);
    if (assigned.has(classId)) {
      assigned.delete(classId);
    } else {
      assigned.add(classId);
    }
    setFormData({ ...formData, assignedClassIds: Array.from(assigned) });
  };

  const handleSelectAllClasses = () => {
    setFormData({
      ...formData,
      assignedClassIds: allClasses.map((c) => c.id),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(formData);
    // Only Ahmed Badawi (Owner / Super Admin) can modify the master Teacher PIN
    if (isOwner && teacherPin.trim()) {
      storage.saveTeacherPin(teacherPin.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleCreateNewTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;

    const newTeacher: TeacherProfile = {
      id: `teacher_${Date.now()}`,
      name: newTeacherName.trim(),
      subject: newTeacherSubject.trim() || 'مدرس عام',
      email: newTeacherEmail.trim() || `teacher_${Date.now()}@school.edu`,
      schoolName: currentTeacher.schoolName,
      defaultZoomLink: '',
      assignedClassIds: allClasses.map((c) => c.id),
    };

    onAddNewTeacher(newTeacher);
    onSwitchTeacher(newTeacher.id);
    setNewTeacherName('');
    setNewTeacherSubject('');
    setNewTeacherEmail('');
    setActiveTab('profile');
    setFormData(newTeacher);
  };

  const filteredTeachers = allTeachers.filter((t) => {
    if (!teacherSearch.trim()) return true;
    const q = teacherSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">حسابات المعلمين والإعدادات</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                الحساب النشط حالياً: <b className="text-slate-800">{currentTeacher.name}</b> ({currentTeacher.subject})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 bg-white">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            تعديل بيانات {currentTeacher.name}
          </button>
          <button
            onClick={() => setActiveTab('switch')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'switch'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            <span>قائمة المعلمين المعتمدة ({allTeachers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'new'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة معلم</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم المعلم
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    المادة الدراسية (Subject)
                  </label>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    اسم المدرسة
                  </label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  رابط زوم الافتراضي للمعلم (يحفظ تلقائياً في حصصك)
                </label>
                <div className="relative dir-ltr">
                  <Video className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="url"
                    value={formData.defaultZoomLink || ''}
                    onChange={(e) => setFormData({ ...formData, defaultZoomLink: e.target.value })}
                    placeholder="https://zoom.us/j/1234567890?pwd=..."
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left"
                  />
                </div>
              </div>

              {/* Teacher PIN modification section - ONLY for Ahmed Badawi */}
              {isOwner ? (
                <div className="p-3.5 bg-gradient-to-r from-indigo-50/70 to-slate-50 rounded-xl border border-indigo-200/90 shadow-2xs">
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>رمز المرور السري للوحة التحكم (Teacher PIN)</span>
                    </span>
                    <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-100/90 px-2 py-0.5 rounded-md">
                      صلاحية حصرية لمستر أحمد بدوي
                    </span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={teacherPin}
                      onChange={(e) => setTeacherPin(e.target.value)}
                      placeholder="مثال: 123654"
                      maxLength={12}
                      className="w-full pr-9 pl-3 py-2 text-sm font-mono font-bold tracking-widest border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-indigo-950/80 mt-1.5 font-medium leading-relaxed">
                    أنت المشرف العام (مستر أحمد بدوي). يحق لك فقط تغيير كلمة سر لوحة التحكم لحمايتها من دخول الطلاب.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-500 text-xs flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[11px] leading-relaxed">
                    تعديل رمز مرور لوحة التحكم مقتصر حصرياً على لوحة تحكم المشرف العام (مستر أحمد بدوي).
                  </span>
                </div>
              )}

              {/* Assigned Classes */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    الفصول المسندة للمعلم
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllClasses}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    تحديد جميع الفصول
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  {allClasses.map((c) => {
                    const isChecked = (formData.assignedClassIds || []).includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-white border-indigo-400 shadow-2xs text-indigo-950 font-bold'
                            : 'bg-transparent border-transparent text-slate-600 hover:bg-white/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleClassToggle(c.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                    savedSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم الحفظ بنجاح</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'switch' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="بحث باسم المعلم أو المادة..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
                {filteredTeachers.map((teacher) => {
                  const isCurrent = teacher.id === currentTeacher.id;
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => {
                        onSwitchTeacher(teacher.id);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {teacher.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{teacher.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-full">
                                الحساب الحالي
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {teacher.subject}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          isCurrent
                            ? 'bg-white text-indigo-600 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isCurrent ? 'نشط الآن' : 'دخول'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleCreateNewTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم المعلم الجديد
                </label>
                <input
                  type="text"
                  required
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="مثال: مستر خالد سعيد"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  المادة الدراسية
                </label>
                <input
                  type="text"
                  required
                  value={newTeacherSubject}
                  onChange={(e) => setNewTeacherSubject(e.target.value)}
                  placeholder="مثال: العلوم (Science)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  placeholder="teacher@school.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  حفظ وتسجيل الدخول به
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
