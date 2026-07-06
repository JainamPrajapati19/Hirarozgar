// @testing-library/react-native v14+ includes matchers automatically — no extend-expect import needed

// Skip RNTL's auto-cleanup to prevent race conditions with test-renderer@1.x's
// async scheduler. Tests handle cleanup manually in their afterEach hooks.
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Defs: 'Defs',
  Circle: 'Circle',
}));
