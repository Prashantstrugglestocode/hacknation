import { getClientWeather } from './weather';

global.fetch = jest.fn();

describe('weather', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch weather and map WMO code 0 to Clear', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 20.4, weather_code: 0 }
      })
    });

    const weather = await getClientWeather(52.5, 13.4);
    expect(weather).toEqual({ tempC: 20, condition: 'Clear' });
  });

  it('should map WMO code 61 to Rain', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 10, weather_code: 61 }
      })
    });

    const weather = await getClientWeather(52.5, 13.4);
    expect(weather).toEqual({ tempC: 10, condition: 'Rain' });
  });

  it('should fallback to 15C Clear on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const weather = await getClientWeather(52.5, 13.4);
    expect(weather).toEqual({ tempC: 15, condition: 'Clear' });
  });

  it('should fallback on non-ok HTTP response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    const weather = await getClientWeather(52.5, 13.4);
    expect(weather).toEqual({ tempC: 15, condition: 'Clear' });
  });
});
