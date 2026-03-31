package worker

import (
	"log"
	"sync"
	"time"

	"github.com/imlinus/laddarr/internal/models"
	"github.com/imlinus/laddarr/internal/runner"
	"github.com/imlinus/laddarr/internal/store"
)

// Job represents a single download request.
type Job struct {
	Show    models.Show
	Episode models.Episode
	Config  models.Config
}

// Pool manages a fixed number of download goroutines.
type Pool struct {
	jobs  chan Job
	store *store.Store
	wg    sync.WaitGroup
	quit  chan struct{}

	activeMu sync.Mutex
	active   map[string]ActiveJob
}

// ActiveJob tracks a currently running download
type ActiveJob struct {
	EpisodeID string
	ShowTitle string
	Title     string
	Progress  string
	Started   time.Time
}

// QueueStatus represents the current state of the pool
type QueueStatus struct {
	Active []ActiveJob `json:"active"`
	Count  int         `json:"count"`
}

// New creates a worker pool. Workers are not started until Start() is called.
func New(s *store.Store, size int) *Pool {
	if size < 1 {
		size = 1
	}
	return &Pool{
		jobs:   make(chan Job, 64),
		store:  s,
		quit:   make(chan struct{}),
		active: make(map[string]ActiveJob),
	}
}

// Start launches the worker goroutines.
func (p *Pool) Start(n int) {
	log.Printf("[worker] starting %d workers", n)
	for i := 0; i < n; i++ {
		p.wg.Add(1)
		go p.work(i)
	}
}

// Enqueue adds a download job to the queue.
// It also sets the episode status to Queued.
func (p *Pool) Enqueue(job Job) {
	_ = p.store.UpdateEpisodeStatus(job.Episode.ID, models.StatusQueued, "")
	p.jobs <- job
}

// GetStatus returns what's currently happening in the pool
func (p *Pool) GetStatus() QueueStatus {
	p.activeMu.Lock()
	defer p.activeMu.Unlock()

	active := make([]ActiveJob, 0, len(p.active))
	for _, aj := range p.active {
		active = append(active, aj)
	}

	return QueueStatus{
		Active: active,
		Count:  len(p.jobs),
	}
}

// Stop signals all workers to finish and waits for them.
func (p *Pool) Stop() {
	close(p.quit)
	p.wg.Wait()
}

func (p *Pool) work(id int) {
	defer p.wg.Done()
	log.Printf("[worker %d] ready", id)

	for {
		select {
		case <-p.quit:
			log.Printf("[worker %d] shutting down", id)
			return
		case job := <-p.jobs:
			log.Printf("[worker %d] downloading %s", id, job.Episode.Title)

			_ = p.store.UpdateEpisodeStatus(job.Episode.ID, models.StatusDownloading, "")

			// Mark as active
			p.activeMu.Lock()
			p.active[job.Episode.ID] = ActiveJob{
				EpisodeID: job.Episode.ID,
				ShowTitle: job.Show.Title,
				Title:     job.Episode.Title,
				Progress:  "starting...",
				Started:   time.Now(),
			}
			p.activeMu.Unlock()

			result := runner.Download(&job.Config, &job.Show, &job.Episode, func(progress string) {
				p.activeMu.Lock()
				if aj, ok := p.active[job.Episode.ID]; ok {
					aj.Progress = progress
					p.active[job.Episode.ID] = aj
				}
				p.activeMu.Unlock()
			})

			// Remove from active
			p.activeMu.Lock()
			delete(p.active, job.Episode.ID)
			p.activeMu.Unlock()

			if result.Success {
				_ = p.store.UpdateEpisodeStatus(
					job.Episode.ID,
					models.StatusDownloaded,
					result.FilePath,
				)
			} else {
				_ = p.store.UpdateEpisodeStatus(
					job.Episode.ID,
					models.StatusFailed,
					"",
				)
			}
		}
	}
}
