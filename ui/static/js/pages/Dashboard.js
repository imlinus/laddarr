import { Component, html, useState, useEffect } from 'https://js.imlin.us/component'
import { Title, Subtitle, Button } from 'https://js.imlin.us/ui'
import Sidebar from '../components/Sidebar.js'
import EpisodeCard from '../components/EpisodeCard.js'
import Loader from '../components/Loader.js'
import { getCalendar, getStats } from '../api.js'

export default class Dashboard extends Component {
  render() {
    const { router, path } = this.props
    const [events, setEvents] = useState([])
    const [stats, setStats] = useState({ totalShows: 0, totalEpisodes: 0, totalSize: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(async () => {
      try {
        const [calendarData, statsData] = await Promise.all([
          getCalendar(),
          getStats()
        ])
        setEvents(calendarData || [])
        setStats(statsData)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, [])

    const formatBytes = (bytes, decimals = 2) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const dm = decimals < 0 ? 0 : decimals
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
    }

    // Kanban Weekly Board Logic
    const getWeekDays = () => {
      const dNow = new Date()
      // Use local date string to avoid UTC shifting issues
      const todayStr = dNow.toLocaleDateString('sv-SE')
      
      const currentDay = dNow.getDay()
      const dDiff = dNow.getDate() - (currentDay === 0 ? 6 : currentDay - 1)
      const monday = new Date(dNow.setDate(dDiff))
      monday.setHours(0, 0, 0, 0)

      const days = []
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dateStr = d.toLocaleDateString('sv-SE')
        days.push({
          name: dayNames[i],
          date: d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
          dateStr: dateStr,
          isToday: dateStr === todayStr
        })
      }
      return days
    }

    const weekDaysArr = getWeekDays()
    const episodesByDay = (events || []).reduce((acc, ev) => {
      const airDate = ev.episode.airDate || ''
      if (!airDate) return acc
      const dateKey = airDate.split('T')[0]
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(ev)
      return acc
    }, {})

    return html`
      <div class="layout">
        ${Sidebar({
          path: path,
          onNavigate: (p) => router.push(p),
          title: 'Laddarr',
          logo: html`<i class="ph ph-television-simple" style="font-size: 1.5rem; color: var(--primary-color);"></i>`
        })}

        <main class="content">
          <div class="container relative">
            <div class="flex justify-between items-center push-bottom">
               <div>
                 ${Title({ children: 'Dashboard', size: 1 })}
                 ${Subtitle({ children: 'Your library activity at a glance' })}
               </div>
               <div class="flex gap-3">
                 ${Button({ 
                   children: html`<i class="ph ph-arrows-clockwise ${loading ? 'spin' : ''}"></i> Refresh All`, 
                   onClick: () => location.reload(),
                   variant: 'glass'
                 })}
               </div>
            </div>

            ${loading ? html`
              <div class="flex justify-center items-center" style="min-height: 400px">
                ${Loader({ size: 'large' })}
              </div>
            ` : html`
              <!-- Stat Cards -->
              <div class="grid-3 gap-15 push-bottom-xl">
                <div class="stat-card">
                  <div class="icon" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary-color)">
                    <i class="ph ph-film-strip"></i>
                  </div>
                  <div class="info">
                    <div class="label">Total Shows</div>
                    <div class="value">${stats.totalShows || 0}</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="icon" style="background: rgba(0, 200, 0, 0.1); color: #00c800">
                    <i class="ph ph-play-circle"></i>
                  </div>
                  <div class="info">
                    <div class="label">Episodes</div>
                    <div class="value">
                      ${stats.totalEpisodes || 0}
                      <span class="text-muted is-size-7" style="font-weight: 500">(${stats.totalDownloaded || 0} DL)</span>
                    </div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="icon" style="background: rgba(255, 255, 255, 0.05); color: #fff">
                    <i class="ph ph-hard-drive"></i>
                  </div>
                  <div class="info">
                    <div class="label">Storage Used</div>
                    <div class="value">${formatBytes(stats.totalSize || 0)}</div>
                  </div>
                </div>
              </div>

              <!-- Weekly Calendar Board -->
              <div class="push-bottom">
                 <div class="flex items-center gap-3 push-bottom">
                   <h2 class="m-0">Weekly Calendar</h2>
                   <span class="tag is-primary is-light">This Week</span>
                 </div>
                 
                 <div class="calendar-board grid-7 gap-4">
                   ${weekDaysArr.map(day => html`
                     <div class="calendar-column ${day.isToday ? 'is-today' : ''}">
                        <div class="day-header">
                           <div class="day-name">${day.name}</div>
                           <div class="day-date">${day.date}</div>
                        </div>
                        
                        <div class="day-content flex flex-col gap-3">
                           ${(episodesByDay[day.dateStr] || []).map(ev => html`
                             <div class="ep-mini" onClick=${() => router.push('/library/' + ev.showId)}>
                                ${ev.episode.status === 'downloaded' ? html`
                                  <div class="dl-badge"><i class="ph ph-check-bold"></i></div>
                                ` : ''}
                                <img src="${ev.episode.imageUrl}" class="thumb" onerror="this.src='/api/images/placeholder.jpg'">
                                <div class="show-title">${ev.showTitle}</div>
                                <div class="ep-title">${ev.episode.title}</div>
                                <div class="meta">
                                  <span>${new Date(ev.episode.airDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                             </div>
                           `)}
                           
                           ${!(episodesByDay[day.dateStr] || []).length ? html`
                             <div class="text-muted is-size-7" style="padding: 1rem; text-align: center; border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px; opacity: 0.3">
                                No airings
                             </div>
                           ` : ''}
                        </div>
                     </div>
                   `)}
                 </div>
              </div>
            `}
          </div>
        </main>
      </div>
    `
  }
}
