import { functional, html } from 'https://js.imlin.us/component'
import { Card, Tag } from 'https://js.imlin.us/ui'

export const EpisodeCard = functional(({ episode, showTitle }) => {
  const statusClass = `tag--${episode.status}`
  
  return html`
    ${Card({
      title: episode.title,
      className: 'episode-card',
      children: html`
        <div class="episode-card-body">
          ${episode.imageUrl ? html`
            <div class="episode-card-image push-bottom-small">
              <img src="${episode.imageUrl}" />
            </div>
          ` : ''}
          <div class="episode-card-meta">
            <p class="text-muted is-size-7 m-0">${showTitle}</p>
            <div class="flex justify-between items-center push-top-small">
              <span class="text-muted is-size-7">${episode.airDate ? new Date(episode.airDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              ${Tag({ 
                variant: episode.status === 'downloaded' ? 'success' : episode.status === 'failed' ? 'danger' : 'glass', 
                size: 'small', 
                children: episode.status 
              })}
            </div>
          </div>
        </div>
      `
    })}
  `
})

export default EpisodeCard
