package models

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Status represents the download state of an episode.
type Status string

const (
	StatusWanted      Status = "wanted"
	StatusQueued      Status = "queued"
	StatusDownloading Status = "downloading"
	StatusDownloaded  Status = "downloaded"
	StatusFailed      Status = "failed"
)

// Config holds the application configuration persisted to config.json.
type Config struct {
	DownloadDir    string `json:"downloadDir"`
	TV4Token       string `json:"tv4Token"`
	TV4TokenExpiry int64  `json:"tv4TokenExpiry"`
	MaxWorkers     int    `json:"maxWorkers"`
	Port           int    `json:"port"`
}

// DefaultConfig returns sensible defaults for a fresh install.
func DefaultConfig() Config {
	return Config{
		DownloadDir: "./downloads",
		MaxWorkers:  2,
		Port:        5859,
	}
}

// Episode represents a single episode within a tracked show.
type Episode struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Season     int    `json:"season"`
	Episode    int    `json:"episode"`
	URL        string `json:"url"`
	ImageURL   string `json:"imageUrl"`
	AirDate    string `json:"airDate"`
	Status     Status `json:"status"`
	FilePath   string `json:"filePath"`
	ExternalID string `json:"externalId"`
}

// Show represents a tracked TV series.
type Show struct {
	ID               string    `json:"id"`
	Title            string    `json:"title"`
	URL              string    `json:"url"`
	ImageURL         string    `json:"imageUrl"`
	Source           string    `json:"source"`
	Episodes         []Episode `json:"episodes"`
	PreferredQuality string    `json:"preferredQuality"`
	DownloadPath     string    `json:"downloadPath"`
}

// ShowsFile is the top-level wrapper for shows.json.
type ShowsFile struct {
	Shows []Show `json:"shows"`
}

// jwtPayload is the minimal JWT claims we care about.
type jwtPayload struct {
	Exp int64 `json:"exp"`
}

// DecodeTV4TokenExpiry extracts the expiration unix timestamp
// from a TV4 JWT token by decoding the payload segment.
// No signature verification — we only need the expiry for display.
func DecodeTV4TokenExpiry(token string) (int64, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return 0, fmt.Errorf("invalid JWT: expected 3 parts, got %d", len(parts))
	}

	payload := parts[1]
	// JWT uses base64url without padding
	if m := len(payload) % 4; m != 0 {
		payload += strings.Repeat("=", 4-m)
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return 0, fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var claims jwtPayload
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return 0, fmt.Errorf("failed to parse JWT payload: %w", err)
	}

	if claims.Exp == 0 {
		return 0, fmt.Errorf("JWT payload has no exp claim")
	}

	return claims.Exp, nil
}

// TV4TokenExpiryTime returns the expiry as a time.Time for convenience.
func TV4TokenExpiryTime(token string) (time.Time, error) {
	exp, err := DecodeTV4TokenExpiry(token)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(exp, 0), nil
}
