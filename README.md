# Laddarr

A lightweight, high-performance self-hosted PVR for Swedish TV. Automated SVT Play and TV4 Play downloads powered by [svtplay-dl](https://github.com/spaam/svtplay-dl).

## ✨ Features
- **Automated Tracking**: Monitor shows for new episodes and download them automatically.
- **Glassmorphism UI**: A stunning, modern web interface with blurred backgrounds and vibrant accents.
- **Kanban Calendar**: Track upcoming and historical releases in a weekly calendar view.
- **Real-Time Queue**: Monitor active downloads with live progress bars and ETA updates.
- **Swedish Native Support**: Handles Swedish relative dates and timezone offsets out of the box.
- **Flexible Downloads**: Support for custom download paths and quality preferences per show.

## 🚀 Getting Started

Laddarr is currently in active development.

### Prerequisites
1. [svtplay-dl](https://github.com/spaam/svtplay-dl) installed and available in your `PATH`.
2. [Go](https://go.dev/) 1.21+ installed (for building).

### Installation
```bash
git clone https://github.com/imlinus/laddarr.git
cd laddarr
go build -o laddarr ./cmd/laddarr
```

### Usage
Run the binary:
```bash
./laddarr
```

By default, Laddarr listens on **port 5859**. Browse to [http://localhost:5859](http://localhost:5859) to start adding shows.

---
*Built with ❤️ for the Swedish TV community.*

