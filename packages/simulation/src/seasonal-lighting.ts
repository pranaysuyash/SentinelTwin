import SunCalc from "suncalc";
import type { TimeSchedule } from "@sentineltwin/core";

export type SunPosition = {
  altitude: number;
  azimuth: number;
};

export type LightMeasurement = "lux" | "low_lux" | "none";

export type SeasonalLightState = {
  isDaytime: boolean;
  sunPosition: SunPosition;
  exteriorLightLevel: LightMeasurement;
  dawnTime: { hour: number; minute: number } | null;
  duskTime: { hour: number; minute: number } | null;
  goldenHour: boolean;
  twilightPhase: "day" | "civil_twilight" | "nautical_twilight" | "astronomical_twilight" | "night";
  label: string;
};

const TWILIGHT_SUN_ALTITUDE_CIVIL = -6;
const TWILIGHT_SUN_ALTITUDE_NAUTICAL = -12;
const TWILIGHT_SUN_ALTITUDE_ASTRONOMICAL = -18;

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function getSeasonalDate(schedule: TimeSchedule): Date {
  if (schedule.seasonalDate) {
    return new Date(schedule.seasonalDate);
  }
  return new Date();
}

function getPosition(schedule: TimeSchedule): { lat: number; lng: number } | null {
  if (
    schedule.location &&
    typeof schedule.location.latitude === "number" &&
    typeof schedule.location.longitude === "number"
  ) {
    return { lat: schedule.location.latitude, lng: schedule.location.longitude };
  }
  return null;
}

export function computeSeasonalLightState(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): SeasonalLightState | null {
  const position = getPosition(schedule);
  if (!position) return null;

  const date = getSeasonalDate(schedule);
  date.setHours(hour, minute, 0, 0);

  const times = SunCalc.getTimes(date, position.lat, position.lng);
  const sunPos = SunCalc.getPosition(date, position.lat, position.lng);

  const sunAltitudeDeg = toDeg(sunPos.altitude);
  const sunAzimuthDeg = toDeg(sunPos.azimuth);

  const timeOfDayMinutes = hour * 60 + minute;
  const dawnMinutes = times.sunrise ? times.sunrise.getHours() * 60 + times.sunrise.getMinutes() : 0;
  const duskMinutes = times.sunset ? times.sunset.getHours() * 60 + times.sunset.getMinutes() : 0;

  let twilightPhase: SeasonalLightState["twilightPhase"];
  let exteriorLightLevel: LightMeasurement;
  let isDaytime: boolean;
  let label: string;

  if (sunAltitudeDeg >= 0) {
    isDaytime = true;
    twilightPhase = "day";
    label = "Daylight";
  } else if (sunAltitudeDeg > TWILIGHT_SUN_ALTITUDE_CIVIL) {
    isDaytime = false;
    twilightPhase = "civil_twilight";
    label = "Civil Twilight";
  } else if (sunAltitudeDeg > TWILIGHT_SUN_ALTITUDE_NAUTICAL) {
    isDaytime = false;
    twilightPhase = "nautical_twilight";
    label = "Nautical Twilight";
  } else if (sunAltitudeDeg > TWILIGHT_SUN_ALTITUDE_ASTRONOMICAL) {
    isDaytime = false;
    twilightPhase = "astronomical_twilight";
    label = "Astronomical Twilight";
  } else {
    isDaytime = false;
    twilightPhase = "night";
    label = "Night";
  }

  const isGoldenHour = sunAltitudeDeg > -6 && sunAltitudeDeg < 6;

  if (isDaytime) {
    exteriorLightLevel = "lux";
  } else if (twilightPhase === "civil_twilight") {
    exteriorLightLevel = "low_lux";
  } else {
    exteriorLightLevel = "none";
  }

  const dawnTime = times.sunrise
    ? { hour: times.sunrise.getHours(), minute: times.sunrise.getMinutes() }
    : null;
  const duskTime = times.sunset
    ? { hour: times.sunset.getHours(), minute: times.sunset.getMinutes() }
    : null;

  return {
    isDaytime,
    sunPosition: {
      altitude: sunAltitudeDeg,
      azimuth: sunAzimuthDeg,
    },
    exteriorLightLevel,
    dawnTime,
    duskTime,
    goldenHour: isGoldenHour,
    twilightPhase,
    label,
  };
}

export function getExteriorLightStateSeasonal(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): { on: boolean; label: string } {
  const seasonal = computeSeasonalLightState(hour, minute, schedule);

  if (!seasonal) {
    return { on: false, label: "No location data" };
  }

  if (seasonal.isDaytime) {
    return { on: false, label: seasonal.label };
  }

  if (seasonal.twilightPhase === "civil_twilight") {
    return { on: true, label: "Twilight" };
  }

  return { on: true, label: seasonal.label };
}

export function estimateExteriorLux(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): number {
  const seasonal = computeSeasonalLightState(hour, minute, schedule);

  if (!seasonal) return -1;

  const alt = seasonal.sunPosition.altitude;

  if (alt > 15) return 50000;
  if (alt > 5) return 10000;
  if (alt > 0) return 1000;
  if (alt > -6) return 100;
  if (alt > -12) return 10;
  if (alt > -18) return 1;
  return 0;
}

export function computeTwilightPeriods(
  schedule: TimeSchedule,
): { dawn: { hour: number; minute: number }; dusk: { hour: number; minute: number } } | null {
  const position = getPosition(schedule);
  if (!position) return null;

  const date = getSeasonalDate(schedule);
  const times = SunCalc.getTimes(date, position.lat, position.lng);

  if (!times.sunrise || !times.sunset) return null;

  return {
    dawn: { hour: times.sunrise.getHours(), minute: times.sunrise.getMinutes() },
    dusk: { hour: times.sunset.getHours(), minute: times.sunset.getMinutes() },
  };
}
