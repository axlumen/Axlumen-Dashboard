/**
 * WeatherService.ts — 天气数据服务
 *
 * 从 apex-dashboard 适配：使用 Open-Meteo API（免费，无需 API key），
 * 支持缓存和多数据源回退。
 */

import { requestUrl } from 'obsidian';
import type { WeatherConfig, WeatherData } from '../types';
import { getCacheService, CACHE_KEYS } from './CacheService';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function getCachedWeather(config: WeatherConfig): WeatherData | null {
  const key = `${CACHE_KEYS.WEATHER}:${config.latitude},${config.longitude}`;
  return getCacheService().get<WeatherData>(key, CACHE_TTL);
}

export async function fetchWeather(config: WeatherConfig): Promise<WeatherData> {
  const cached = getCachedWeather(config);
  if (cached) return cached;

  try {
    const data = await fetchFromOpenMeteo(config);
    const key = `${CACHE_KEYS.WEATHER}:${config.latitude},${config.longitude}`;
    getCacheService().set(key, data);
    return data;
  } catch { /* try next */ }

  try {
    const data = await fetchFromWttr(config);
    const key = `${CACHE_KEYS.WEATHER}:${config.latitude},${config.longitude}`;
    getCacheService().set(key, data);
    return data;
  } catch { /* all failed */ }

  throw new Error('所有天气 API 均不可用');
}

/**
 * Open-Meteo API（主要数据源）
 */
async function fetchFromOpenMeteo(config: WeatherConfig): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;

  const resp = await requestUrl({ url });
  const json = resp.json as any;

  const current = json.current;
  const daily = json.daily;

  if (!current || !daily) {
    throw new Error('无效的天气 API 响应');
  }

  return {
    temperature: typeof current.temperature_2m === 'number' ? current.temperature_2m : 0,
    weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
    windSpeed: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0,
    humidity: typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 0,
    feelsLike: typeof current.apparent_temperature === 'number' ? current.apparent_temperature : 0,
    dailyMax: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max.slice(0, 5) : [],
    dailyMin: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min.slice(0, 5) : [],
    dailyCodes: Array.isArray(daily.weather_code) ? daily.weather_code.slice(0, 5) : [],
    dailyDates: Array.isArray(daily.time) ? daily.time.slice(0, 5) : [],
    fetchedAt: Date.now(),
  };
}

/**
 * wttr.in API（回退数据源）
 */
async function fetchFromWttr(config: WeatherConfig): Promise<WeatherData> {
  const url = `https://wttr.in/${config.latitude},${config.longitude}?format=j1`;

  const resp = await requestUrl({ url });
  const json = resp.json as any;

  const current = json.current_condition?.[0];
  const weather = json.weather;

  if (!current || !weather) {
    throw new Error('wttr.in 响应无效');
  }

  return {
    temperature: parseFloat(current.temp_C) || 0,
    weatherCode: parseInt(current.weatherCode) || 0,
    windSpeed: parseFloat(current.windspeedKmph) || 0,
    humidity: parseInt(current.humidity) || 0,
    feelsLike: parseFloat(current.FeelsLikeC) || 0,
    dailyMax: weather.slice(0, 5).map((w: any) => parseFloat(w.maxtempC) || 0),
    dailyMin: weather.slice(0, 5).map((w: any) => parseFloat(w.mintempC) || 0),
    dailyCodes: weather.slice(0, 5).map((w: any) => parseInt(w.hourly?.[4]?.weatherCode) || 0),
    dailyDates: weather.slice(0, 5).map((w: any) => w.date || ''),
    fetchedAt: Date.now(),
  };
}

/**
 * WMO 天气代码 → 中文描述
 */
export function weatherCodeToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: '晴',
    1: '大部晴', 2: '多云', 3: '阴',
    45: '雾', 48: '雾凇',
    51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
    56: '冻毛毛雨', 57: '大冻毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    66: '冻雨', 67: '大冻雨',
    71: '小雪', 73: '中雪', 75: '大雪',
    77: '雪粒',
    80: '小阵雨', 81: '阵雨', 82: '大阵雨',
    85: '小阵雪', 86: '大阵雪',
    95: '雷暴', 96: '雷暴+小冰雹', 99: '雷暴+大冰雹',
  };
  return descriptions[code] || '未知';
}

/**
 * WMO 天气代码 → emoji
 */
export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌧️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}
