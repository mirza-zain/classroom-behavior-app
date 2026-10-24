import { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Search, X, Plus, BookOpen, Users, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';
import { Colors, Shadows } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';

type ClassItem = {
  id: number;
  name: string;
  teacher_id: string;
  min_attendance_percentage: number;
  created_at: string;
};

export default function ClassesTabScreen() {
  const router = useRouter();
  const { user, checkingAuth } = useAuthGuard();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchClasses = useCallback(async () => {
    if (!user) return;

    try {
      setErrorMessage('');
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage(error.message || 'Could not load your classes.');
      } else {
        const classList = data ?? [];
        setClasses(classList);

        // Fetch student counts for each class
        if (classList.length > 0) {
          const classIds = classList.map((c) => c.id);
          const { data: studentsData } = await supabase
            .from('students')
            .select('id, class_id')
            .in('class_id', classIds);

          if (studentsData) {
            const counts: Record<number, number> = {};
            studentsData.forEach((s) => {
              counts[s.class_id] = (counts[s.class_id] || 0) + 1;
            });
            setStudentCounts(counts);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setErrorMessage('Network or server error loading classes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchClasses();
      }
    }, [user, fetchClasses])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClasses();
  }, [fetchClasses]);

  const filteredClasses = classes.filter((cls) =>
    cls.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (checkingAuth || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your classrooms...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Asaan Taqreeb Style Header */}
          <AppHeader
            title="Classrooms"
            subtitle={`${classes.length} active roster${classes.length !== 1 ? 's' : ''}`}
            teacherEmail={user?.email}
            rightAction={
              <TouchableOpacity
                style={styles.newClassBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/classes/create')}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.newClassBtnText}>New</Text>
              </TouchableOpacity>
            }
          />

          <View style={styles.body}>
            {/* Search Bar matching Asaan Taqreeb input style */}
            {classes.length > 0 && (
              <View style={styles.searchContainer}>
                <Search size={18} color={Colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by classroom name..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="never"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchClasses}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : classes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <BookOpen size={36} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No Classrooms Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first classroom to begin managing student attendance and tracking positive behavior.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  activeOpacity={0.85}
                  onPress={() => router.push('/classes/create')}
                >
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.emptyCreateButtonText}>Create First Classroom</Text>
                </TouchableOpacity>
              </View>
            ) : filteredClasses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Search size={32} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No Class Found</Text>
                <Text style={styles.emptySubtitle}>
                  No classroom matches "{searchQuery}". Try a different keyword.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredClasses}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                  />
                }
                contentContainerStyle={{ paddingBottom: 110 }}
                renderItem={({ item }) => {
                  const enrolled = studentCounts[item.id] || 0;
                  const initial = (item.name.charAt(0) || 'C').toUpperCase();

                  return (
                    <TouchableOpacity
                      style={styles.classCard}
                      activeOpacity={0.9}
                      onPress={() =>
                        router.push({
                          pathname: '/classes/[id]',
                          params: { id: String(item.id) },
                        })
                      }
                    >
                      {/* Top Row: Avatar Initial, Name, Subtitle, Status Badge */}
                      <View style={styles.cardHeader}>
                        <View style={styles.classAvatar}>
                          <Text style={styles.classAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.className} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.classSubMeta}>
                            CLASSROOM ID #{item.id}
                          </Text>
                        </View>
                        <View style={styles.targetBadge}>
                          <Text style={styles.targetBadgeText}>
                            {item.min_attendance_percentage}% TARGET
                          </Text>
                        </View>
                      </View>

                      {/* Middle Stats Box (Asaan Taqreeb style inner card) */}
                      <View style={styles.cardStatsBox}>
                        <View style={styles.statCol}>
                          <Text style={styles.statLabel}>ENROLLED</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Users size={14} color={Colors.textPrimary} />
                            <Text style={styles.statValue}>
                              {enrolled} {enrolled === 1 ? 'Student' : 'Students'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                          <Text style={styles.statLabel}>MIN ATTENDANCE</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <CheckCircle2 size={14} color={Colors.teal} />
                            <Text style={[styles.statValue, { color: Colors.tealDark }]}>
                              {item.min_attendance_percentage}% Min
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Dashed Bottom Divider with Quick Action Buttons */}
                      <View style={styles.cardFooter}>
                        <TouchableOpacity
                          style={styles.cardActionPrimary}
                          activeOpacity={0.8}
                          onPress={() =>
                            router.push({
                              pathname: '/classes/[id]/attendance',
                              params: { id: String(item.id) },
                            })
                          }
                        >
                          <CheckCircle2 size={14} color="#FFFFFF" />
                          <Text style={styles.cardActionPrimaryText}>Mark Attendance</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cardActionSecondary}
                          activeOpacity={0.8}
                          onPress={() =>
                            router.push({
                              pathname: '/classes/[id]',
                              params: { id: String(item.id) },
                            })
                          }
                        >
                          <Text style={styles.cardActionSecondaryText}>Manage Roster</Text>
                          <ArrowRight size={13} color={Colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    fontWeight: '600',
  },
  newClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    ...Shadows.small,
  },
  newClassBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 48,
    ...Shadows.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  classCard: {
    backgroundColor: Colors.white,
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  classAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  classAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  className: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  classSubMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  targetBadge: {
    backgroundColor: Colors.goldLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.goldDark,
    letterSpacing: 0.5,
  },
  cardStatsBox: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
    paddingTop: 14,
  },
  cardActionPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cardActionPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cardActionSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Shadows.small,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    ...Shadows.medium,
  },
  emptyCreateButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
  },
  errorText: {
    color: Colors.errorDark,
    fontSize: 13,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.errorDark,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});