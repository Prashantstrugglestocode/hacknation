import { isDemoMode, setDemoMode, getDemoOverrides } from './demo-mode';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('demo-mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false if demo mode is not set', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await isDemoMode();
    expect(result).toBe(false);
  });

  it('should return true if demo mode is set to true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
    const result = await isDemoMode();
    expect(result).toBe(true);
  });

  it('should set demo mode and store it in AsyncStorage', async () => {
    await setDemoMode(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@citywallet_demo_mode', 'true');
    
    await setDemoMode(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@citywallet_demo_mode', 'false');
  });

  it('should return deterministic demo overrides', () => {
    const overrides = getDemoOverrides();
    expect(overrides).toEqual({
      weatherCondition: 'Rain',
      tempC: 8,
      movement: 'browsing',
    });
  });
});
