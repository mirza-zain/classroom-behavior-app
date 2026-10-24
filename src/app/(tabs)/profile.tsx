import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Key,
  ShieldCheck,
  Lock,
  Database,
  Smartphone,
  Target,
  Award,
  LogOut,
  Check,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';
import { Colors, Shadows } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';

export default function ProfileTabScreen() {
  const router = useRouter();
  const { user, checkingAuth } = useAuthGuard();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out of your teacher account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await supabase.auth.signOut();
            router.replace('/login');
          } catch (err) {
            console.error('Logout error:', err);
            router.replace('/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  if (checkingAuth) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  const teacherEmail = user?.email ?? 'teacher@school.edu';
  const teacherId = user?.id ?? '—';
  const initial = teacherEmail.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Asaan Taqreeb Header */}
      <AppHeader
        title="Teacher Profile"
        subtitle="Account & Cloud Security"
        teacherEmail={teacherEmail}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. TEACHER HERO PROFILE CARD */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
            <View style={styles.badgeCheck}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="middle">
            {teacherEmail}
          </Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>Classroom Educator • Verified</Text>
          </View>
        </View>

        {/* 2. ACCOUNT DETAILS SECTION */}
        <Text style={styles.sectionHeader}>Account Information</Text>
        <View style={styles.settingsGroupCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <User size={16} color={Colors.textPrimary} />
              </View>
              <Text style={styles.settingLabel}>Email Address</Text>
            </View>
            <Text style={styles.settingValue} numberOfLines={1} ellipsizeMode="middle">
              {teacherEmail}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Key size={16} color={Colors.textPrimary} />
              </View>
              <Text style={styles.settingLabel}>Teacher ID</Text>
            </View>
            <Text style={styles.settingValue} numberOfLines={1}>
              {teacherId.slice(0, 10)}...
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <ShieldCheck size={16} color={Colors.teal} />
              </View>
              <Text style={styles.settingLabel}>Access Role</Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>Educator Admin</Text>
            </View>
          </View>
        </View>

        {/* 3. SYSTEM & SECURITY SECTION */}
        <Text style={styles.sectionHeader}>System & Cloud Security</Text>
        <View style={styles.settingsGroupCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Lock size={16} color={Colors.teal} />
              </View>
              <Text style={styles.settingLabel}>Row Level Security</Text>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Enforced</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Database size={16} color={Colors.textPrimary} />
              </View>
              <Text style={styles.settingLabel}>Database Sync</Text>
            </View>
            <Text style={styles.settingValue}>Encrypted Cloud Sync</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Smartphone size={16} color={Colors.textPrimary} />
              </View>
              <Text style={styles.settingLabel}>App Build</Text>
            </View>
            <Text style={styles.settingValue}>v1.0.0 (Expo SDK 57)</Text>
          </View>
        </View>

        {/* 4. CLASSROOM STANDARDS */}
        <Text style={styles.sectionHeader}>Classroom Standards</Text>
        <View style={styles.settingsGroupCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Target size={16} color={Colors.goldDark} />
              </View>
              <Text style={styles.settingLabel}>Standard Min Attendance</Text>
            </View>
            <Text style={styles.settingValue}>75% Baseline</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItemRow}>
            <View style={styles.settingLabelBox}>
              <View style={styles.iconCircle}>
                <Award size={16} color={Colors.goldDark} />
              </View>
              <Text style={styles.settingLabel}>Behavior Points Scale</Text>
            </View>
            <Text style={styles.settingValue}>+1 to +3 / -1 to -3</Text>
          </View>
        </View>

        {/* 5. LOGOUT BUTTON */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.disabledButton]}
          activeOpacity={0.8}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          <LogOut size={18} color={Colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>
            {loggingOut ? 'Signing out...' : 'Log Out of Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 110, // Avoid bottom floating capsule tab bar
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  profileHeroCard: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: 24,
    ...Shadows.medium,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
    ...Shadows.small,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badgeCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.teal,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emailText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
    maxWidth: '90%',
  },
  roleTag: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 6,
  },
  settingsGroupCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 22,
    ...Shadows.small,
  },
  settingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  settingValue: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '600',
    maxWidth: '50%',
    textAlign: 'right',
  },
  rolePill: {
    backgroundColor: Colors.tealLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tealDark,
  },
  activePill: {
    backgroundColor: Colors.tealLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tealDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.errorLight,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 8,
    ...Shadows.small,
  },
  logoutButtonText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});