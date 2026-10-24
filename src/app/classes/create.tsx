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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, ArrowLeft, Check, ShieldAlert } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';
import { Colors, Shadows } from '../../constants/theme';

export default function CreateClassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, checkingAuth } = useAuthGuard();

  const [className, setClassName] = useState('');
  const [minAttendance, setMinAttendance] = useState('75');
  const [loading, setLoading] = useState(false);

  async function handleCreateClass() {
    const trimmedName = className.trim();
    const minPct = Number(minAttendance);

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Validation Error', 'Please enter a class name (at least 2 characters).');
      return;
    }

    if (isNaN(minPct) || !Number.isInteger(minPct) || minPct < 1 || minPct > 100) {
      Alert.alert('Validation Error', 'Minimum attendance requirement must be a whole number between 1 and 100.');
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
      const { error } = await supabase.from('classes').insert({
        name: trimmedName,
        teacher_id: user.id,
        min_attendance_percentage: minPct,
      });

      if (error) {
        Alert.alert('Could Not Create Class', error.message);
        return;
      }

      Alert.alert('Success', `Class "${trimmedName}" has been created.`);
      router.replace('/(tabs)/classes');
    } catch (err: unknown) {
      console.error('Error creating class:', err);
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
            <Text style={styles.backButtonText}>Back to Classrooms</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <BookOpen size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Create New Classroom</Text>
            <Text style={styles.subtitle}>
              Configure your group roster, attendance targets, and student behavior tracking.
            </Text>

            <Text style={styles.label}>CLASSROOM NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grade 5 - Section A"
              placeholderTextColor={Colors.textMuted}
              value={className}
              onChangeText={setClassName}
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>MINIMUM ATTENDANCE TARGET (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="75"
              placeholderTextColor={Colors.textMuted}
              value={minAttendance}
              onChangeText={setMinAttendance}
              keyboardType="number-pad"
              maxLength={3}
              editable={!loading}
            />

            <View style={styles.hintContainer}>
              <ShieldAlert size={16} color={Colors.goldDark} style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={styles.hintText}>
                Students below {minAttendance || '75'}% attendance will be flagged in your At-Risk watchlist for quick intervention.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.disabledButton]}
              activeOpacity={0.85}
              onPress={handleCreateClass}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.buttonText}>Save Classroom</Text>
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
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.background,
    marginBottom: 16,
    color: Colors.textPrimary,
  },
  hintContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.goldLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.goldDark,
    lineHeight: 16,
    fontWeight: '500',
  },
  button: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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
