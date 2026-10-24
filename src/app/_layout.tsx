import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const inAuthGroup = segments[0] === 'login' || segments[0] === undefined;

        if (!session && !inAuthGroup) {
          router.replace('/login');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [segments, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F8FAFC' },
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="classes/create" options={{ title: 'Create Class' }} />
      <Stack.Screen name="classes/[id]" options={{ title: 'Class Details' }} />
      <Stack.Screen name="classes/[id]/add-student" options={{ title: 'Add Student' }} />
      <Stack.Screen name="classes/[id]/attendance" options={{ title: 'Attendance' }} />
      <Stack.Screen name="students/[id]" options={{ title: 'Student Profile' }} />
    </Stack>
  );
}
