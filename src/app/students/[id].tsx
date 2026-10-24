import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Edit3,
  Award,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Trash2,
  X,
  ChevronDown,
  Check,
  TrendingUp,
  Clock,
  User,
  Hash,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';
import { Colors, Shadows } from '../../constants/theme';

type Student = {
  id: number;
  name: string;
  student_number: string;
  class_id: number;
};

type ClassInfo = {
  id: number;
  name: string;
  min_attendance_percentage: number;
};

type BehaviorLog = {
  id: number;
  points: number;
  reason: string;
  created_at: string;
};

type AttendanceRecord = {
  id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late';
  class_session_id: number;
};

type BehaviorOption = {
  label: string;
  icon: string;
  defaultPoints: number;
  description: string;
};

const POSITIVE_BEHAVIORS: BehaviorOption[] = [
  { label: 'Answered question', icon: '🙋‍♂️', defaultPoints: 1, description: 'Participated by answering questions' },
  { label: 'Helping others', icon: '🤝', defaultPoints: 2, description: 'Assisted classmates or teacher' },
  { label: 'Trying to answer question', icon: '💡', defaultPoints: 1, description: 'Showed initiative & effort to answer' },
  { label: 'Submitting assignment on time', icon: '📝', defaultPoints: 2, description: 'Turned in work promptly' },
  { label: 'Active participation', icon: '🌟', defaultPoints: 2, description: 'Highly engaged in discussions' },
  { label: 'Outstanding focus & effort', icon: '🎯', defaultPoints: 3, description: 'Exceptional concentration & work' },
  { label: 'Custom positive note...', icon: '✏️', defaultPoints: 1, description: 'Enter a custom reason' },
];

const NEGATIVE_BEHAVIORS: BehaviorOption[] = [
  { label: 'Not attending properly', icon: '🚫', defaultPoints: -1, description: 'Inattentive or late to seat' },
  { label: 'Not answering / Disengaged', icon: '🤐', defaultPoints: -1, description: 'Unresponsive or refused to answer' },
  { label: 'Misbehaving / Disruptive', icon: '⚠️', defaultPoints: -2, description: 'Disturbed the class or peers' },
  { label: 'Incomplete / Late assignment', icon: '⏳', defaultPoints: -1, description: 'Missed deadline or incomplete work' },
  { label: 'Distracted in class', icon: '📱', defaultPoints: -1, description: 'Off-task or using unauthorized items' },
  { label: 'Serious classroom disruption', icon: '🚨', defaultPoints: -3, description: 'Major rule violation' },
  { label: 'Custom incident note...', icon: '✏️', defaultPoints: -1, description: 'Enter a custom reason' },
];

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, checkingAuth } = useAuthGuard();

  const [student, setStudent] = useState<Student | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // New Behavior entry state
  const [behaviorType, setBehaviorType] = useState<'positive' | 'negative'>('positive');
  const [selectedReason, setSelectedReason] = useState<string>(POSITIVE_BEHAVIORS[0].label);
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [selectedPointsMagnitude, setSelectedPointsMagnitude] = useState<number>(1);
  const [showReasonDropdownModal, setShowReasonDropdownModal] = useState<boolean>(false);
  const [savingBehavior, setSavingBehavior] = useState(false);

  // Edit Student Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [savingStudentEdit, setSavingStudentEdit] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Attendance quick correction modal state
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<AttendanceRecord | null>(null);
  const [savingAttendanceCorrection, setSavingAttendanceCorrection] = useState(false);

  const fetchStudentData = useCallback(async () => {
    if (!id || !user) return;
    const studentId = Number(id);

    try {
      const { data: sData, error: sError } = await supabase
        .from('students')
        .select('id, name, student_number, class_id')
        .eq('id', studentId)
        .single();

      if (sError || !sData) {
        setStudent(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: cData, error: cError } = await supabase
        .from('classes')
        .select('id, name, min_attendance_percentage, teacher_id')
        .eq('id', sData.class_id)
        .single();

      if (cError || !cData || cData.teacher_id !== user.id) {
        setAccessDenied(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAccessDenied(false);
      setStudent(sData);
      setClassInfo(cData);
      setEditName(sData.name);
      setEditNumber(sData.student_number);

      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('id, attendance_date, status, class_session_id')
        .eq('student_id', studentId)
        .order('attendance_date', { ascending: false });

      if (!attError && attData) {
        setAttendanceRecords(attData);
      }

      const { data: logsData, error: logsError } = await supabase
        .from('behavior_logs')
        .select('id, points, reason, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (!logsError && logsData) {
        setBehaviorLogs(logsData);
      }
    } catch (err) {
      console.error('Unexpected error loading student details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (user && id) {
      fetchStudentData();
    }
  }, [user, id, fetchStudentData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudentData();
  }, [fetchStudentData]);

  function handleSwitchBehaviorType(type: 'positive' | 'negative') {
    setBehaviorType(type);
    if (type === 'positive') {
      setSelectedReason(POSITIVE_BEHAVIORS[0].label);
      setSelectedPointsMagnitude(1);
    } else {
      setSelectedReason(NEGATIVE_BEHAVIORS[0].label);
      setSelectedPointsMagnitude(1);
    }
    setCustomReasonText('');
  }

  function handleSelectReason(reasonOption: BehaviorOption) {
    setSelectedReason(reasonOption.label);
    setSelectedPointsMagnitude(Math.abs(reasonOption.defaultPoints));
    setShowReasonDropdownModal(false);
    if (!reasonOption.label.includes('Custom')) {
      setCustomReasonText('');
    }
  }

  const finalCalculatedPoints =
    behaviorType === 'positive'
      ? selectedPointsMagnitude
      : -selectedPointsMagnitude;

  const isCustomReason = selectedReason.includes('Custom');
  const finalReasonToSave = isCustomReason
    ? customReasonText.trim()
    : selectedReason;

  async function handleRecordBehavior() {
    if (!finalReasonToSave) {
      Alert.alert(
        'Missing Reason',
        isCustomReason
          ? 'Please enter your custom incident note.'
          : 'Please select a behavior reason from the dropdown.'
      );
      return;
    }

    if (!user) {
      Alert.alert('Session Expired', 'Please log in again.');
      router.replace('/login');
      return;
    }

    setSavingBehavior(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase.from('behavior_logs').insert({
        student_id: student!.id,
        teacher_id: user.id,
        points: finalCalculatedPoints,
        reason: finalReasonToSave,
      });

      if (error) throw error;

      setCustomReasonText('');

      const { data: logsData } = await supabase
        .from('behavior_logs')
        .select('id, points, reason, created_at')
        .eq('student_id', student!.id)
        .order('created_at', { ascending: false });

      setBehaviorLogs(logsData ?? []);
      Alert.alert(
        'Behavior Recorded',
        `Awarded ${finalCalculatedPoints > 0 ? `+${finalCalculatedPoints}` : finalCalculatedPoints} points for "${finalReasonToSave}".`
      );
    } catch (err: unknown) {
      console.error('Error saving behavior:', err);
      const msg = err instanceof Error ? err.message : 'Could not save behavior.';
      Alert.alert('Error', msg);
    } finally {
      setSavingBehavior(false);
    }
  }

  async function handleUpdateStudent() {
    const trimmedName = editName.trim();
    const trimmedNumber = editNumber.trim().toUpperCase();

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Validation Error', 'Student name must be at least 2 characters.');
      return;
    }

    if (!trimmedNumber) {
      Alert.alert('Validation Error', 'Student number cannot be empty.');
      return;
    }

    setSavingStudentEdit(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: trimmedName,
          student_number: trimmedNumber,
        })
        .eq('id', student!.id);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Duplicate Error', `Student number "${trimmedNumber}" is already in use.`);
        } else {
          Alert.alert('Update Failed', error.message);
        }
        return;
      }

      setStudent((prev) => (prev ? { ...prev, name: trimmedName, student_number: trimmedNumber } : null));
      setShowEditModal(false);
      Alert.alert('Success', 'Student details updated.');
    } catch (err: unknown) {
      console.error('Error updating student:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update student.';
      Alert.alert('Error', msg);
    } finally {
      setSavingStudentEdit(false);
    }
  }

  function confirmDeleteStudent() {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to remove "${student?.name}"?\n\nThis will permanently delete this student, their attendance history, and behavior records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: handleDeleteStudent,
        },
      ]
    );
  }

  async function handleDeleteStudent() {
    if (!student) return;
    setDeletingStudent(true);

    try {
      await supabase.from('behavior_logs').delete().eq('student_id', student.id);
      await supabase.from('attendance').delete().eq('student_id', student.id);
      const { error } = await supabase.from('students').delete().eq('id', student.id);

      if (error) throw error;

      Alert.alert('Deleted', 'Student has been removed.');
      router.back();
    } catch (err: unknown) {
      console.error('Error deleting student:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete student.';
      Alert.alert('Deletion Error', msg);
    } finally {
      setDeletingStudent(false);
    }
  }

  async function handleCorrectAttendanceStatus(newStatus: 'present' | 'absent' | 'late') {
    if (!selectedRecordToEdit) return;
    setSavingAttendanceCorrection(true);

    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus })
        .eq('id', selectedRecordToEdit.id);

      if (error) throw error;

      setAttendanceRecords((prev) =>
        prev.map((rec) =>
          rec.id === selectedRecordToEdit.id ? { ...rec, status: newStatus } : rec
        )
      );

      setSelectedRecordToEdit(null);
      Alert.alert('Success', `Attendance for ${selectedRecordToEdit.attendance_date} updated to ${newStatus}.`);
    } catch (err: unknown) {
      console.error('Error correcting attendance:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update attendance.';
      Alert.alert('Error', msg);
    } finally {
      setSavingAttendanceCorrection(false);
    }
  }

  if (checkingAuth || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading student profile...</Text>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>🔒 Access Denied</Text>
        <Text style={styles.message}>You do not have permission to view this student.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!student) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Student not found.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalBehaviorPoints = behaviorLogs.reduce((acc, log) => acc + log.points, 0);
  const positiveEventsCount = behaviorLogs.filter((log) => log.points > 0).length;
  const negativeEventsCount = behaviorLogs.filter((log) => log.points < 0).length;

  let behaviorStatus = 'Neutral Standing';
  let behaviorStatusColor = Colors.textTertiary;
  if (totalBehaviorPoints >= 5) {
    behaviorStatus = 'Consistently Positive';
    behaviorStatusColor = Colors.tealDark;
  } else if (totalBehaviorPoints < 0) {
    behaviorStatus = 'Needs Guidance';
    behaviorStatusColor = Colors.errorDark;
  }

  const minRequiredAttendance = classInfo?.min_attendance_percentage ?? 75;
  const totalAttendanceSessions = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
  const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
  const lateCount = attendanceRecords.filter((r) => r.status === 'late').length;

  const attendancePercentage =
    totalAttendanceSessions > 0
      ? Math.round((presentCount / totalAttendanceSessions) * 100)
      : null;

  const isEligible =
    attendancePercentage !== null ? attendancePercentage >= minRequiredAttendance : true;

  const currentReasonList =
    behaviorType === 'positive' ? POSITIVE_BEHAVIORS : NEGATIVE_BEHAVIORS;

  const currentSelectedOption =
    currentReasonList.find((opt) => opt.label === selectedReason) || currentReasonList[0];

  const studentInitial = (student.name.charAt(0) || 'S').toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 30, 60) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Top Bar with circular back button and edit pill */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity
              style={styles.backCircleBtn}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <ArrowLeft size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>Student Profile</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>{classInfo?.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.editPillBtn}
              activeOpacity={0.8}
              onPress={() => setShowEditModal(true)}
            >
              <Edit3 size={14} color={Colors.textPrimary} />
              <Text style={styles.editPillText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* 1. Student Hero Profile Card */}
          <View style={styles.profileHeroCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitialText}>{studentInitial}</Text>
              <View style={styles.verifiedDot}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <Text style={styles.heroStudentName} numberOfLines={1}>
              {student.name}
            </Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>ROLL ID #{student.student_number}</Text>
              </View>
              {classInfo && (
                <View style={styles.classBadge}>
                  <Text style={styles.classBadgeText}>{classInfo.name}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. ATTENDANCE OVERVIEW CARD */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardPreTitle}>ATTENDANCE STANDING</Text>
                <Text style={styles.cardMainTitle}>Attendance Overview</Text>
              </View>
              {attendancePercentage !== null && (
                <View
                  style={[
                    styles.standingPill,
                    isEligible ? styles.standingPillPass : styles.standingPillFail,
                  ]}
                >
                  <Text
                    style={[
                      styles.standingPillText,
                      isEligible ? styles.standingTextPass : styles.standingTextFail,
                    ]}
                  >
                    {isEligible ? 'Target Met' : `At Risk (<${minRequiredAttendance}%)`}
                  </Text>
                </View>
              )}
            </View>

            {attendancePercentage !== null && !isEligible && (
              <View style={styles.alertBanner}>
                <AlertCircle size={16} color={Colors.error} style={{ marginRight: 8 }} />
                <Text style={styles.alertBannerText}>
                  Attendance ({attendancePercentage}%) has dropped below the {minRequiredAttendance}% requirement.
                </Text>
              </View>
            )}

            {/* Metrics 4-Box Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>ATTENDANCE</Text>
                <Text
                  style={[
                    styles.metricValue,
                    attendancePercentage !== null && {
                      color: isEligible ? Colors.tealDark : Colors.errorDark,
                    },
                  ]}
                >
                  {attendancePercentage !== null ? `${attendancePercentage}%` : 'N/A'}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>PRESENT</Text>
                <Text style={[styles.metricValue, { color: Colors.tealDark }]}>{presentCount}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>ABSENT</Text>
                <Text style={[styles.metricValue, { color: Colors.errorDark }]}>{absentCount}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>LATE</Text>
                <Text style={[styles.metricValue, { color: Colors.goldDark }]}>{lateCount}</Text>
              </View>
            </View>

            {/* Attendance History Section */}
            <View style={styles.subHeaderRow}>
              <Text style={styles.subSectionTitle}>Attendance Sessions ({totalAttendanceSessions})</Text>
              <Text style={styles.subSectionHint}>Tap date to correct</Text>
            </View>

            {attendanceRecords.length === 0 ? (
              <Text style={styles.emptyNote}>No attendance recorded yet for this student.</Text>
            ) : (
              attendanceRecords.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  style={styles.historyRow}
                  activeOpacity={0.75}
                  onPress={() => setSelectedRecordToEdit(record)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color={Colors.textTertiary} />
                    <Text style={styles.historyDate}>{record.attendance_date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={[
                        styles.statusPill,
                        record.status === 'present'
                          ? styles.statusPillPresent
                          : record.status === 'absent'
                          ? styles.statusPillAbsent
                          : styles.statusPillLate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          record.status === 'present'
                            ? styles.statusTextPresent
                            : record.status === 'absent'
                            ? styles.statusTextAbsent
                            : styles.statusTextLate,
                        ]}
                      >
                        {record.status.toUpperCase()}
                      </Text>
                    </View>
                    <Edit3 size={13} color={Colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* 3. BEHAVIOR INTELLIGENCE & DROPDOWN LOGGING */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardPreTitle}>BEHAVIOR INTELLIGENCE</Text>
                <Text style={styles.cardMainTitle}>Behavior Summary</Text>
              </View>
              <View
                style={[
                  styles.standingPill,
                  { backgroundColor: totalBehaviorPoints >= 0 ? Colors.tealLight : Colors.errorLight },
                ]}
              >
                <Text style={[styles.standingPillText, { color: behaviorStatusColor }]}>
                  {behaviorStatus}
                </Text>
              </View>
            </View>

            {/* Behavior 3-Box Stats Row */}
            <View style={styles.behaviorMetricsRow}>
              <View style={styles.behaviorMetricBox}>
                <Text style={styles.behaviorMetricLabel}>NET SCORE</Text>
                <Text
                  style={[
                    styles.behaviorMetricValue,
                    { color: totalBehaviorPoints >= 0 ? Colors.tealDark : Colors.errorDark },
                  ]}
                >
                  {totalBehaviorPoints > 0 ? `+${totalBehaviorPoints}` : totalBehaviorPoints}
                </Text>
              </View>
              <View style={styles.behaviorMetricBox}>
                <Text style={styles.behaviorMetricLabel}>POSITIVE ACTIONS</Text>
                <Text style={[styles.behaviorMetricValue, { color: Colors.tealDark }]}>
                  {positiveEventsCount}
                </Text>
              </View>
              <View style={styles.behaviorMetricBox}>
                <Text style={styles.behaviorMetricLabel}>NEEDS SUPPORT</Text>
                <Text style={[styles.behaviorMetricValue, { color: Colors.errorDark }]}>
                  {negativeEventsCount}
                </Text>
              </View>
            </View>

            {/* RECORD NEW BEHAVIOR SECTION */}
            <View style={styles.recordBehaviorBox}>
              <Text style={styles.recordBoxTitle}>Record Classroom Behavior</Text>

              {/* 1. Positive vs Needs Support Segmented Tabs */}
              <View style={styles.segmentedContainer}>
                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    behaviorType === 'positive' && styles.segmentedTabPositiveActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSwitchBehaviorType('positive')}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      behaviorType === 'positive' && styles.segmentedTabTextPositiveActive,
                    ]}
                  >
                    👍 Positive Reward
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    behaviorType === 'negative' && styles.segmentedTabNegativeActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSwitchBehaviorType('negative')}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      behaviorType === 'negative' && styles.segmentedTabTextNegativeActive,
                    ]}
                  >
                    ⚠️ Needs Guidance
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 2. Dropdown Reason Selector Trigger */}
              <Text style={styles.formInputLabel}>SELECT BEHAVIOR REASON</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                activeOpacity={0.85}
                onPress={() => setShowReasonDropdownModal(true)}
              >
                <View style={styles.dropdownLeft}>
                  <Text style={styles.dropdownIcon}>{currentSelectedOption.icon}</Text>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.dropdownLabelText} numberOfLines={1}>
                      {selectedReason}
                    </Text>
                    <Text style={styles.dropdownDescText} numberOfLines={1}>
                      {currentSelectedOption.description}
                    </Text>
                  </View>
                </View>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>

              {/* Custom Note input if chosen */}
              {isCustomReason && (
                <View style={styles.customInputBox}>
                  <Text style={styles.customInputLabel}>ENTER CUSTOM NOTE</Text>
                  <TextInput
                    style={styles.customInputField}
                    placeholder="e.g. Organized classroom library after session"
                    placeholderTextColor={Colors.textMuted}
                    value={customReasonText}
                    onChangeText={setCustomReasonText}
                    editable={!savingBehavior}
                  />
                </View>
              )}

              {/* 3. Point Value Score Chips (1, 2, or 3) */}
              <Text style={styles.formInputLabel}>
                SELECT SCORE ({behaviorType === 'positive' ? '+ ADD POINTS' : '- DEDUCT POINTS'})
              </Text>
              <View style={styles.scoreChipsRow}>
                {[1, 2, 3].map((num) => {
                  const isSelected = selectedPointsMagnitude === num;
                  const displayPoints = behaviorType === 'positive' ? `+${num}` : `-${num}`;
                  const scoreLabel =
                    behaviorType === 'positive'
                      ? num === 1
                        ? 'Good (+1)'
                        : num === 2
                        ? 'Great (+2)'
                        : 'Outstanding (+3)'
                      : num === 1
                      ? 'Minor (-1)'
                      : num === 2
                      ? 'Moderate (-2)'
                      : 'Severe (-3)';

                  return (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scoreChip,
                        isSelected &&
                          (behaviorType === 'positive'
                            ? styles.scoreChipPositiveSelected
                            : styles.scoreChipNegativeSelected),
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedPointsMagnitude(num)}
                    >
                      <Text
                        style={[
                          styles.scoreChipPoints,
                          isSelected && styles.scoreChipPointsSelected,
                        ]}
                      >
                        {displayPoints}
                      </Text>
                      <Text
                        style={[
                          styles.scoreChipLabel,
                          isSelected && styles.scoreChipLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {scoreLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 4. Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, savingBehavior && styles.disabledButton]}
                activeOpacity={0.85}
                onPress={handleRecordBehavior}
                disabled={savingBehavior}
              >
                {savingBehavior ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>
                      {behaviorType === 'positive'
                        ? `Award +${selectedPointsMagnitude} Points`
                        : `Deduct -${selectedPointsMagnitude} Points`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Behavior Logs Stream */}
            <View style={styles.subHeaderRow}>
              <Text style={styles.subSectionTitle}>Incident History ({behaviorLogs.length})</Text>
            </View>

            {behaviorLogs.length === 0 ? (
              <Text style={styles.emptyNote}>No behavior entries recorded yet.</Text>
            ) : (
              behaviorLogs.map((log) => (
                <View key={log.id} style={styles.behaviorLogRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.behaviorLogReason} numberOfLines={2}>
                      {log.reason}
                    </Text>
                    <Text style={styles.behaviorLogDate}>
                      {new Date(log.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.logPointsBadge,
                      {
                        backgroundColor: log.points > 0 ? Colors.tealLight : Colors.errorLight,
                        borderColor: log.points > 0 ? '#99F6E4' : '#FECACA',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.logPointsText,
                        { color: log.points > 0 ? Colors.tealDark : Colors.errorDark },
                      ]}
                    >
                      {log.points > 0 ? `+${log.points}` : log.points}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* 4. Student Management Section */}
          <View style={styles.managementCard}>
            <Text style={styles.managementTitle}>STUDENT ACTIONS</Text>
            <TouchableOpacity
              style={[styles.deleteStudentBtn, deletingStudent && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={confirmDeleteStudent}
              disabled={deletingStudent}
            >
              <Trash2 size={15} color={Colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.deleteStudentBtnText}>
                {deletingStudent ? 'Removing Student...' : 'Remove Student from Class'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* REASON DROPDOWN MODAL */}
          <Modal
            visible={showReasonDropdownModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowReasonDropdownModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.dropdownModalContent}>
                <View style={styles.dropdownModalHeader}>
                  <Text style={styles.dropdownModalTitle}>
                    {behaviorType === 'positive' ? 'Select Positive Reward' : 'Select Guidance Area'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowReasonDropdownModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                  {currentReasonList.map((item) => {
                    const isSelected = selectedReason === item.label;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[
                          styles.dropdownOptionRow,
                          isSelected && styles.dropdownOptionRowSelected,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => handleSelectReason(item)}
                      >
                        <Text style={styles.dropdownOptionIcon}>{item.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.dropdownOptionLabel,
                              isSelected && styles.dropdownOptionLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text style={styles.dropdownOptionDesc}>
                            {item.description}
                          </Text>
                        </View>
                        {isSelected && (
                          <Check size={18} color={Colors.primary} strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* EDIT STUDENT MODAL */}
          <Modal
            visible={showEditModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowEditModal(false)}
          >
            <KeyboardAvoidingView
              style={styles.modalOverlay}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.editModalContent}>
                  <View style={styles.dropdownModalHeader}>
                    <Text style={styles.dropdownModalTitle}>Edit Student</Text>
                    <TouchableOpacity
                      onPress={() => setShowEditModal(false)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={20} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formInputLabel}>STUDENT NAME</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="e.g. Alex Morgan"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="words"
                    editable={!savingStudentEdit}
                  />

                  <Text style={styles.formInputLabel}>STUDENT NUMBER / ROLL ID</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editNumber}
                    onChangeText={setEditNumber}
                    placeholder="e.g. STU-001"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                    editable={!savingStudentEdit}
                  />

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => setShowEditModal(false)}
                      disabled={savingStudentEdit}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSaveButton, savingStudentEdit && styles.disabledButton]}
                      onPress={handleUpdateStudent}
                      disabled={savingStudentEdit}
                    >
                      <Text style={styles.modalSaveText}>
                        {savingStudentEdit ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>

          {/* ATTENDANCE CORRECTION MODAL */}
          <Modal
            visible={selectedRecordToEdit !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedRecordToEdit(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.editModalContent}>
                <View style={styles.dropdownModalHeader}>
                  <Text style={styles.dropdownModalTitle}>Correct Attendance</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedRecordToEdit(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>
                  Session Date: {selectedRecordToEdit?.attendance_date}
                </Text>

                <Text style={styles.formInputLabel}>SELECT STATUS</Text>
                <View style={styles.correctionButtonGrid}>
                  <TouchableOpacity
                    style={[
                      styles.correctStatusOption,
                      selectedRecordToEdit?.status === 'present' && styles.correctSelectedPresent,
                    ]}
                    onPress={() => handleCorrectAttendanceStatus('present')}
                    disabled={savingAttendanceCorrection}
                  >
                    <Text
                      style={[
                        styles.correctStatusText,
                        selectedRecordToEdit?.status === 'present' && styles.correctSelectedText,
                      ]}
                    >
                      ✓ Present
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.correctStatusOption,
                      selectedRecordToEdit?.status === 'absent' && styles.correctSelectedAbsent,
                    ]}
                    onPress={() => handleCorrectAttendanceStatus('absent')}
                    disabled={savingAttendanceCorrection}
                  >
                    <Text
                      style={[
                        styles.correctStatusText,
                        selectedRecordToEdit?.status === 'absent' && styles.correctSelectedText,
                      ]}
                    >
                      ✗ Absent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.correctStatusOption,
                      selectedRecordToEdit?.status === 'late' && styles.correctSelectedLate,
                    ]}
                    onPress={() => handleCorrectAttendanceStatus('late')}
                    disabled={savingAttendanceCorrection}
                  >
                    <Text
                      style={[
                        styles.correctStatusText,
                        selectedRecordToEdit?.status === 'late' && styles.correctSelectedText,
                      ]}
                    >
                      ⏱️ Late
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setSelectedRecordToEdit(null)}
                  disabled={savingAttendanceCorrection}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.error,
  },
  message: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 16,
  },
  backCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...Shadows.small,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profileHeroCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    ...Shadows.medium,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    position: 'relative',
  },
  avatarInitialText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: Colors.teal,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  heroStudentName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  idBadge: {
    backgroundColor: Colors.background,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  classBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardContainer: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    ...Shadows.small,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
  },
  cardMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  standingPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  standingPillPass: {
    backgroundColor: Colors.tealLight,
  },
  standingPillFail: {
    backgroundColor: Colors.errorLight,
  },
  standingPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  standingTextPass: {
    color: Colors.tealDark,
  },
  standingTextFail: {
    color: Colors.errorDark,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.errorDark,
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  subSectionHint: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyNote: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillPresent: {
    backgroundColor: Colors.tealLight,
  },
  statusPillAbsent: {
    backgroundColor: Colors.errorLight,
  },
  statusPillLate: {
    backgroundColor: Colors.goldLight,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPresent: {
    color: Colors.tealDark,
  },
  statusTextAbsent: {
    color: Colors.errorDark,
  },
  statusTextLate: {
    color: Colors.goldDark,
  },
  behaviorMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  behaviorMetricBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  behaviorMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  behaviorMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  recordBehaviorBox: {
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  recordBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentedTabPositiveActive: {
    backgroundColor: Colors.tealDark,
  },
  segmentedTabNegativeActive: {
    backgroundColor: Colors.errorDark,
  },
  segmentedTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  segmentedTabTextPositiveActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  segmentedTabTextNegativeActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  formInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  dropdownLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  dropdownDescText: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  customInputBox: {
    marginBottom: 14,
  },
  customInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  customInputField: {
    height: 48,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  scoreChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  scoreChip: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreChipPositiveSelected: {
    backgroundColor: Colors.tealLight,
    borderColor: Colors.teal,
  },
  scoreChipNegativeSelected: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  scoreChipPoints: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  scoreChipPointsSelected: {
    color: Colors.primary,
  },
  scoreChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  scoreChipLabelSelected: {
    color: Colors.primary,
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    ...Shadows.small,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  behaviorLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  behaviorLogReason: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  behaviorLogDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  logPointsBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  logPointsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  managementCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    ...Shadows.small,
  },
  managementTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  deleteStudentBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 12,
  },
  deleteStudentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.errorDark,
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.large,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dropdownModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownOptionRowSelected: {
    backgroundColor: Colors.background,
  },
  dropdownOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  dropdownOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dropdownOptionLabelSelected: {
    fontWeight: '800',
    color: Colors.primary,
  },
  dropdownOptionDesc: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  editModalContent: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.large,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 16,
  },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.background,
    marginBottom: 16,
    color: Colors.textPrimary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  modalSaveButton: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  correctionButtonGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  correctStatusOption: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  correctSelectedPresent: {
    backgroundColor: Colors.tealDark,
    borderColor: Colors.tealDark,
  },
  correctSelectedAbsent: {
    backgroundColor: Colors.errorDark,
    borderColor: Colors.errorDark,
  },
  correctSelectedLate: {
    backgroundColor: Colors.goldDark,
    borderColor: Colors.goldDark,
  },
  correctStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  correctSelectedText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
