package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/imlinus/laddarr/internal/models"
)

// Store provides thread-safe access to the JSON files on disk.
type Store struct {
	dir string
	mu  sync.RWMutex
}

func (s *Store) DataDir() string { return s.dir }

// New creates a Store rooted at the given data directory.
// It ensures the directory exists and initialises default files
// if they are missing.
func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	s := &Store{dir: dir}

	// Bootstrap config.json if absent.
	cfgPath := s.configPath()
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		cfg := models.DefaultConfig()
		if err := s.writeJSON(cfgPath, cfg); err != nil {
			return nil, fmt.Errorf("init config: %w", err)
		}
	}

	// Bootstrap shows.json if absent.
	showsPath := s.showsPath()
	if _, err := os.Stat(showsPath); os.IsNotExist(err) {
		sf := models.ShowsFile{Shows: []models.Show{}}
		if err := s.writeJSON(showsPath, sf); err != nil {
			return nil, fmt.Errorf("init shows: %w", err)
		}
	}

	return s, nil
}

// -- Config -------------------------------------------------------------------

func (s *Store) configPath() string {
	return filepath.Join(s.dir, "config.json")
}

// GetConfig reads and returns the current configuration.
func (s *Store) GetConfig() (models.Config, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var cfg models.Config
	if err := s.readJSON(s.configPath(), &cfg); err != nil {
		return cfg, err
	}

	// Compute TV4 token expiry on read so the frontend always
	// gets an up-to-date value.
	if cfg.TV4Token != "" {
		exp, err := models.DecodeTV4TokenExpiry(cfg.TV4Token)
		if err == nil {
			cfg.TV4TokenExpiry = exp
		}
	}

	return cfg, nil
}

// SaveConfig writes the configuration to disk.
func (s *Store) SaveConfig(cfg models.Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if cfg.TV4Token != "" {
		exp, err := models.DecodeTV4TokenExpiry(cfg.TV4Token)
		if err == nil {
			cfg.TV4TokenExpiry = exp
		}
	}

	return s.writeJSON(s.configPath(), cfg)
}

// -- Shows --------------------------------------------------------------------

func (s *Store) showsPath() string {
	return filepath.Join(s.dir, "shows.json")
}

// GetShows returns all tracked shows.
func (s *Store) GetShows() ([]models.Show, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var sf models.ShowsFile
	if err := s.readJSON(s.showsPath(), &sf); err != nil {
		return nil, err
	}
	return sf.Shows, nil
}

// GetShow returns a single show by ID.
func (s *Store) GetShow(id string) (models.Show, error) {
	shows, err := s.GetShows()
	if err != nil {
		return models.Show{}, err
	}
	for _, sh := range shows {
		if sh.ID == id {
			return sh, nil
		}
	}
	return models.Show{}, fmt.Errorf("show %q not found", id)
}

// AddShow persists a new show to disk.
func (s *Store) AddShow(show models.Show) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var sf models.ShowsFile
	if err := s.readJSON(s.showsPath(), &sf); err != nil {
		return err
	}

	sf.Shows = append(sf.Shows, show)
	return s.writeJSON(s.showsPath(), sf)
}

// DeleteShow removes a show by ID.
func (s *Store) DeleteShow(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var sf models.ShowsFile
	if err := s.readJSON(s.showsPath(), &sf); err != nil {
		return err
	}

	filtered := sf.Shows[:0]
	for _, sh := range sf.Shows {
		if sh.ID != id {
			filtered = append(filtered, sh)
		}
	}
	sf.Shows = filtered
	return s.writeJSON(s.showsPath(), sf)
}

// UpdateShow applies a mutation function to a single show.
func (s *Store) UpdateShow(id string, updateFn func(*models.Show)) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var sf models.ShowsFile
	if err := s.readJSON(s.showsPath(), &sf); err != nil {
		return err
	}

	for i := range sf.Shows {
		if sf.Shows[i].ID == id {
			updateFn(&sf.Shows[i])
			return s.writeJSON(s.showsPath(), sf)
		}
	}
	return fmt.Errorf("show %q not found", id)
}

// UpdateEpisodeStatus updates the status (and optional filePath) of a
// single episode across all shows.
func (s *Store) UpdateEpisodeStatus(episodeID string, status models.Status, filePath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var sf models.ShowsFile
	if err := s.readJSON(s.showsPath(), &sf); err != nil {
		return err
	}

	for i := range sf.Shows {
		for j := range sf.Shows[i].Episodes {
			if sf.Shows[i].Episodes[j].ID == episodeID {
				sf.Shows[i].Episodes[j].Status = status
				if filePath != "" {
					sf.Shows[i].Episodes[j].FilePath = filePath
				}
				return s.writeJSON(s.showsPath(), sf)
			}
		}
	}

	return fmt.Errorf("episode %q not found", episodeID)
}

// SaveShows replaces the entire shows list (used by the metadata scraper).
func (s *Store) SaveShows(shows []models.Show) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeJSON(s.showsPath(), models.ShowsFile{Shows: shows})
}

// -- Helpers ------------------------------------------------------------------

func (s *Store) readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	return json.Unmarshal(data, v)
}

// writeJSON writes atomically: tmp file → rename.
func (s *Store) writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename: %w", err)
	}
	return nil
}
