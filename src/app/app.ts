import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription, timer, switchMap } from 'rxjs';
import * as L from 'leaflet';
import { BILLUND, RADIUS_KM, Flight, OpenSkyService } from './opensky.service';
import { QuizGate } from './quiz-gate';

const REFRESH_MS = 15_000;

@Component({
  selector: 'app-root',
  imports: [
    DecimalPipe,
    DatePipe,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatProgressBarModule,
    QuizGate,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit, OnDestroy {
  private readonly opensky = inject(OpenSkyService);
  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');

  protected readonly unlocked = signal(false);
  protected readonly flights = signal<Flight[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly radiusKm = RADIUS_KM;

  private map!: L.Map;
  private markerLayer!: L.LayerGroup;
  private poll?: Subscription;

  ngAfterViewInit(): void {
    this.initMap();
  }

  /** Called once the quiz gate is passed: reveal the app and start polling. */
  protected onUnlocked(): void {
    if (this.unlocked()) return;
    this.unlocked.set(true);
    // Map was created behind the gate overlay; recompute its size now visible.
    setTimeout(() => this.map.invalidateSize());
    this.poll = timer(0, REFRESH_MS)
      .pipe(switchMap(() => this.opensky.getFlights()))
      .subscribe({
        next: (flights) => {
          this.flights.set(flights);
          this.error.set(null);
          this.loading.set(false);
          this.lastUpdated.set(new Date());
          this.renderMarkers(flights);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err?.status === 429
              ? 'OpenSky rate limit reached — retrying shortly.'
              : 'Could not reach OpenSky. Retrying…',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapEl().nativeElement, {
      center: [BILLUND.lat, BILLUND.lon],
      zoom: 8,
    });

    // Minimalist dark basemap (CARTO dark matter, labels only where useful).
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(this.map);

    // Airport marker + the 80 km search circle.
    L.circleMarker([BILLUND.lat, BILLUND.lon], {
      radius: 5,
      color: '#ff5252',
      fillColor: '#ff5252',
      fillOpacity: 1,
      weight: 0,
    })
      .addTo(this.map)
      .bindTooltip('Billund Airport (BLL)');

    L.circle([BILLUND.lat, BILLUND.lon], {
      radius: RADIUS_KM * 1000,
      color: '#5e9eff',
      weight: 1,
      fillColor: '#5e9eff',
      fillOpacity: 0.04,
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
  }

  private renderMarkers(flights: Flight[]): void {
    this.markerLayer.clearLayers();
    for (const f of flights) {
      L.marker([f.lat, f.lon], { icon: planeIcon(f.heading ?? 0) })
        .addTo(this.markerLayer)
        .bindTooltip(this.tooltip(f));
    }
  }

  protected focus(f: Flight): void {
    this.map.setView([f.lat, f.lon], 10, { animate: true });
  }

  private tooltip(f: Flight): string {
    const alt = f.altitude != null ? `${Math.round(f.altitude)} m` : 'n/a';
    return `${f.callsign} · ${f.originCountry} · ${alt}`;
  }
}

/** Inline SVG plane rotated to the aircraft's heading. */
function planeIcon(heading: number): L.DivIcon {
  const svg = `
    <svg viewBox="0 0 24 24" width="26" height="26"
         style="transform: rotate(${heading}deg); transform-origin: 50% 50%;">
      <path fill="#e6edf3" stroke="#0d1117" stroke-width="0.8"
        d="M12 2 13 9 22 13 22 15 13 13 13 19 16 21 16 22 12 21 8 22 8 21 11 19 11 13 2 15 2 13 11 9Z"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'plane-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}
