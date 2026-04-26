import '@testing-library/jest-native/extend-expect';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  Stack: {
    Screen: 'Stack.Screen'
  }
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 52.52, longitude: 13.405 } }))
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' }))
}));

jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null })
      })),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } })
      }
    }))
  };
});
