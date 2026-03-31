import { functional, html } from 'https://js.imlin.us/component'
import { Card, Button, Tag } from 'https://js.imlin.us/ui'

export const ShowCard = functional(({ show, onDetails, onDelete }) => {
  const downloadedCount = (show.episodes || []).filter(e => e.status === 'downloaded').length
  
  return html`
    ${Card({
      title: show.title || 'Untitled',
      image: show.imageUrl,
      subtitle: html`
        <div class="show-meta">
          ${show.source && html`<span class="tag tag--source">${show.source}</span>`}
          ${show.episodes ? html`<span>${show.episodes.length} episodes</span>` : ''}
        </div>
      `,
      children: html`
        <div class="show-tags">
          ${downloadedCount > 0 ? html`${Tag({ variant: 'success', children: `${downloadedCount} Downloaded` })}` : ''}
        </div>
      `,
      footer: html`
        <div class="flex gap-2">
          ${Button({ 
            variant: 'glass', 
            icon: 'ph ph-info', 
            children: 'Details', 
            onClick: () => onDetails(show) 
          })}
          ${Button({ 
            variant: 'danger', 
            icon: 'ph ph-trash', 
            onClick: () => onDelete(show) 
          })}
        </div>
      `
    })}
  `
})

export default ShowCard
