import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  GraduationCap,
  Users,
  Award,
  AlertCircle,
  Calendar,
  Plus,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Activity,
  Layers,
  ArrowUpRight,
  Check,
} from 'lucide-react-native';
import { Colors, Shadows } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { supabase } from '../../lib/supabase';
import { useAuthGuard } from '../../lib/auth';

type ClassItem = {
  id: number;
  name: string;
  min_attendance_percentage: number;
  created_at: string;
  studentCount?: number;
  attendanceAvg?: number | null;
  conductedToday?: boolean;
};

type StudentItem = {
  id: number;
  name: string;
  student_number: string;
  class_id: number;
};

type RecentLog = {
  id: number;
  student_id: number;
  points: number;
  reason: string;
  created_at: string;
  studentName?: string;
};

type AtRiskStudent = {
  id: number;
  name: string;
  className: string;
  percentage: number;
  minRequired: number;
};

type DashboardTab = 'overview' | 'analytics' | 'watchlist';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, checkingAuth } = useAuthGuard();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [netBehaviorScore, setNetBehaviorScore] = useState<number>(0);
  const [positiveCount, setPositiveCount] = useState<number>(0);
  const [negativeCount, setNegativeCount] = useState<number>(0);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [overallAttendanceRate, setOverallAttendanceRate] = useState<number | null>(null);

  // Deep Analytics Stats
  const [presentTally, setPresentTally] = useState<number>(0);
  const [absentTally, setAbsentTally] = useState<number>(0);
  const [lateTally, setLateTally] = useState<number>(0);
  const [totalAttendanceRecords, setTotalAttendanceRecords] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date();
      const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // 1. Fetch teacher's classes
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (classError) throw classError;
      const classList: ClassItem[] = classData ?? [];

      if (classList.length === 0) {
        setClasses([]);
        setTotalStudents(0);
        setNetBehaviorScore(0);
        setPositiveCount(0);
        setNegativeCount(0);
        setRecentLogs([]);
        setAtRiskStudents([]);
        setOverallAttendanceRate(null);
        setPresentTally(0);
        setAbsentTally(0);
        setLateTally(0);
        setTotalAttendanceRecords(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const classIds = classList.map((c) => c.id);
      const classMap: Record<number, ClassItem> = {};
      classList.forEach((c) => {
        classMap[c.id] = c;
      });

      // 2. Fetch today's sessions for these classes
      const { data: todaySessions } = await supabase
        .from('class_sessions')
        .select('class_id, session_date')
        .in('class_id', classIds)
        .eq('session_date', todayDateStr);

      const conductedTodaySet = new Set<number>();
      todaySessions?.forEach((s) => conductedTodaySet.add(s.class_id));

      // 3. Fetch all students across these classes
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, student_number, class_id')
        .in('class_id', classIds);

      if (studentError) throw studentError;
      const studentList: StudentItem[] = studentData ?? [];
      setTotalStudents(studentList.length);

      const studentMap: Record<number, string> = {};
      const classStudentCountMap: Record<number, number> = {};
      studentList.forEach((s) => {
        studentMap[s.id] = s.name;
        classStudentCountMap[s.class_id] = (classStudentCountMap[s.class_id] || 0) + 1;
      });

      // 4. Fetch behavior logs for this teacher
      const { data: behaviorData, error: behaviorError } = await supabase
        .from('behavior_logs')
        .select('id, student_id, points, reason, created_at')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (!behaviorError && behaviorData) {
        let totalScore = 0;
        let pos = 0;
        let neg = 0;
        behaviorData.forEach((b) => {
          totalScore += b.points;
          if (b.points > 0) pos++;
          else if (b.points < 0) neg++;
        });
        setNetBehaviorScore(totalScore);
        setPositiveCount(pos);
        setNegativeCount(neg);

        const enrichedRecent = behaviorData.slice(0, 4).map((b) => ({
          ...b,
          studentName: studentMap[b.student_id] ?? 'Student',
        }));
        setRecentLogs(enrichedRecent);
      }

      // 5. Fetch attendance records
      if (studentList.length > 0) {
        const studentIds = studentList.map((s) => s.id);
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', studentIds);

        if (attendanceData && attendanceData.length > 0) {
          let totalPresent = 0;
          let totalAbsent = 0;
          let totalLate = 0;
          const studentAttendanceCounts: Record<number, { present: number; total: number }> = {};
          const classAttendanceTotals: Record<number, { present: number; total: number }> = {};

          attendanceData.forEach((rec) => {
            if (!studentAttendanceCounts[rec.student_id]) {
              studentAttendanceCounts[rec.student_id] = { present: 0, total: 0 };
            }
            studentAttendanceCounts[rec.student_id].total += 1;

            if (rec.status === 'present') {
              totalPresent += 1;
              studentAttendanceCounts[rec.student_id].present += 1;
            } else if (rec.status === 'absent') {
              totalAbsent += 1;
            } else if (rec.status === 'late') {
              totalLate += 1;
            }
          });

          setPresentTally(totalPresent);
          setAbsentTally(totalAbsent);
          setLateTally(totalLate);
          setTotalAttendanceRecords(attendanceData.length);

          // Calculate student attendance percentages & identify at-risk students
          const riskList: AtRiskStudent[] = [];
          studentList.forEach((s) => {
            const counts = studentAttendanceCounts[s.id];
            const cls = classMap[s.class_id];

            if (counts && counts.total > 0 && cls) {
              if (!classAttendanceTotals[s.class_id]) {
                classAttendanceTotals[s.class_id] = { present: 0, total: 0 };
              }
              classAttendanceTotals[s.class_id].present += counts.present;
              classAttendanceTotals[s.class_id].total += counts.total;

              const pct = Math.round((counts.present / counts.total) * 100);
              if (pct < cls.min_attendance_percentage) {
                riskList.push({
                  id: s.id,
                  name: s.name,
                  className: cls.name,
                  percentage: pct,
                  minRequired: cls.min_attendance_percentage,
                });
              }
            }
          });

          const classAvgPct = Math.round((totalPresent / attendanceData.length) * 100);
          setOverallAttendanceRate(classAvgPct);
          setAtRiskStudents(riskList);

          // Enrich classes with metrics
          const enrichedClasses = classList.map((c) => {
            const classAtt = classAttendanceTotals[c.id];
            const avg =
              classAtt && classAtt.total > 0
                ? Math.round((classAtt.present / classAtt.total) * 100)
                : null;
            return {
              ...c,
              studentCount: classStudentCountMap[c.id] || 0,
              attendanceAvg: avg,
              conductedToday: conductedTodaySet.has(c.id),
            };
          });
          setClasses(enrichedClasses);
        } else {
          setOverallAttendanceRate(null);
          setAtRiskStudents([]);
          setPresentTally(0);
          setAbsentTally(0);
          setLateTally(0);
          setTotalAttendanceRecords(0);
          const enrichedClasses = classList.map((c) => ({
            ...c,
            studentCount: classStudentCountMap[c.id] || 0,
            attendanceAvg: null,
            conductedToday: conductedTodaySet.has(c.id),
          }));
          setClasses(enrichedClasses);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadDashboardData();
      }
    }, [user, loadDashboardData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  if (checkingAuth || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Classroom Intelligence...</Text>
      </View>
    );
  }

  // Attendance distribution percentages for visual gauge
  const presentPct =
    totalAttendanceRecords > 0
      ? Math.round((presentTally / totalAttendanceRecords) * 100)
      : 100;
  const latePct =
    totalAttendanceRecords > 0
      ? Math.round((lateTally / totalAttendanceRecords) * 100)
      : 0;
  const absentPct =
    totalAttendanceRecords > 0
      ? Math.max(0, 100 - presentPct - latePct)
      : 0;

  // Behavior momentum ratio
  const totalBehaviorLogs = positiveCount + negativeCount;
  const positiveRatio =
    totalBehaviorLogs > 0 ? Math.round((positiveCount / totalBehaviorLogs) * 100) : 100;

  return (
    <View style={styles.screenContainer}>
      {/* 1. App Header */}
      <AppHeader
        title="Command Hub"
        subtitle="Classroom Intelligence & Metrics"
        teacherEmail={user?.email}
        rightAction={
          <TouchableOpacity
            style={styles.newClassPill}
            activeOpacity={0.8}
            onPress={() => router.push('/classes/create')}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.newClassPillText}>New Class</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* 2. Interactive Segmented Navigation Bar */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.tabBarItem, activeTab === 'overview' && styles.tabBarItemActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('overview')}
          >
            <Layers
              size={14}
              color={activeTab === 'overview' ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[
                styles.tabBarItemText,
                activeTab === 'overview' && styles.tabBarItemTextActive,
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBarItem, activeTab === 'analytics' && styles.tabBarItemActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('analytics')}
          >
            <BarChart3
              size={14}
              color={activeTab === 'analytics' ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[
                styles.tabBarItemText,
                activeTab === 'analytics' && styles.tabBarItemTextActive,
              ]}
            >
              Analytics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBarItem, activeTab === 'watchlist' && styles.tabBarItemActive]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('watchlist')}
          >
            <AlertCircle
              size={14}
              color={activeTab === 'watchlist' ? Colors.errorDark : Colors.textTertiary}
            />
            <Text
              style={[
                styles.tabBarItemText,
                activeTab === 'watchlist' && styles.tabBarItemTextRiskActive,
              ]}
            >
              Watchlist ({atRiskStudents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* VIEW 1: OVERVIEW TAB                                     */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <>
            {/* Executive Hero Card (Obsidian with Pastel Glow Badges) */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadgeBox}>
                  <Activity size={14} color="#A7F3D0" />
                  <Text style={styles.heroBadgeText}>LIVE SYSTEM METRICS</Text>
                </View>
                <View style={styles.realtimePulse}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.realtimeText}>ACTIVE</Text>
                </View>
              </View>

              <View style={styles.heroMetricRow}>
                <View>
                  <Text style={styles.heroMainRate}>
                    {overallAttendanceRate !== null ? `${overallAttendanceRate}%` : '100%'}
                  </Text>
                  <Text style={styles.heroMainLabel}>School Attendance Index</Text>
                </View>
                <View style={styles.heroScoreBox}>
                  <Text style={styles.heroScoreLabel}>CONDUCT SCORE</Text>
                  <Text
                    style={[
                      styles.heroScoreVal,
                      { color: netBehaviorScore >= 0 ? '#6EE7B7' : '#FCA5A5' },
                    ]}
                  >
                    {netBehaviorScore > 0 ? `+${netBehaviorScore}` : netBehaviorScore} pts
                  </Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatLabel}>TOTAL ENROLLED</Text>
                  <Text style={styles.heroStatValue}>{totalStudents} Students</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatLabel}>ROSTERS</Text>
                  <Text style={styles.heroStatValue}>{classes.length} Classes</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatLabel}>AT RISK</Text>
                  <Text
                    style={[
                      styles.heroStatValue,
                      { color: atRiskStudents.length > 0 ? '#FCA5A5' : '#6EE7B7' },
                    ]}
                  >
                    {atRiskStudents.length} Students
                  </Text>
                </View>
              </View>
            </View>

            {/* 4 Pastel Color Cards Grid (Cool, Soft, Elegant) */}
            <View style={styles.pastelGrid}>
              {/* Card 1: Ice Blue Pastel (Roster) */}
              <View style={[styles.pastelCard, { backgroundColor: Colors.pastels.iceBg, borderColor: Colors.pastels.iceBorder }]}>
                <View style={[styles.pastelIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Users size={18} color={Colors.pastels.iceText} />
                </View>
                <Text style={styles.pastelCardValue} numberOfLines={1}>{totalStudents}</Text>
                <Text style={styles.pastelCardTitle}>Students Enrolled</Text>
                <Text style={[styles.pastelCardMeta, { color: Colors.pastels.iceText }]}>
                  {classes.length} Active Classes
                </Text>
              </View>

              {/* Card 2: Mint Pastel (Attendance) */}
              <View style={[styles.pastelCard, { backgroundColor: Colors.pastels.mintBg, borderColor: Colors.pastels.mintBorder }]}>
                <View style={[styles.pastelIconWrap, { backgroundColor: '#D1FAE5' }]}>
                  <TrendingUp size={18} color={Colors.pastels.mintText} />
                </View>
                <Text style={styles.pastelCardValue} numberOfLines={1}>
                  {overallAttendanceRate !== null ? `${overallAttendanceRate}%` : '100%'}
                </Text>
                <Text style={styles.pastelCardTitle}>Attendance Rate</Text>
                <Text style={[styles.pastelCardMeta, { color: Colors.pastels.mintText }]}>
                  Target: 75% Baseline
                </Text>
              </View>

              {/* Card 3: Lavender Pastel (Behavior) */}
              <View style={[styles.pastelCard, { backgroundColor: Colors.pastels.lavenderBg, borderColor: Colors.pastels.lavenderBorder }]}>
                <View style={[styles.pastelIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Award size={18} color={Colors.pastels.lavenderText} />
                </View>
                <Text style={styles.pastelCardValue} numberOfLines={1}>+{positiveCount}</Text>
                <Text style={styles.pastelCardTitle}>Positive Rewards</Text>
                <Text style={[styles.pastelCardMeta, { color: Colors.pastels.lavenderText }]}>
                  {positiveRatio}% Positive Ratio
                </Text>
              </View>

              {/* Card 4: Soft Rose Pastel (At-Risk Alerts) */}
              <View style={[styles.pastelCard, { backgroundColor: Colors.pastels.roseBg, borderColor: Colors.pastels.roseBorder }]}>
                <View style={[styles.pastelIconWrap, { backgroundColor: '#FFE4E6' }]}>
                  <AlertCircle size={18} color={Colors.pastels.roseText} />
                </View>
                <Text style={[styles.pastelCardValue, { color: Colors.pastels.roseText }]} numberOfLines={1}>
                  {atRiskStudents.length}
                </Text>
                <Text style={styles.pastelCardTitle}>Watchlist Alerts</Text>
                <Text style={[styles.pastelCardMeta, { color: Colors.pastels.roseText }]}>
                  {atRiskStudents.length > 0 ? 'Requires Follow-up' : 'All Rosters Eligible'}
                </Text>
              </View>
            </View>

            {/* Today's Classroom Pulse (Live Tracker) */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionPreTitle}>TODAY'S OPERATIONS</Text>
                  <Text style={styles.sectionTitle}>Daily Attendance Pulse</Text>
                </View>
                <TouchableOpacity
                  style={styles.sectionLink}
                  onPress={() => router.push('/(tabs)/classes')}
                >
                  <Text style={styles.sectionLinkText}>All Classes →</Text>
                </TouchableOpacity>
              </View>

              {classes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <GraduationCap size={32} color={Colors.textTertiary} />
                  <Text style={styles.emptyCardText}>No active classes found.</Text>
                </View>
              ) : (
                classes.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.pulseCard}>
                    <View style={styles.pulseLeft}>
                      <View
                        style={[
                          styles.pulseStatusIndicator,
                          {
                            backgroundColor: item.conductedToday
                              ? Colors.pastels.mintBorder
                              : Colors.pastels.champagneBorder,
                          },
                        ]}
                      >
                        {item.conductedToday ? (
                          <Check size={14} color={Colors.pastels.mintText} strokeWidth={3} />
                        ) : (
                          <Clock size={14} color={Colors.pastels.champagneText} />
                        )}
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.pulseClassName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.pulseClassMeta}>
                          {item.studentCount} Students • {item.min_attendance_percentage}% Target
                        </Text>
                      </View>
                    </View>

                    {item.conductedToday ? (
                      <View style={[styles.pulsePill, { backgroundColor: Colors.pastels.mintBg }]}>
                        <Text style={[styles.pulsePillText, { color: Colors.pastels.mintText }]}>
                          ✓ Taken Today
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pulseActionBtn}
                        activeOpacity={0.8}
                        onPress={() =>
                          router.push({
                            pathname: '/classes/[id]/attendance',
                            params: { id: String(item.id) },
                          })
                        }
                      >
                        <Text style={styles.pulseActionBtnText}>Mark Now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Recent Commendations (Live Behavior Feed) */}
            {recentLogs.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionPreTitle}>CONDUCT STREAM</Text>
                    <Text style={styles.sectionTitle}>Recent Commendations</Text>
                  </View>
                  <Sparkles size={16} color={Colors.goldDark} />
                </View>

                {recentLogs.map((log) => (
                  <View key={log.id} style={styles.recentFeedCard}>
                    <View
                      style={[
                        styles.recentIconWrap,
                        {
                          backgroundColor:
                            log.points > 0 ? Colors.pastels.mintBg : Colors.pastels.roseBg,
                        },
                      ]}
                    >
                      <Award
                        size={16}
                        color={log.points > 0 ? Colors.pastels.mintText : Colors.pastels.roseText}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.recentStudentName} numberOfLines={1}>
                        {log.studentName}
                      </Text>
                      <Text style={styles.recentReasonText} numberOfLines={1}>
                        {log.reason}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.recentPointBadge,
                        {
                          backgroundColor:
                            log.points > 0 ? Colors.pastels.mintBg : Colors.pastels.roseBg,
                          borderColor:
                            log.points > 0 ? Colors.pastels.mintBorder : Colors.pastels.roseBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.recentPointText,
                          {
                            color:
                              log.points > 0 ? Colors.pastels.mintText : Colors.pastels.roseText,
                          },
                        ]}
                      >
                        {log.points > 0 ? `+${log.points}` : log.points}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: ANALYTICS & BREAKDOWN TAB                        */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <>
            {/* Attendance Distribution Card */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardPreTitle}>HEALTH GAUGE</Text>
                  <Text style={styles.cardMainTitle}>Attendance Distribution</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: Colors.pastels.mintBg }]}>
                  <Text style={[styles.statusBadgeText, { color: Colors.pastels.mintText }]}>
                    {overallAttendanceRate !== null ? `${overallAttendanceRate}% Average` : 'Optimal'}
                  </Text>
                </View>
              </View>

              {/* Multi-segmented Visual Bar */}
              <View style={styles.segmentedProgressBar}>
                <View
                  style={[
                    styles.segmentPresent,
                    { flex: Math.max(presentPct, 2), backgroundColor: '#10B981' },
                  ]}
                />
                {latePct > 0 && (
                  <View
                    style={[
                      styles.segmentLate,
                      { flex: Math.max(latePct, 2), backgroundColor: '#F59E0B' },
                    ]}
                  />
                )}
                {absentPct > 0 && (
                  <View
                    style={[
                      styles.segmentAbsent,
                      { flex: Math.max(absentPct, 2), backgroundColor: '#EF4444' },
                    ]}
                  />
                )}
              </View>

              {/* Distribution Legend & Stats */}
              <View style={styles.distributionStatsRow}>
                <View style={styles.distributionStatCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.dotIndicator, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.distLabel}>Present</Text>
                  </View>
                  <Text style={styles.distValue}>{presentTally}</Text>
                  <Text style={styles.distPct}>{presentPct}% of sessions</Text>
                </View>

                <View style={styles.distributionDivider} />

                <View style={styles.distributionStatCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.dotIndicator, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.distLabel}>Late</Text>
                  </View>
                  <Text style={styles.distValue}>{lateTally}</Text>
                  <Text style={styles.distPct}>{latePct}% of sessions</Text>
                </View>

                <View style={styles.distributionDivider} />

                <View style={styles.distributionStatCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.dotIndicator, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.distLabel}>Absent</Text>
                  </View>
                  <Text style={styles.distValue}>{absentTally}</Text>
                  <Text style={styles.distPct}>{absentPct}% of sessions</Text>
                </View>
              </View>
            </View>

            {/* Behavior Momentum Ratio Card */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardPreTitle}>STUDENT MOTIVATION</Text>
                  <Text style={styles.cardMainTitle}>Behavior Momentum</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: Colors.pastels.lavenderBg }]}>
                  <Text style={[styles.statusBadgeText, { color: Colors.pastels.lavenderText }]}>
                    {positiveRatio}% Positive Ratio
                  </Text>
                </View>
              </View>

              {/* Dual-color Momentum Bar */}
              <View style={styles.segmentedProgressBar}>
                <View
                  style={[
                    styles.segmentPresent,
                    { flex: Math.max(positiveRatio, 5), backgroundColor: Colors.teal },
                  ]}
                />
                <View
                  style={[
                    styles.segmentAbsent,
                    { flex: Math.max(100 - positiveRatio, 5), backgroundColor: '#FDA4AF' },
                  ]}
                />
              </View>

              <View style={styles.momentumGrid}>
                <View style={[styles.momentumCard, { backgroundColor: Colors.pastels.mintBg, borderColor: Colors.pastels.mintBorder }]}>
                  <Text style={styles.momentumLabel}>POSITIVE ACTIONS</Text>
                  <Text style={[styles.momentumValue, { color: Colors.pastels.mintText }]}>
                    +{positiveCount}
                  </Text>
                  <Text style={styles.momentumSub}>Commendations logged</Text>
                </View>

                <View style={[styles.momentumCard, { backgroundColor: Colors.pastels.roseBg, borderColor: Colors.pastels.roseBorder }]}>
                  <Text style={styles.momentumLabel}>GUIDANCE ACTIONS</Text>
                  <Text style={[styles.momentumValue, { color: Colors.pastels.roseText }]}>
                    -{negativeCount}
                  </Text>
                  <Text style={styles.momentumSub}>Needs improvement</Text>
                </View>
              </View>
            </View>

            {/* Classroom Comparative Health Leaderboard */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardPreTitle}>BENCHMARKING</Text>
                  <Text style={styles.cardMainTitle}>Classroom Health Index</Text>
                </View>
              </View>

              {classes.map((cls) => {
                const avg = cls.attendanceAvg ?? 0;
                const isPassing = avg >= cls.min_attendance_percentage;
                return (
                  <View key={cls.id} style={styles.benchmarkRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.benchmarkTitle} numberOfLines={1}>
                        {cls.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={styles.benchmarkMeta}>
                          {cls.studentCount} Students
                        </Text>
                        <Text style={styles.benchmarkMeta}>•</Text>
                        <Text style={styles.benchmarkMeta}>
                          Min: {cls.min_attendance_percentage}%
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.benchmarkAvg,
                          {
                            color:
                              cls.attendanceAvg !== null
                                ? isPassing
                                  ? Colors.tealDark
                                  : Colors.errorDark
                                : Colors.textTertiary,
                          },
                        ]}
                      >
                        {cls.attendanceAvg !== null ? `${cls.attendanceAvg}%` : 'Pending'}
                      </Text>
                      <View
                        style={[
                          styles.benchmarkPill,
                          {
                            backgroundColor: isPassing
                              ? Colors.pastels.mintBg
                              : Colors.pastels.peachBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.benchmarkPillText,
                            {
                              color: isPassing
                                ? Colors.pastels.mintText
                                : Colors.pastels.peachText,
                            },
                          ]}
                        >
                          {isPassing ? 'On Target' : 'Needs Focus'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: WATCHLIST TAB                                    */}
        {/* ======================================================== */}
        {activeTab === 'watchlist' && (
          <View style={styles.sectionContainer}>
            <View style={styles.watchlistBanner}>
              <View style={styles.watchlistBannerIcon}>
                <AlertCircle size={20} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Text style={styles.watchlistBannerTitle}>Attendance Intervention Pool</Text>
                <Text style={styles.watchlistBannerSubtitle}>
                  Students whose current attendance percentage falls below their classroom's required threshold.
                </Text>
              </View>
            </View>

            {atRiskStudents.length === 0 ? (
              <View style={styles.emptyWatchlistCard}>
                <View style={styles.emptyWatchlistIcon}>
                  <CheckCircle2 size={32} color={Colors.teal} />
                </View>
                <Text style={styles.emptyWatchlistTitle}>All Students are Eligible</Text>
                <Text style={styles.emptyWatchlistText}>
                  Great job! Every student currently satisfies their classroom attendance standard.
                </Text>
              </View>
            ) : (
              atRiskStudents.map((student) => {
                const deficit = student.minRequired - student.percentage;
                return (
                  <View key={student.id} style={styles.atRiskCard}>
                    <View style={styles.atRiskCardHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.atRiskStudentName} numberOfLines={1}>
                          {student.name}
                        </Text>
                        <Text style={styles.atRiskStudentClass} numberOfLines={1}>
                          {student.className}
                        </Text>
                      </View>
                      <View style={styles.atRiskGapBadge}>
                        <Text style={styles.atRiskGapText}>-{deficit}% Deficit</Text>
                      </View>
                    </View>

                    <View style={styles.atRiskBarWrap}>
                      <View style={styles.atRiskProgressBarBg}>
                        <View
                          style={[
                            styles.atRiskProgressBarFill,
                            { width: `${Math.min(student.percentage, 100)}%` },
                          ]}
                        />
                      </View>
                      <View style={styles.atRiskBarValues}>
                        <Text style={styles.atRiskCurrentVal}>
                          Current: <Text style={{ fontWeight: '800' }}>{student.percentage}%</Text>
                        </Text>
                        <Text style={styles.atRiskTargetVal}>
                          Required: {student.minRequired}%
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.atRiskActionBtn}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: '/students/[id]',
                          params: { id: String(student.id) },
                        })
                      }
                    >
                      <Text style={styles.atRiskActionBtnText}>Open Student Profile</Text>
                      <ArrowUpRight size={14} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
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
    fontWeight: '600',
  },
  newClassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    ...Shadows.small,
  },
  newClassPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    ...Shadows.small,
  },
  tabBarItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  tabBarItemActive: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBarItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  tabBarItemTextActive: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  tabBarItemTextRiskActive: {
    color: Colors.errorDark,
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
    ...Shadows.large,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.8,
  },
  realtimePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  realtimeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  heroMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  heroMainRate: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroMainLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
  },
  heroScoreBox: {
    alignItems: 'flex-end',
  },
  heroScoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.6,
  },
  heroScoreVal: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    paddingTop: 14,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.6,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 3,
  },
  pastelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  pastelCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    ...Shadows.small,
  },
  pastelIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pastelCardValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  pastelCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pastelCardMeta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sectionLink: {
    paddingVertical: 4,
  },
  sectionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  pulseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    ...Shadows.small,
  },
  pulseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pulseStatusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pulseClassName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pulseClassMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  pulsePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  pulsePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pulseActionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pulseActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  recentFeedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    ...Shadows.small,
  },
  recentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recentStudentName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  recentReasonText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  recentPointBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  recentPointText: {
    fontSize: 12,
    fontWeight: '800',
  },
  analyticsCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
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
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segmentedProgressBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: Colors.pastels.slateBg,
    marginBottom: 16,
  },
  segmentPresent: {
    height: '100%',
  },
  segmentLate: {
    height: '100%',
  },
  segmentAbsent: {
    height: '100%',
  },
  distributionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distributionStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  distributionDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  distLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  distValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  distPct: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  momentumGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  momentumCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  momentumLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  momentumValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  momentumSub: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  benchmarkTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  benchmarkMeta: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  benchmarkAvg: {
    fontSize: 16,
    fontWeight: '900',
  },
  benchmarkPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  benchmarkPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  watchlistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  watchlistBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchlistBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.errorDark,
  },
  watchlistBannerSubtitle: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 15,
  },
  emptyWatchlistCard: {
    backgroundColor: Colors.white,
    padding: 36,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyWatchlistIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.pastels.mintBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyWatchlistTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyWatchlistText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  atRiskCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
    ...Shadows.small,
  },
  atRiskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  atRiskStudentName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  atRiskStudentClass: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  atRiskGapBadge: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  atRiskGapText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.errorDark,
  },
  atRiskBarWrap: {
    marginBottom: 12,
  },
  atRiskProgressBarBg: {
    height: 7,
    backgroundColor: Colors.pastels.slateBg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  atRiskProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.error,
    borderRadius: 4,
  },
  atRiskBarValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  atRiskCurrentVal: {
    fontSize: 11,
    color: Colors.errorDark,
  },
  atRiskTargetVal: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  atRiskActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    borderRadius: 12,
  },
  atRiskActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
