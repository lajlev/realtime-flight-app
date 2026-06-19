# Realtime Flight App — Planes around Billund

A minimal Angular 22 app that shows live aircraft within an **80 km radius of
Billund Airport (BLL)** on a Leaflet map, using the
[OpenSky Network REST API](https://openskynetwork.github.io/opensky-api/rest.html).

## Features

- Leaflet + OpenStreetMap map centred on Billund, with the 80 km search circle drawn.
- Aircraft shown as SVG plane markers rotated to their true heading.
- Angular Material toolbar + side list (callsign, country, distance, altitude).
  Click a flight to centre the map on it.
- Polls OpenSky every **15 s** and updates markers + list reactively (signals, zoneless).

## How the 80 km radius works

OpenSky's `/states/all` only accepts a lat/lon **bounding box**, so the app
requests the box enclosing the circle, then filters results to a true 80 km
great-circle radius (haversine) client-side. See `src/app/opensky.service.ts`.

## Run

```bash
npm install
npm start        # ng serve → http://localhost:4200
```

## Build / test

```bash
npm run build
npm test
```

## Authentication

Calls are currently **anonymous** (rate-limited by OpenSky). To use OAuth2
client credentials for higher limits, fetch a bearer token from OpenSky's token
endpoint and add it as an `Authorization` header in
`OpenSkyService.getFlights()` — the service is structured for this.

## Key files

- `src/app/opensky.service.ts` — OpenSky client, bounding box + radius filter, state parsing.
- `src/app/app.ts` — map setup, 15 s polling, marker rendering.
- `src/app/app.html` / `app.scss` — Material toolbar, map, and flight list.
