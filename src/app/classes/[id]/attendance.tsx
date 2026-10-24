import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Calendar, Plus } from 'lucide-react-native';
import { supabase } from '../../../lib/supabase';
import { useAuthGuard } from '../../../lib/auth';
import { Colors, Shadows } from '../../../constants/theme';

type Student = {
  id: number;
  name: string;
  student_number: string;
};

type SessionItem = {
  id: number;
  session_date: string;
  status: string;
};

type AttendanceStatus = 'present' | 'absent' | 'late';

const attendanceOptions: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
];

export default function AttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, checkingAuth } = useAuthGuard();

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Load class, sessions, and students
  const loadInitialData = useCallback(async () => {
    if (!id || !user) return;
    const classId = Number(id);

    try {
      setLoading(true);

      // 1. Verify class ownership (Teacher-specific data access)
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name, teacher_id')
        .eq('id', classId)
        .single();

      if (classError || !classData) {
        Alert.alert('Error', 'Class could not be loaded.');
        router.back();
        return;
      }

      if (classData.teacher_id !== user.id) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setClassName(classData.name);

      // 2. Fetch all students for this class
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, student_number')
        .eq('class_id', classId)
        .order('name', { ascending: true });

      if (studentError) throw studentError;
      const studentList = studentData ?? [];
      setStudents(studentList);

      // 3. Fetch all recorded class sessions for this class (most recent first)
      const { data: sessionData, error: sessionError } = await supabase
        .from('class_sessions')
        .select('id, session_date, status')
        .eq('class_id', classId)
        .order('session_date', { ascending: false });

      if (sessionError) throw sessionError;

      const sessionList = sessionData ?? [];
      setSessions(sessionList);

      if (sessionList.length > 0) {
        // Select the latest session by default
        const latestSession = sessionList[0];
        setSelectedSessionId(latestSession.id);
        setSelectedDate(latestSession.session_date);
        await loadAttendanceForSession(latestSession.id, studentList);
      } else {
        // No sessions recorded yet
        setSelectedSessionId(null);
        setSelectedDate('');
      }
    } catch (err: unknown) {
      console.error('Error loading attendance screen:', err);
      const msg = err instanceof Error ? err.message : 'Could not load data.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [id, user, router]);

  useEffect(() => {
    if (user && id) {
      loadInitialData();
    }
  }, [user, id, loadInitialData]);

  // Load saved attendance for a specific session
  async function loadAttendanceForSession(sessionId: number, studentList: Student[]) {
    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_session_id', sessionId);

      if (attendanceError) throw attendanceError;

      const savedAttendance: Record<number, AttendanceStatus> = {};
      attendanceData?.forEach((record) => {
        savedAttendance[record.student_id] = record.status as AttendanceStatus;
      });

      // Default unmarked students to 'present'
      studentList.forEach((s) => {
        if (!savedAttendance[s.id]) {
          savedAttendance[s.id] = 'present';
        }
      });

      setAttendance(savedAttendance);
    } catch (err) {
      console.error('Error loading session attendance:', err);
    }
  }

  // Switch session date
  async function handleSelectSession(session: SessionItem) {
    setSelectedSessionId(session.id);
    setSelectedDate(session.session_date);
    await loadAttendanceForSession(session.id, students);
  }

  // Quickly mark all as Present
  function markAllPresent() {
    const updated: Record<number, AttendanceStatus> = {};
    students.forEach((s) => {
      updated[s.id] = 'present';
    });
    setAttendance(updated);
  }

  function changeStatus(studentId: number, status: AttendanceStatus) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  }

  // Attendance Editing and Correction: upserts attendance for the selected date
  async function saveAttendance() {
    if (!selectedSessionId || !selectedDate) {
      Alert.alert('No Session', 'Please select or record a class session first.');
      return;
    }

    if (students.length === 0) {
      Alert.alert('No Students', 'Add students before saving attendance.');
      return;
    }

    setSaving(true);
    try {
      const records = students.map((student) => ({
        student_id: student.id,
        attendance_date: selectedDate,
        class_session_id: selectedSessionId,
        status: attendance[student.id] ?? 'present',
      }));

      // Upsert by onConflict student_id,attendance_date ensures correcting existing records
      const { error } = await supabase.from('attendance').upsert(records, {
        onConflict: 'student_id,attendance_date',
      });

      if (error) throw error;

      Alert.alert(
        'Attendance Saved',
        `Attendance for ${selectedDate} has been successfully recorded/updated.`
      );
    } catch (err: unknown) {
      console.error('Error saving attendance:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save attendance.';
      Alert.alert('Error Saving Attendance', msg);
    } finally {
      setSaving(false);
    }
  }

  // Quick create session for today if none exists
  async function createTodaySession() {
    if (!id) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      const { data: newSession, error } = await supabase
        .from('class_sessions')
        .insert({
          class_id: Number(id),
          session_date: today,
          status: 'conducted',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Info', "Today's session is already created. Select it below.");
        } else {
          throw error;
        }
        return;
      }

      setSessions((prev) => [newSession, ...prev]);
      setSelectedSessionId(newSession.id);
      setSelectedDate(newSession.session_date);
      await loadAttendanceForSession(newSession.id, students);
      Alert.alert('Success', `Session created for today (${today}).`);
    } catch (err: unknown) {
      console.error('Error creating today session:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create session.';
      Alert.alert('Error', msg);
    }
  }

  if (checkingAuth || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading attendance session...</Text>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>🔒 Access Denied</Text>
        <Text style={styles.message}>You do not own this class.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Bar with Back Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backTouch} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{className}</Text>
          <Text style={styles.subtitle}>Mark & Correct Attendance</Text>
        </View>
      </View>

      {/* Date / Session Selector */}
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeaderRow}>
          <Text style={styles.sessionLabel}>Selected Session Date:</Text>
          <Text style={styles.selectedDateText}>
            {selectedDate ? `📅 ${selectedDate}` : 'None Selected'}
          </Text>
        </View>

        {sessions.length > 0 ? (
          <View style={styles.sessionPickerContainer}>
            <Text style={styles.pickerHint}>Tap a session date below to view or correct:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateChipsScroll}>
              {sessions.map((s) => {
                const isSelected = s.id === selectedSessionId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                    onPress={() => handleSelectSession(s)}
                  >
                    <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                      {s.session_date}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.noSessionsBox}>
            <Text style={styles.noSessionsText}>
              No class sessions recorded yet. Create today's session to begin marking attendance.
            </Text>
            <TouchableOpacity style={styles.createSessionButton} onPress={createTodaySession}>
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={styles.createSessionButtonText}>Record Today's Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Roster & Quick Action */}
      {selectedSessionId && (
        <View style={styles.actionHeader}>
          <Text style={styles.rosterTitle}>Students ({students.length})</Text>
          <TouchableOpacity style={styles.quickMarkButton} onPress={markAllPresent}>
            <Text style={styles.quickMarkText}>Mark All Present</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Students Attendance List */}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.message}>
              No students enrolled in this class. Add students from the class screen first.
            </Text>
          </View>
        ) : !selectedSessionId ? (
          <View style={styles.emptyState}>
            <Text style={styles.message}>
              Please select or record a session date above to take or edit attendance.
            </Text>
          </View>
        ) : (
          students.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentHeader}>
                <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                <Text style={styles.studentNumber}>#{student.student_number}</Text>
              </View>

              <View style={styles.statusContainer}>
                {attendanceOptions.map((status) => {
                  const selected = attendance[student.id] === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        selected && styles.selectedStatus,
                        selected && status === 'present' && styles.statusPresentSelected,
                        selected && status === 'absent' && styles.statusAbsentSelected,
                        selected && status === 'late' && styles.statusLateSelected,
                      ]}
                      onPress={() => changeStatus(student.id, status)}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          selected && styles.selectedStatusText,
                        ]}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Save Button */}
      {selectedSessionId && students.length > 0 && (
        <TouchableOpacity
          style={[
            styles.saveButton,
            { marginBottom: Math.max(insets.bottom, 12) },
            saving && styles.disabledButton,
          ]}
          onPress={saveAttendance}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : `Save Attendance (${selectedDate})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 18,
    paddingTop: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  backTouch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
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
    fontSize: 15,
    color: Colors.textTertiary,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.error,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
  sessionCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    ...Shadows.small,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  selectedDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  sessionPickerContainer: {
    marginTop: 4,
  },
  pickerHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: 8,
  },
  dateChipsScroll: {
    flexDirection: 'row',
  },
  dateChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  noSessionsBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noSessionsText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  createSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    ...Shadows.small,
  },
  createSessionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rosterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  quickMarkButton: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickMarkText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyState: {
    padding: 30,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginTop: 20,
    ...Shadows.small,
  },
  message: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  studentCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 8,
  },
  studentNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  selectedStatus: {
    borderWidth: 1,
  },
  statusPresentSelected: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  statusAbsentSelected: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  statusLateSelected: {
    backgroundColor: Colors.goldDark,
    borderColor: Colors.goldDark,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  selectedStatusText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    ...Shadows.medium,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});