import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, GraduationCap, User } from 'lucide-react-native';
import { Colors, Shadows } from '../../constants/theme';

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 6 : 16;
  const CAPSULE_HEIGHT = 70;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Hide the floating tab bar when keyboard is active to eliminate any overlap or input conflicts
  if (isKeyboardVisible) {
    return null;
  }

  const getIcon = (routeName: string, focused: boolean) => {
    const iconColor = focused ? Colors.accent : '#94A3B8';
    const strokeWidth = focused ? 2.4 : 2.0;

    switch (routeName) {
      case 'dashboard':
        return <LayoutDashboard color={iconColor} size={22} strokeWidth={strokeWidth} />;
      case 'classes':
        return <GraduationCap color={iconColor} size={24} strokeWidth={strokeWidth} />;
      case 'profile':
        return <User color={iconColor} size={22} strokeWidth={strokeWidth} />;
      default:
        return <LayoutDashboard color={iconColor} size={22} strokeWidth={strokeWidth} />;
    }
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'dashboard':
        return 'Dashboard';
      case 'classes':
        return 'Classes';
      case 'profile':
        return 'Profile';
      default:
        return routeName;
    }
  };

  return (
    <View
      style={[
        styles.capsule,
        {
          bottom: bottomOffset,
          height: CAPSULE_HEIGHT,
        },
      ]}
      pointerEvents="box-none"
    >
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
              {getIcon(route.name, focused)}
              <Text
                style={[
                  styles.tabLabel,
                  focused && styles.tabLabelFocused,
                ]}
                numberOfLines={1}
              >
                {getLabel(route.name)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false, // Screens use AppHeader modeled after Asaan Taqreeb
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="classes" options={{ title: 'My Classes' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 24,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.1)',
    ...Shadows.capsule,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  iconWrapFocused: {
    backgroundColor: Colors.primaryMuted,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  tabLabelFocused: {
    color: Colors.accent,
    fontWeight: '800',
  },
});
