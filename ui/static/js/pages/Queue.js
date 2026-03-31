import { Component, html, useState, useEffect } from 'https://js.imlin.us/component'
import { Title, Subtitle } from 'https://js.imlin.us/ui'
import Sidebar from '../components/Sidebar.js'
import { getQueue } from '../api.js'

export default class Queue extends Component {
  render () {
    const { router, path } = this.props
    const [queue, setQueue] = useState({ active: [], count: 0 })

    const refresh = async () => {
      try {
        const data = await getQueue()
        setQueue(data)
      } catch (e) {
        console.error('Queue fetch failed', e)
      }
    }

    useEffect(() => {
      refresh()
      const interval = setInterval(refresh, 2000)
      return () => clearInterval(interval)
    }, [])

    // Helper to parse progress percentage from yt-dlp or svtplay-dl string
    const getPercent = (progressStr) => {
      if (!progressStr) return 0
      // [download]  12.3% or [12.3%]
      const match = progressStr.match(/(\d+\.\d+)%/)
      if (match) return parseFloat(match[1])
      
      // Fragment counting: [123/456]
      const fragMatch = progressStr.match(/\[(\d+)\/(\d+)\]/)
      if (fragMatch) {
        return (parseInt(fragMatch[1]) / parseInt(fragMatch[2])) * 100
      }
      return 0
    }

    // Helper to extract speed and ETA
    const getMeta = (progressStr) => {
      if (!progressStr) return 'Initializing...'
      // svtplay-dl: [45.2%][############        ] 43/100 MB (1.2 MB/s)  ETA 00:00:23
      // yt-dlp: [download]  12.3% of 100MiB at  1.2MiB/s ETA 01:23
      if (progressStr.includes('] ')) {
        return progressStr.split('] ').pop().trim()
      }
      if (progressStr.includes(' at ')) {
        return progressStr.split(' at ')[1]
      }
      return progressStr.replace('[download]', '').trim()
    }

    return html`
      <div class="layout">
        ${Sidebar({
          path: path,
          onNavigate: (p) => router.push(p),
          title: 'Laddarr',
          logo: html`<i class="ph ph-television-simple" style="font-size: 1.5rem; color: var(--primary-color);"></i>`
        })}

        <main class="content">
          <div class="container">
            <div class="push-bottom">
              ${Title({ children: 'Activity Queue', size: 1 })}
              ${Subtitle({ children: queue.active.length > 0 ? `Currently downloading ${queue.active.length} item(s)` : 'No active downloads' })}
            </div>

            <div class="glass p-6">
              ${queue.active.length === 0 && queue.count === 0 ? html`
                <div class="text-center py-12 opacity-30">
                  <i class="ph ph-stack-simple" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                  <p>Queue is empty</p>
                </div>
              ` : html`
                <div class="queue-list flex flex-col gap-6">
                  ${queue.active.map(job => {
                    const percent = getPercent(job.Progress)
                    return html`
                      <div class="queue-item card-bg p-4 rounded-xl border border-white-05" key="${job.EpisodeID}">
                        <div class="flex justify-between items-start push-bottom-small">
                          <div>
                            <h4 class="m-0">${job.ShowTitle}</h4>
                            <p class="text-muted is-size-7">${job.Title}</p>
                          </div>
                          <div class="text-right">
                             <span class="badge" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary-color); border: 1px solid rgba(var(--primary-rgb), 0.2)">
                               Downloading
                             </span>
                          </div>
                        </div>

                        <div class="progress-container push-bottom-small">
                          <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percent}%"></div>
                          </div>
                        </div>

                        <div class="flex justify-between items-center text-muted is-size-7">
                          <div>
                            <i class="ph ph-timer"></i> Started ${new Date(job.Started).toLocaleTimeString()}
                          </div>
                          <div>
                            ${getMeta(job.Progress)}
                          </div>
                        </div>
                      </div>
                    `
                  })}

                  ${queue.count > 0 ? html`
                    <div class="mt-4 p-4 rounded-xl border border-dashed border-white-10 text-center text-muted is-size-7">
                       + ${queue.count} more items in queue
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          </div>
        </main>
      </div>
    `
  }
}
