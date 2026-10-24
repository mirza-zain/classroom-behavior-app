import { useCallback, useState } from 'react';
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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Edit3,
  CalendarCheck,
  CheckCircle2,
  UserPlus,
  Users,
  Award,
  AlertCircle,
  Trash2,
  ChevronRight,
  X,
  TrendingUp,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';
import { Colors, Shadows } from '../../constants/theme';

type ClassItem = {
  id: number;
  name: string;
  teacher_id: string;
  min_attendance_percentage: number;
};

type Student = {
  id: number;
  name: string;
  student_number: string;
};

type AttendanceStat = {
  student_id: number;
  student_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number | string;
};

type FilterType = 'all' | 'at_risk' | 'eligible';

export default function ClassDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, checkingAuth } = useAuthGuard();

  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
  const [studentBehaviorPoints, setStudentBehaviorPoints] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Edit Class Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [editMinAttendance, setEditMinAttendance] = useState('75');
  const [savingClassEdit, setSavingClassEdit] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);

  // Filter state for eligibility
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchClassData = useCallback(async () => {
    if (!id || !user) return;

    try {
      const classId = Number(id);
      if (isNaN(classId) || classId <= 0) {
        Alert.alert('Invalid ID', 'Class ID is invalid.');
        router.replace('/(tabs)/classes');
        return;
      }

      // 1. Fetch class and verify teacher ownership
      const { data: clsData, error: clsError } = await supabase
        .from('classes')
        .select('id, name, teacher_id, min_attendance_percentage')
        .eq('id', classId)
        .single();

      if (clsError || !clsData) {
        console.error('Error fetching class:', clsError);
        setClassItem(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (clsData.teacher_id !== user.id) {
        setAccessDenied(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAccessDenied(false);
      setClassItem(clsData);
      setEditClassName(clsData.name);
      setEditMinAttendance(String(clsData.min_attendance_percentage ?? 75));

      // 2. Fetch students for this class
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, student_number')
        .eq('class_id', classId)
        .order('name', { ascending: true });

      if (studentError) {
        console.error('Error fetching students:', studentError.message);
      }
      const fetchedStudents = studentData ?? [];
      setStudents(fetchedStudents);

      // 3. Fetch attendance statistics
      let stats: AttendanceStat[] = [];
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_class_attendance_stats', {
          p_class_id: classId,
        });

      if (statsError) {
        // Fallback: fetch attendance table directly
        if (fetchedStudents.length > 0) {
          const studentIds = fetchedStudents.map((s) => s.id);
          const { data: attData } = await supabase
            .from('attendance')
            .select('student_id, status')
            .in('student_id', studentIds);

          const studentMap: Record<number, { total: number; present: number; absent: number; late: number }> = {};
          fetchedStudents.forEach((s) => {
            studentMap[s.id] = { total: 0, present: 0, absent: 0, late: 0 };
          });

          attData?.forEach((rec) => {
            if (studentMap[rec.student_id]) {
              studentMap[rec.student_id].total += 1;
              if (rec.status === 'present') studentMap[rec.student_id].present += 1;
              else if (rec.status === 'absent') studentMap[rec.student_id].absent += 1;
              else if (rec.status === 'late') studentMap[rec.student_id].late += 1;
            }
          });

          stats = fetchedStudents.map((s) => {
            const counts = studentMap[s.id];
            const pct = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;
            return {
              student_id: s.id,
              student_name: s.name,
              total_sessions: counts.total,
              present_count: counts.present,
              absent_count: counts.absent,
              late_count: counts.late,
              attendance_percentage: pct,
            };
          });
        }
      } else {
        stats = statsData ?? [];
      }
      setAttendanceStats(stats);

      // 4. Fetch behavior summary for all students in this class
      if (fetchedStudents.length > 0) {
        const studentIds = fetchedStudents.map((s) => s.id);
        const { data: behaviorData, error: behaviorError } = await supabase
          .from('behavior_logs')
          .select('student_id, points')
          .in('student_id', studentIds);

        if (!behaviorError && behaviorData) {
          const pointsMap: Record<number, number> = {};
          behaviorData.forEach((log) => {
            pointsMap[log.student_id] = (pointsMap[log.student_id] || 0) + log.points;
          });
          setStudentBehaviorPoints(pointsMap);
        }
      } else {
        setStudentBehaviorPoints({});
      }
    } catch (err) {
      console.error('Unexpected error loading class details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user, router]);

  useFocusEffect(
    useCallback(() => {
      if (user && id) {
        fetchClassData();
      }
    }, [user, id, fetchClassData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClassData();
  }, [fetchClassData]);

  // Record Today's Session
  async function recordClassSession() {
    if (!id || !classItem) return;
    try {
      const today = new Date();
      const sessionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const { data: existingSession, error: checkError } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('class_id', Number(id))
        .eq('session_date', sessionDate)
        .maybeSingle();

      if (checkError) {
        Alert.alert('Error', checkError.message);
        return;
      }

      if (existingSession) {
        Alert.alert(
          "Session Already Recorded",
          `Today's session (${sessionDate}) has already been recorded. Would you like to mark or update attendance now?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Mark Attendance',
              onPress: () =>
                router.push({
                  pathname: '/classes/[id]/attendance',
                  params: { id: String(id) },
                }),
            },
          ]
        );
        return;
      }

      const { error } = await supabase.from('class_sessions').insert({
        class_id: Number(id),
        session_date: sessionDate,
        status: 'conducted',
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Notice', "Today's class session is already recorded.");
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }

      Alert.alert(
        'Success',
        `Class session for ${sessionDate} recorded. Now mark attendance for your students!`,
        [
          { text: 'Later', onPress: () => fetchClassData() },
          {
            text: 'Mark Now',
            onPress: () => {
              fetchClassData();
              router.push({
                pathname: '/classes/[id]/attendance',
                params: { id: String(id) },
              });
            },
          },
        ]
      );
    } catch (err) {
      console.error('Session record error:', err);
      Alert.alert('Error', 'Failed to record session.');
    }
  }

  // Edit Class Name & Min Attendance Percentage
  async function handleUpdateClass() {
    const trimmedName = editClassName.trim();
    const minPct = Number(editMinAttendance);

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Validation Error', 'Please enter a valid class name (at least 2 characters).');
      return;
    }

    if (isNaN(minPct) || !Number.isInteger(minPct) || minPct < 1 || minPct > 100) {
      Alert.alert('Validation Error', 'Minimum attendance must be a whole number between 1 and 100.');
      return;
    }

    setSavingClassEdit(true);
    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: trimmedName,
          min_attendance_percentage: minPct,
        })
        .eq('id', Number(id))
        .eq('teacher_id', user!.id);

      if (error) {
        Alert.alert('Update Failed', error.message);
        return;
      }

      setClassItem((prev) => (prev ? { ...prev, name: trimmedName, min_attendance_percentage: minPct } : null));
      setShowEditModal(false);
      Alert.alert('Success', 'Class details updated successfully.');
      fetchClassData();
    } catch (err) {
      console.error('Error updating class:', err);
      Alert.alert('Error', 'Failed to update class details.');
    } finally {
      setSavingClassEdit(false);
    }
  }

  // Safe Class Deletion
  function confirmDeleteClass() {
    Alert.alert(
      'Delete Class',
      `Are you sure you want to delete "${classItem?.name}"?\n\nThis will permanently delete this class, all enrolled students, attendance sessions, and behavior records. This action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: handleDeleteClass,
        },
      ]
    );
  }

  async function handleDeleteClass() {
    if (!classItem || !user) return;
    setDeletingClass(true);

    try {
      const classId = classItem.id;
      const studentIds = students.map((s) => s.id);

      if (studentIds.length > 0) {
        await supabase.from('behavior_logs').delete().in('student_id', studentIds);
        await supabase.from('attendance').delete().in('student_id', studentIds);
        await supabase.from('students').delete().eq('class_id', classId);
      }

      await supabase.from('class_sessions').delete().eq('class_id', classId);

      const { error: deleteError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('teacher_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      Alert.alert('Class Deleted', 'The class and all related records have been deleted.');
      router.replace('/(tabs)/classes');
    } catch (err: unknown) {
      console.error('Error deleting class:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete class.';
      Alert.alert('Deletion Error', msg);
    } finally {
      setDeletingClass(false);
    }
  }

  if (checkingAuth || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading class...</Text>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>🔒 Access Denied</Text>
        <Text style={styles.message}>You do not have permission to view or manage this class.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/classes')}>
          <Text style={styles.buttonText}>Back to My Classes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!classItem) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Class not found.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/classes')}>
          <Text style={styles.buttonText}>Back to My Classes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Attendance metrics calculation
  const minRequired = classItem.min_attendance_percentage ?? 75;
  const totalEnrolled = students.length;

  let totalPresentTally = 0;
  let totalAbsentTally = 0;
  let totalLateTally = 0;
  let totalRecordTally = 0;
  let eligibleCount = 0;
  let ineligibleCount = 0;

  attendanceStats.forEach((stat) => {
    totalPresentTally += stat.present_count;
    totalAbsentTally += stat.absent_count;
    totalLateTally += stat.late_count;
    totalRecordTally += stat.total_sessions;

    const pct = Number(stat.attendance_percentage);
    if (stat.total_sessions > 0) {
      if (pct >= minRequired) {
        eligibleCount++;
      } else {
        ineligibleCount++;
      }
    }
  });

  const overallClassAttendancePct =
    totalRecordTally > 0
      ? Math.round((totalPresentTally / totalRecordTally) * 100)
      : null;

  // Filter students based on eligibility tab
  const filteredStudents = students.filter((student) => {
    if (filter === 'all') return true;
    const stat = attendanceStats.find((s) => s.student_id === student.id);
    if (!stat || stat.total_sessions === 0) return false;
    const pct = Number(stat.attendance_percentage);
    if (filter === 'at_risk') return pct < minRequired;
    if (filter === 'eligible') return pct >= minRequired;
    return true;
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 48) }}
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
        {/* 1. Header with back button, title, and quick edit pill */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.backCircleBtn}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={styles.headerClassTitle} numberOfLines={1}>
              {classItem.name}
            </Text>
            <Text style={styles.headerClassMeta}>
              TARGET: {minRequired}% MIN ATTENDANCE
            </Text>
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

        {/* 2. Hero Card: Modeled on Asaan Taqreeb Gross Earnings Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <TrendingUp size={16} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.heroPreTitle}>CLASS ATTENDANCE PERFORMANCE</Text>
          </View>

          <View style={styles.heroMetricRow}>
            <Text style={styles.heroMetricValue}>
              {overallClassAttendancePct !== null ? `${overallClassAttendancePct}%` : 'N/A'}
            </Text>
            <Text style={styles.heroMetricUnit}>Overall Class Average</Text>
          </View>

          <View style={styles.heroBreakdownRow}>
            <View>
              <Text style={styles.heroBreakdownLabel}>ENROLLED</Text>
              <Text style={styles.heroBreakdownValue}>{totalEnrolled} Students</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.heroBreakdownLabel}>PRESENT</Text>
              <Text style={[styles.heroBreakdownValue, { color: Colors.tealLight }]}>
                {totalPresentTally}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroBreakdownLabel}>ABSENT</Text>
              <Text style={[styles.heroBreakdownValue, { color: '#FCA5A5' }]}>
                {totalAbsentTally}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Action Buttons Row */}
        <View style={styles.actionButtonGroup}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/classes/[id]/attendance',
                params: { id: String(id) },
              })
            }
          >
            <CheckCircle2 size={15} color="#FFFFFF" />
            <Text style={styles.actionBtnPrimaryText}>Take Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            activeOpacity={0.85}
            onPress={recordClassSession}
          >
            <CalendarCheck size={15} color={Colors.textPrimary} />
            <Text style={styles.actionBtnSecondaryText}>Record Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/classes/[id]/add-student',
                params: { id: String(id) },
              })
            }
          >
            <UserPlus size={15} color={Colors.textPrimary} />
            <Text style={styles.actionBtnSecondaryText}>Add Student</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Actionable Alert Banner (if any at-risk students) */}
        {ineligibleCount > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIconCircle}>
              <AlertCircle size={18} color={Colors.error} />
            </View>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <Text style={styles.alertBannerTitle}>Attendance Watchlist</Text>
              <Text style={styles.alertBannerText}>
                {ineligibleCount} student{ineligibleCount > 1 ? 's are' : ' is'} below the {minRequired}% target.
              </Text>
            </View>
          </View>
        )}

        {/* 5. Filter Segmented Chips */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            activeOpacity={0.8}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
              All ({totalEnrolled})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'at_risk' && styles.filterChipRiskActive]}
            activeOpacity={0.8}
            onPress={() => setFilter('at_risk')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'at_risk' && styles.filterChipTextRiskActive,
              ]}
            >
              At Risk ({ineligibleCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'eligible' && styles.filterChipEligibleActive]}
            activeOpacity={0.8}
            onPress={() => setFilter('eligible')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'eligible' && styles.filterChipTextEligibleActive,
              ]}
            >
              Eligible ({eligibleCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 6. Students Roster List */}
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Students</Text>
            <Text style={styles.emptySubtitle}>
              {students.length === 0
                ? 'No students enrolled yet. Tap "Add Student" above to build your class roster.'
                : 'No students match the current filter.'}
            </Text>
          </View>
        ) : (
          filteredStudents.map((student) => {
            const stats = attendanceStats.find((s) => s.student_id === student.id);
            const behaviorPoints = studentBehaviorPoints[student.id] ?? 0;
            const hasAttendance = stats && stats.total_sessions > 0;
            const pct = hasAttendance ? Number(stats.attendance_percentage) : null;
            const isEligible = pct !== null ? pct >= minRequired : true;
            const initial = (student.name.charAt(0) || 'S').toUpperCase();

            return (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentCard,
                  hasAttendance && !isEligible && styles.studentCardAtRisk,
                ]}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: '/students/[id]',
                    params: { id: String(student.id) },
                  })
                }
              >
                {/* Top Row: Avatar Initial, Student Name & ID, Behavior Badge */}
                <View style={styles.studentCardHeader}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.studentAvatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {student.name}
                    </Text>
                    <Text style={styles.studentNumber}>
                      ID #{student.student_number}
                    </Text>
                  </View>

                  {/* Behavior Score Badge */}
                  <View
                    style={[
                      styles.behaviorBadge,
                      behaviorPoints > 0
                        ? styles.behaviorBadgePositive
                        : behaviorPoints < 0
                        ? styles.behaviorBadgeNegative
                        : styles.behaviorBadgeNeutral,
                    ]}
                  >
                    <Award
                      size={12}
                      color={
                        behaviorPoints > 0
                          ? Colors.tealDark
                          : behaviorPoints < 0
                          ? Colors.errorDark
                          : Colors.textTertiary
                      }
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[
                        styles.behaviorBadgeText,
                        behaviorPoints > 0
                          ? styles.behaviorTextPositive
                          : behaviorPoints < 0
                          ? styles.behaviorTextNegative
                          : styles.behaviorTextNeutral,
                      ]}
                    >
                      {behaviorPoints > 0 ? `+${behaviorPoints}` : behaviorPoints} pts
                    </Text>
                  </View>
                </View>

                {/* Bottom Row: Attendance Stats & View Profile Link */}
                <View style={styles.studentFooter}>
                  {hasAttendance ? (
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.attendancePctLabel}>Attendance:</Text>
                        <View
                          style={[
                            styles.eligibilityPill,
                            isEligible ? styles.eligibilityPillPass : styles.eligibilityPillFail,
                          ]}
                        >
                          <Text
                            style={[
                              styles.eligibilityPillText,
                              isEligible ? styles.eligibilityTextPass : styles.eligibilityTextFail,
                            ]}
                          >
                            {pct}% {isEligible ? 'Target Met' : 'At Risk'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.attendanceCountsText}>
                        Present: {stats.present_count} • Absent: {stats.absent_count} • Late: {stats.late_count}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noAttendanceText}>No attendance sessions recorded</Text>
                  )}

                  <ChevronRight size={18} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* 7. Class Management Danger Zone */}
        <View style={styles.managementCard}>
          <Text style={styles.managementTitle}>CLASSROOM ACTIONS</Text>
          <View style={styles.managementButtons}>
            <TouchableOpacity
              style={styles.outlineEditBtn}
              activeOpacity={0.8}
              onPress={() => setShowEditModal(true)}
            >
              <Edit3 size={15} color={Colors.textPrimary} />
              <Text style={styles.outlineEditBtnText}>Edit Class</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteClassBtn, deletingClass && styles.disabledButton]}
              activeOpacity={0.8}
              onPress={confirmDeleteClass}
              disabled={deletingClass}
            >
              <Trash2 size={15} color={Colors.error} />
              <Text style={styles.deleteClassBtnText}>
                {deletingClass ? 'Deleting...' : 'Delete Class'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 8. EDIT CLASS MODAL */}
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
              <View style={styles.modalContent}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Edit Classroom</Text>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>CLASSROOM NAME</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editClassName}
                  onChangeText={setEditClassName}
                  placeholder="e.g. Grade 5 - Section A"
                  placeholderTextColor={Colors.textMuted}
                  editable={!savingClassEdit}
                />

                <Text style={styles.modalLabel}>MIN ATTENDANCE REQUIREMENT (%)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editMinAttendance}
                  onChangeText={setEditMinAttendance}
                  placeholder="75"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                  editable={!savingClassEdit}
                />

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowEditModal(false)}
                    disabled={savingClassEdit}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSaveButton, savingClassEdit && styles.disabledButton]}
                    onPress={handleUpdateClass}
                    disabled={savingClassEdit}
                  >
                    {savingClassEdit ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
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
  headerClassTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerClassMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
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
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    ...Shadows.large,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  heroPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1,
  },
  heroMetricRow: {
    marginBottom: 18,
  },
  heroMetricValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroMetricUnit: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 14,
  },
  heroBreakdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.6,
  },
  heroBreakdownValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    ...Shadows.small,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 14,
    ...Shadows.small,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  alertIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.errorDark,
  },
  alertBannerText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
    fontWeight: '500',
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipRiskActive: {
    backgroundColor: Colors.errorDark,
    borderColor: Colors.errorDark,
  },
  filterChipEligibleActive: {
    backgroundColor: Colors.tealDark,
    borderColor: Colors.tealDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextRiskActive: {
    color: '#FFFFFF',
  },
  filterChipTextEligibleActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 36,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  studentCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  studentCardAtRisk: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  studentAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  studentNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  behaviorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  behaviorBadgePositive: {
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  behaviorBadgeNegative: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  behaviorBadgeNeutral: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  behaviorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  behaviorTextPositive: {
    color: Colors.tealDark,
  },
  behaviorTextNegative: {
    color: Colors.errorDark,
  },
  behaviorTextNeutral: {
    color: Colors.textTertiary,
  },
  studentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    borderStyle: 'dashed',
    paddingTop: 10,
  },
  attendancePctLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eligibilityPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  eligibilityPillPass: {
    backgroundColor: Colors.tealLight,
  },
  eligibilityPillFail: {
    backgroundColor: Colors.errorLight,
  },
  eligibilityPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  eligibilityTextPass: {
    color: Colors.tealDark,
  },
  eligibilityTextFail: {
    color: Colors.errorDark,
  },
  attendanceCountsText: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },
  noAttendanceText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  managementCard: {
    marginTop: 20,
    backgroundColor: Colors.white,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    ...Shadows.small,
  },
  managementTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  managementButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineEditBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.background,
  },
  outlineEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deleteClassBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
  },
  deleteClassBtnText: {
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
  modalContent: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.large,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    marginBottom: 6,
    letterSpacing: 0.6,
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
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
