import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  teacherEmail?: string;
  rightAction?: React.ReactNode;
}

export default function AppHeader({
  title,
  subtitle,
  teacherEmail,
  rightAction,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initial = (teacherEmail?.charAt(0) || 'T').toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {/* Asaan Taqreeb style accent bar */}
          <View style={styles.accentBar} />
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {rightAction}
          <TouchableOpacity
            style={styles.avatarButton}
            activeOpacity={0.75}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.avatarText}>{initial}</Text>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  accentBar: {
    width: 24,
    height: 3,
    backgroundColor: Colors.accent,
    borderRadius: 1.5,
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.teal,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
