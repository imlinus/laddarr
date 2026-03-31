package metadata

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/imlinus/laddarr/internal/models"
)

var (
	nextDataRe = regexp.MustCompile(`<script id="__NEXT_DATA__"[^>]*>(.*?)</script>`)
	urqlDataRe = regexp.MustCompile(`window\.URQL_DATA\s*=\s*(\{.*?\});\s*</script>`)
	ogTitleRe  = regexp.MustCompile(`(?i)<meta property="og:title" content="([^"]+)"`)
	ogImageRe  = regexp.MustCompile(`(?i)<meta property="og:image" content="([^"]+)"`)
)

// FetchShow fetches a show page, extracts metadata, and returns a Show
// with its episodes populated.
func FetchShow(url string) (models.Show, error) {
	source := detectSource(url)

	body, err := fetchPage(url)
	if err != nil {
		return models.Show{}, fmt.Errorf("fetch page: %w", err)
	}

	show, err := extractMetadata(body, source)
	if err != nil {
		log.Printf("[metadata] extract metadata failed, falling back to basic: %v", err)
		show = models.Show{
			ID:     generateID(),
			Title:  "Unknown Show",
			URL:    url,
			Source: source,
		}
	}

	show.URL = url
	show.Source = source
	if show.ID == "" {
		show.ID = generateID()
	}

	return show, nil
}

// detectSource returns "svt" or "tv4" based on the URL.
func detectSource(url string) string {
	if strings.Contains(url, "tv4play") || strings.Contains(url, "tv4.se") {
		return "tv4"
	}
	return "svt"
}

func fetchPage(url string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func extractMetadata(htmlBody string, source string) (models.Show, error) {
	if source == "svt" {
		matches := urqlDataRe.FindStringSubmatch(htmlBody)
		if len(matches) >= 2 {
			var raw map[string]any
			if err := json.Unmarshal([]byte(matches[1]), &raw); err == nil {
				if show, err := parseSVTUrql(raw, htmlBody); err == nil {
					return show, nil
				}
			}
		}
	}
	// Fallback to NEXT_DATA
	return parseNextData(htmlBody, source)
}

func parseSVTUrql(raw map[string]any, htmlBody string) (models.Show, error) {
	show := models.Show{
		ID:       generateID(),
		Episodes: []models.Episode{},
	}

	if m := ogTitleRe.FindStringSubmatch(htmlBody); len(m) > 1 {
		show.Title = html.UnescapeString(m[1])
	}
	if m := ogImageRe.FindStringSubmatch(htmlBody); len(m) > 1 {
		show.ImageURL = html.UnescapeString(m[1])
	}

	for _, v := range raw {
		vm, ok := v.(map[string]any)
		if !ok {
			continue
		}
		dataStr, ok := vm["data"].(string)
		if !ok {
			continue
		}
		var data map[string]any
		if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
			continue
		}

		show = parseSVT(show, data)
	}

	if len(show.Episodes) == 0 && show.Title == "" {
		return show, fmt.Errorf("could not find show info in urql data")
	}

	return show, nil
}

// parseNextData extracts show info from the __NEXT_DATA__ script tag.
// The structure differs between SVT and TV4, so we use a broad approach.
func parseNextData(htmlBody string, source string) (models.Show, error) {
	matches := nextDataRe.FindStringSubmatch(htmlBody)
	if len(matches) < 2 {
		return models.Show{}, fmt.Errorf("no __NEXT_DATA__ found")
	}

	var raw map[string]any
	if err := json.Unmarshal([]byte(matches[1]), &raw); err != nil {
		return models.Show{}, fmt.Errorf("json parse: %w", err)
	}

	show := models.Show{
		ID:       generateID(),
		Episodes: []models.Episode{},
	}

	// Navigate into props.pageProps to find title and episode data.
	props, _ := raw["props"].(map[string]any)
	if props == nil {
		return show, fmt.Errorf("no props in __NEXT_DATA__")
	}
	pageProps, _ := props["pageProps"].(map[string]any)
	if pageProps == nil {
		return show, fmt.Errorf("no pageProps")
	}

	// SVT typically has: initialState.videoTitlePage
	// TV4 typically has: apolloState or similar
	switch source {
	case "svt":
		show = parseSVT(show, pageProps)
	case "tv4":
		show = parseTV4(show, props)
	}

	return show, nil
}

func parseSVT(show models.Show, pageProps map[string]any) models.Show {
	// Try multiple known SVT structures
	if title, ok := dig(pageProps, "detailsPage", "heading"); ok {
		show.Title = fmt.Sprint(title)
	} else if title, ok := dig(pageProps, "video", "programTitle"); ok {
		show.Title = fmt.Sprint(title)
	}

	if img, ok := dig(pageProps, "detailsPage", "image", "url"); ok {
		show.ImageURL = html.UnescapeString(fmt.Sprint(img))
	}

	// Look for season/episode lists in tabs
	if tabs, ok := dig(pageProps, "detailsPage", "tabs"); ok {
		if tabList, ok := tabs.([]any); ok {
			for _, tab := range tabList {
				if t, ok := tab.(map[string]any); ok {
					parseEpisodesFromSVTTab(t, &show)
				}
			}
		}
	}

	// Look for season/episode lists in modules (newer SVT style)
	if modules, ok := dig(pageProps, "detailsPageByPath", "modules"); ok {
		if modList, ok := modules.([]any); ok {
			for _, mod := range modList {
				if m, ok := mod.(map[string]any); ok {
					parseEpisodesFromSVTTab(m, &show)
				}
			}
		}
	}

	return show
}

func parseEpisodesFromSVTTab(tab map[string]any, show *models.Show) {
	tabHeading, _ := tab["heading"].(string)
	isSpecials := strings.Contains(strings.ToLower(tabHeading), "extra") || strings.Contains(strings.ToLower(tabHeading), "bakom")

	// Only parse modules that are seasons or upcoming episodes or related series modules
	if st, ok := dig(tab, "selection", "selectionType"); ok {
		sts, _ := st.(string)
		// Filter out clips, recommendations, etc.
		if sts == "clips" || sts == "related" || sts == "recommendation" {
			return
		}
	}

	items := tab["content"]
	if items == nil {
		if sel, ok := tab["selection"].(map[string]any); ok {
			items = sel["items"]
		}
	}
	if items == nil {
		items = tab["items"]
	}
	if items == nil {
		return
	}
	contentList, ok := items.([]any)
	if !ok {
		return
	}
	for _, item := range contentList {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}

		// 2. URL - CRITICAL: Check first and skip if empty
		var u string
		if val, ok := m["url"].(string); ok {
			u = val
		} else if val, ok := dig(m, "item", "urls", "svtplay"); ok {
			u = fmt.Sprint(val)
		}

		if u == "" {
			continue
		}

		if !strings.HasPrefix(u, "http") {
			u = "https://www.svtplay.se" + u
		}

		ep := models.Episode{
			ID:     generateID(),
			URL:    u,
			Status: models.StatusWanted,
		}

		// 1. Title
		if t, ok := m["heading"].(string); ok {
			ep.Title = t
		} else if t, ok := dig(m, "item", "heading"); ok {
			ep.Title = fmt.Sprint(t)
		}

		// 3. Metadata (Season/Episode/Date)
		if d, ok := m["publishDate"].(string); ok {
			ep.AirDate = parseSVTDate(d)
		} else if d, ok := dig(m, "item", "validFromFormatted"); ok {
			ep.AirDate = parseSVTDate(fmt.Sprint(d))
		}

		if vid, ok := dig(m, "item", "videoSvtId"); ok {
			ep.ExternalID, _ = vid.(string)
		}

		// Attempt to parse season/ep from title
		if ep.Title != "" {
			if m := regexp.MustCompile(`(?i)(?:säsong|season)\s*(\d+)`).FindStringSubmatch(ep.Title); len(m) > 1 {
				fmt.Sscanf(m[1], "%d", &ep.Season)
			}
			if m := regexp.MustCompile(`(?i)(?:avsnitt|episode)\s*(\d+)`).FindStringSubmatch(ep.Title); len(m) > 1 {
				fmt.Sscanf(m[1], "%d", &ep.Episode)
			}
		}

		// Fallback for season if not found in title, use module/tab heading
		if ep.Season == 0 {
			if m := regexp.MustCompile(`(?i)(?:säsong|season)\s*(\d+)`).FindStringSubmatch(tabHeading); len(m) > 1 {
				fmt.Sscanf(m[1], "%d", &ep.Season)
			}
		}

		// DEFAULT: If still season 0 and NOT a specials tab, default to year if available, else season 1
		if ep.Season == 0 && !isSpecials {
			if ep.AirDate != "" {
				if t, err := time.Parse(time.RFC3339, ep.AirDate); err == nil {
					ep.Season = t.Year()
				}
			}
			if ep.Season == 0 {
				ep.Season = 1
			}
		}

		// 4. Image
		if img, ok := dig(m, "images", "wide"); ok {
			if im, ok := img.(map[string]any); ok {
				id, _ := im["id"].(string)
				changed, _ := im["changed"].(string)
				if id != "" {
					ep.ImageURL = fmt.Sprintf("https://www.svtstatic.se/image/custom/1144/%s/%s?format=auto", id, changed)
				}
			}
		} else if img, ok := dig(m, "item", "image", "url"); ok {
			ep.ImageURL = html.UnescapeString(fmt.Sprint(img))
		} else if img, ok := dig(m, "image", "url"); ok {
			ep.ImageURL = html.UnescapeString(fmt.Sprint(img))
		}

		show.Episodes = append(show.Episodes, ep)
	}
}

func parseTV4(show models.Show, props map[string]any) models.Show {
	// TV4 has moved data to apolloStateFromServer in __NEXT_DATA__
	apollo, _ := props["apolloStateFromServer"].(map[string]any)
	if apollo == nil {
		// Try deeper in pageProps if version differs
		if pp, ok := props["pageProps"].(map[string]any); ok {
			apollo, _ = pp["apolloState"].(map[string]any)
		}
	}

	if apollo == nil {
		return show
	}

	for _, val := range apollo {
		vm, ok := val.(map[string]any)
		if !ok {
			continue
		}

		typename, _ := vm["__typename"].(string)
		if typename == "Series" {
			if t, ok := vm["title"].(string); ok {
				show.Title = t
			}
			if images, ok := vm["images"].(map[string]any); ok {
				if m169, ok := dig(images, "main16x9", "sourceEncoded"); ok {
					u := fmt.Sprint(m169)
					if strings.Contains(u, "%2F") {
						u, _ = url.QueryUnescape(u)
					}
					show.ImageURL = u
				}
			}
		}

		if typename == "Asset" || typename == "Program" || typename == "Video" {
			ep := models.Episode{
				ID:     generateID(),
				Status: models.StatusWanted,
			}
			if t, ok := vm["title"].(string); ok {
				ep.Title = t
			}
			// TV4 often uses slug or path
			var path string
			if u, ok := vm["url"].(string); ok {
				path = u
			} else if s, ok := vm["slug"].(string); ok {
				path = "/video/" + s
			}

			if path != "" {
				if !strings.HasPrefix(path, "http") {
					path = "https://www.tv4play.se" + path
				}
				ep.URL = path
				if img, ok := dig(vm, "image", "url"); ok {
					ep.ImageURL = html.UnescapeString(fmt.Sprint(img))
				}
				show.Episodes = append(show.Episodes, ep)
			}
		}
	}

	return show
}

// dig navigates nested maps by key path.
func dig(m map[string]any, keys ...string) (any, bool) {
	var current any = m
	for _, k := range keys {
		cm, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = cm[k]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func getKeys(m map[string]any) []string {
	var keys []string
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func generateID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func parseSVTDate(ds string) string {
	if ds == "" {
		return ""
	}

	dsInput := strings.ToLower(ds)
	loc, _ := time.LoadLocation("Europe/Stockholm")
	now := time.Now().In(loc)
	year := now.Year()

	months := map[string]int{
		"jan": 1, "feb": 2, "mar": 3, "apr": 4, "maj": 5, "jun": 6,
		"jul": 7, "aug": 8, "sep": 9, "okt": 10, "nov": 11, "dec": 12,
	}

	// 1. Check for relative dates
	isToday := strings.Contains(dsInput, "idag") || strings.Contains(dsInput, "ikväll") || strings.Contains(dsInput, "i kväll")
	isTomorrow := strings.Contains(dsInput, "imorgon") || strings.Contains(dsInput, "i morgon")

	if isToday || isTomorrow {
		targetDate := now
		if isTomorrow {
			targetDate = now.AddDate(0, 0, 1)
		}

		hour, min := 12, 0
		if m := regexp.MustCompile(`(\d{2}):(\d{2})`).FindStringSubmatch(dsInput); len(m) > 2 {
			fmt.Sscanf(m[1], "%d", &hour)
			fmt.Sscanf(m[2], "%d", &min)
		}

		t := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), hour, min, 0, 0, loc)
		return t.Format(time.RFC3339)
	}

	// 2. Try patterns:
	// "ons 8 apr" or "27 mar" or "fre 10 apr 22:00" or "12 dec 2025"
	hour, min := 12, 0
	if m := regexp.MustCompile(`(\d{2}):(\d{2})`).FindStringSubmatch(dsInput); len(m) > 2 {
		fmt.Sscanf(m[1], "%d", &hour)
		fmt.Sscanf(m[2], "%d", &min)
	}

	reDate := regexp.MustCompile(`(\d+)\s+([a-zåäö]{3})(?:\s+(\d{4}))?`)
	m := reDate.FindStringSubmatch(dsInput)
	if len(m) >= 3 {
		dayStr := m[1]
		monthName := m[2]

		monthVal, ok := months[monthName]
		if ok {
			var day int
			fmt.Sscanf(dayStr, "%d", &day)

			if len(m) >= 4 && m[3] != "" {
				fmt.Sscanf(m[3], "%d", &year)
			} else {
				// Intelligent year inference
				if monthVal > int(now.Month())+6 {
					year--
				} else if monthVal < int(now.Month())-6 {
					year++
				}
			}

			t := time.Date(year, time.Month(monthVal), day, hour, min, 0, 0, loc)
			return t.Format(time.RFC3339)
		}
	}

	return ds
}
