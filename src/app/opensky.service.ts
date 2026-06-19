import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/** Billund Airport (BLL) reference point. */
export const BILLUND = { lat: 55.7403, lon: 9.1518 } as const;
export const RADIUS_KM = 80;

/** A single aircraft, parsed from OpenSky's positional `state vector` array. */
export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  /** Barometric altitude in metres (may be null when on ground). */
  altitude: number | null;
  onGround: boolean;
  /** Ground speed in m/s. */
  velocity: number | null;
  /** True track / heading in degrees (0 = north, clockwise). */
  heading: number | null;
  verticalRate: number | null;
  /** Great-circle distance from Billund in km. */
  distanceKm: number;
}

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

/**
 * Thin client over the OpenSky Network REST API.
 *
 * The `/states/all` endpoint only accepts a lat/lon bounding box, so we request
 * the box that encloses an 80 km circle around Billund and filter to a true
 * circle client-side.
 *
 * Currently anonymous (rate-limited). To use OAuth2 client credentials later,
 * fetch a bearer token from OpenSky's token endpoint and pass it via the
 * `Authorization` header in `getFlights`.
 */
@Injectable({ providedIn: 'root' })
export class OpenSkyService {
  private readonly http = inject(HttpClient);

  getFlights(): Observable<Flight[]> {
    const box = boundingBox(BILLUND.lat, BILLUND.lon, RADIUS_KM);
    const params = {
      lamin: box.latMin,
      lamax: box.latMax,
      lomin: box.lonMin,
      lomax: box.lonMax,
    };
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    return this.http.get<OpenSkyResponse>(this.endpoint(query)).pipe(
      map((res) => (res.states ?? []).map(parseState)),
      map((flights) =>
        flights
          .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon))
          .filter((f) => f.distanceKm <= RADIUS_KM)
          .sort((a, b) => a.distanceKm - b.distanceKm),
      ),
    );
  }

  /**
   * OpenSky's CORS header only allows its own origin, so the browser cannot call
   * it directly. In dev we route through the Angular dev-server proxy
   * (see proxy.conf.json); in a static production build (e.g. GitHub Pages,
   * where no proxy exists) we route through corsproxy.io, whose free tier allows
   * browser requests from `github.io` (and localhost) origins.
   */
  private endpoint(query: string): string {
    if (isDevMode()) {
      return `/api/states/all?${query}`;
    }
    const target = `https://opensky-network.org/api/states/all?${query}`;
    return `https://corsproxy.io/?url=${encodeURIComponent(target)}`;
  }
}

/** OpenSky state-vector indices we care about. */
function parseState(s: (string | number | boolean | null)[]): Flight {
  const lat = s[6] as number;
  const lon = s[5] as number;
  return {
    icao24: (s[0] as string) ?? '',
    callsign: ((s[1] as string) ?? '').trim() || '—',
    originCountry: (s[2] as string) ?? '',
    lon,
    lat,
    altitude: (s[7] as number) ?? null,
    onGround: (s[8] as boolean) ?? false,
    velocity: (s[9] as number) ?? null,
    heading: (s[10] as number) ?? null,
    verticalRate: (s[11] as number) ?? null,
    distanceKm: haversineKm(BILLUND.lat, BILLUND.lon, lat, lon),
  };
}

/** Bounding box (degrees) that encloses a `radiusKm` circle around lat/lon. */
function boundingBox(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latMin: +(lat - latDelta).toFixed(4),
    latMax: +(lat + latDelta).toFixed(4),
    lonMin: +(lon - lonDelta).toFixed(4),
    lonMax: +(lon + lonDelta).toFixed(4),
  };
}

/** Great-circle distance in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
