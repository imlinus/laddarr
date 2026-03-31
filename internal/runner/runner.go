package runner

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/imlinus/laddarr/internal/models"
)

// Result holds the outcome of an svtplay-dl invocation.
type Result struct {
	Success  bool
	FilePath string
	Output   string
}

// Download runs svtplay-dl for a single episode and returns the result.
func Download(cfg *models.Config, show *models.Show, ep *models.Episode, onProgress func(string)) Result {
	baseDir := cfg.DownloadDir
	if show.DownloadPath != "" {
		baseDir = show.DownloadPath
	}

	seasonName := "Specials"
	if ep.Season > 0 {
		seasonName = fmt.Sprintf("Season %d", ep.Season)
	}

	// target directory
	showDir := filepath.Join(baseDir, sanitise(show.Title), seasonName)
	_ = os.MkdirAll(showDir, 0755)

	// target filename: S01E01 - Title or 2026-03-27 - Title
	filename := sanitise(ep.Title)
	if ep.Season > 2000 {
		datePrefix := fmt.Sprintf("%d", ep.Season)
		if ep.AirDate != "" {
			if t, err := time.Parse(time.RFC3339, ep.AirDate); err == nil {
				datePrefix = t.Format("2006-01-02")
			}
		}
		filename = fmt.Sprintf("%s - %s", datePrefix, sanitise(ep.Title))
	} else if ep.Season > 0 && ep.Episode > 0 {
		filename = fmt.Sprintf("S%02dE%02d - %s", ep.Season, ep.Episode, sanitise(ep.Title))
	} else if ep.Season > 0 {
		filename = fmt.Sprintf("S%02d - %s", ep.Season, sanitise(ep.Title))
	}

	binary := "svtplay-dl"

	// SVT Play Bypass (svtplay-dl is currently broken for SVT homepages)
	downloadURL := ep.URL
	if show.Source == "svt" && ep.ExternalID != "" {
		if m, err := fetchSVTManifest(ep.ExternalID); err == nil && m != "" {
			log.Printf("[runner] bypassing svt extractor using manifest: %s", m)
			downloadURL = m
		}
	}

	args := []string{
		"--output", filepath.Join(showDir, filename),
		"--all-subtitles",
		"--force",
	}

	// Token for TV4 Play if configured
	if show.Source == "tv4" && cfg.TV4Token != "" {
		args = append(args, "--token", cfg.TV4Token)
	}

	// Quality selection: svtplay-dl uses -q / --quality
	if show.PreferredQuality != "" {
		q := strings.TrimSuffix(show.PreferredQuality, "p")
		args = append(args, "--quality", q, "--flexible-quality", "15")
	}

	args = append(args, downloadURL)

	log.Printf("[runner] %s %s", binary, strings.Join(args, " "))

	cmd := exec.Command(binary, args...)
	stdout, _ := cmd.StdoutPipe()
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		log.Printf("[runner] start failed: %v", err)
		return Result{Success: false, Output: err.Error()}
	}

	var output bytes.Buffer
	// Create a scanner that splits on both \n and \r
	scanner := bufio.NewScanner(stdout)
	scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		for i := 0; i < len(data); i++ {
			if data[i] == '\n' || data[i] == '\r' {
				return i + 1, data[0:i], nil
			}
		}
		if atEOF {
			return len(data), data, nil
		}
		return 0, nil, nil
	})

	for scanner.Scan() {
		line := scanner.Text()
		output.WriteString(line + "\n")
		if onProgress != nil {
			// svtplay-dl progress patterns: [45.2%][############        ] or [123/456][====...]
			if strings.Contains(line, "%]") || (strings.Contains(line, "[") && strings.Contains(line, "/")) || strings.Contains(line, "ETA:") {
				onProgress(strings.TrimSpace(line))
			}
		}
	}

	err := cmd.Wait()
	combined := output.String()

	if err != nil {
		log.Printf("[runner] failed: %v\n%s", err, combined)
		return Result{Success: false, Output: combined}
	}

	// svtplay-dl usually places files directly in output dir with remuxed extension (mp4/mkv)
	// We'll return the directory as a hint.
	return Result{
		Success:  true,
		FilePath: showDir,
		Output:   combined,
	}
}

// sanitise makes a string safe for use as a directory name.
func sanitise(name string) string {
	r := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
	)
	return r.Replace(name)
}

func fetchSVTManifest(svtID string) (string, error) {
	resp, err := http.Get("https://api.svt.se/video/" + svtID)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var data struct {
		VideoReferences []struct {
			URL string `json:"url"`
		} `json:"videoReferences"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	// Prefer .m3u8 (HLS)
	for _, ref := range data.VideoReferences {
		if strings.Contains(ref.URL, ".m3u8") {
			return ref.URL, nil
		}
	}
	// Fallback to anything
	if len(data.VideoReferences) > 0 {
		return data.VideoReferences[0].URL, nil
	}

	return "", fmt.Errorf("no video references for %s", svtID)
}
