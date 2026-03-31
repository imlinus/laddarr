# Laddarr

A lightweight self-hosted PVR for Swedish TV. Automated SVT Play and TV4 Play downloads using [svtplay-dl](https://github.com/spaam/svtplay-dl).

## Features
- Automated Tracking: Monitor shows for new episodes.
- Calendar View: See upcoming releases for tracked shows.
- Headless Operation: Runs in the background with a simple web-based UI.

## Usage

It's currently in development and prone to bugs, so there's no official release yet.

If you want to build it yourself, first make sure you have [svtplay-dl](https://github.com/spaam/svtplay-dl) installed and in your `PATH`.

Then clone this repo and run:

```bash
go build -o laddarr ./cmd/laddarr
```

Then run it:
```bash
./laddarr
```

Then browse to [http://localhost:5859](http://localhost:5859) to add shows.

