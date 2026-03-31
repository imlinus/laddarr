# Laddarr

A lightweight, high-performance self-hosted PVR for Swedish TV. Automated SVT Play and TV4 Play downloads using [svtplay-dl](https://github.com/spaam/svtplay-dl).

## Features
- Automated Tracking: Monitor shows for new episodes and download them automatically.
- Glassmorphism Web-UI: Modern interface with real-time download status.
- Kanban Calendar: Historical and upcoming release tracking.
- Native Swedish Support: Handles relative dates and timezone offsets.
- Custom Library Rules: Per-show download paths and quality preferences.

## Usage

Laddarr is currently in active development.

### Prerequisites
- [svtplay-dl](https://github.com/spaam/svtplay-dl) (must be in `PATH`)
- Go 1.21+ (to build)

### Build
```bash
go build -o laddarr ./cmd/laddarr
```

### Run
```bash
./laddarr
```

Laddarr listens on port **5859** by default. Browse to [http://localhost:5859](http://localhost:5859) to add shows.

