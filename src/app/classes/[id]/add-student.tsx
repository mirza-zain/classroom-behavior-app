import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { UserPlus, ArrowLeft, Check, Hash, User } from 'lucide-react-native';
import { supabase } from '../../../lib/supabase';
import { useAuthGuard } from '../../../lib/auth';
import { Colors, Shadows } from '../../../constants/theme';

export default function AddStudentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, checkingAuth } = useAuthGuard();

  const [studentName, setStudentName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAddStudent() {
    const trimmedName = studentName.trim();
    const trimmedNumber = studentNumber.trim().toUpperCase();

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter a valid student name (at least 2 characters).');
      return;
    }

    if (!trimmedNumber) {
      Alert.alert('Missing Student Number', 'Please enter a student number or roll ID.');
      return;
    }

    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      Alert.alert('Invalid Class', 'The selected class could not be identified.');
      return;
    }

    if (!user) {
      Alert.alert('Session Expired', 'Please log in again.');
      router.replace('/login');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const classId = Number(id);

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, teacher_id')
        .eq('id', classId)
        .eq('teacher_id', user.id)
        .maybeSingle();

      if (classError || !classData) {
        Alert.alert('Permission Denied', 'You do not have permission to add students to this class.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('students').insert({
        class_id: classId,
        name: trimmedName,
        student_number: trimmedNumber,
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert(
            'Duplicate Student Number',
            `Student number "${trimmedNumber}" is already in use in this class.`
          );
        } else {
          Alert.alert('Could Not Add Student', error.message);
        }
        return;
      }

      Alert.alert('Success', `${trimmedName} added successfully.`);
      router.back();
    } catch (err: unknown) {
      console.error('Error adding student:', err);
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 10, 24),
              paddingBottom: Math.max(insets.bottom + 40, 60),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Back Navigation */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
            <Text style={styles.backButtonText}>Back to Roster</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <UserPlus size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Enroll Student</Text>
            <Text style={styles.subtitle}>
              Add a student to this class roster to begin tracking their attendance and behavior.
            </Text>

            <Text style={styles.label}>STUDENT FULL NAME</Text>
            <View style={styles.inputWrapper}>
              <User size={16} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Morgan"
                placeholderTextColor={Colors.textMuted}
                value={studentName}
                onChangeText={setStudentName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <Text style={styles.label}>STUDENT NUMBER / ROLL ID</Text>
            <View style={styles.inputWrapper}>
              <Hash size={16} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. STU-001"
                placeholderTextColor={Colors.textMuted}
                value={studentNumber}
                onChangeText={setStudentNumber}
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.disabledButton]}
              activeOpacity={0.85}
              onPress={handleAddStudent}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.buttonText}>Save Student to Class</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.large,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: Colors.background,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  button: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
    ...Shadows.medium,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
});
