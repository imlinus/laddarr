import { Component, html, useState, useEffect } from 'https://js.imlin.us/component'
import { Button, Tag, Input, Select } from 'https://js.imlin.us/ui'
import Sidebar from '../components/Sidebar.js'
import Loader from '../components/Loader.js'
import { getShow, downloadEpisode, updateShow, deleteShow } from '../api.js'

export default class ShowDetails extends Component {
  render() {
    const { params: { id }, router, path } = this.props
    const [show, setShow] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    const refresh = async () => {
      try {
        const data = await getShow(id)
        setShow(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    useEffect(refresh, [id])

    const handleDownload = async (epId) => {
      try {
        await downloadEpisode(id, epId)
      } catch (e) {
        alert(e.message)
      }
    }

    const handleSave = async () => {
      setSaving(true)
      try {
        await updateShow(id, {
          preferredQuality: show.preferredQuality,
          downloadPath: show.downloadPath
        })
        setEditing(false)
        await refresh()
      } catch (e) {
        alert(e.message)
      } finally {
        setSaving(false)
      }
    }

    const getNiceDate = (dateStr) => {
      if (!dateStr) return 'Unknown date'
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      // Format: 3 april 02:00
      return d.toLocaleDateString('sv-SE', { 
        day: 'numeric', 
        month: 'long', 
        hour: '2-digit', 
        minute: '2-digit' 
      }).replace(',', '')
    }

    const handleDelete = async () => {
      if (!confirm(`Remove "${show.title}" from library?`)) return
      try {
        await deleteShow(id)
        router.push('/library')
      } catch (e) {
        alert(e.message)
      }
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
            ${loading ? html`<div class="flex justify-center p-12">${Loader()}</div>` : !show ? html`<div class="p-12">Show not found</div>` : html`
              <div class="view-show-details">
                <div class="show-hero is-glass">
                  <div class="show-hero-backdrop" style="background-image: url(${show.imageUrl || ''})"></div>
                  <div class="show-hero-content">
                    <div class="show-hero-poster">
                      ${show.imageUrl ? html`<img src="${show.imageUrl}" alt="${show.title}" />` : html`<div class="placeholder-poster"><i class="ph ph-image"></i></div>`}
                    </div>
                    <div class="show-hero-info">
                      ${Button({ variant: 'ghost', size: 'small', icon: 'ph ph-caret-left', children: 'Back to Library', onClick: () => router.push('/library') })}
                      <h1 class="show-hero-title">${show.title || 'Loading...'}</h1>
                      <div class="flex gap-3 items-center">
                        <span class="tag is-glass ${show.source === 'svt' ? 'is-svt' : (show.source === 'tv4' ? 'is-tv4' : '')}">${show.source || 'Unknown'}</span>
                        <span class="text-muted is-size-7">${show.url}</span>
                      </div>
                    </div>
                    <div class="show-hero-actions">
                      ${Button({ variant: 'primary', icon: 'ph ph-arrows-clockwise', children: 'Scan Episodes', onClick: () => refresh() })}
                      ${Button({ variant: 'glass', icon: 'ph ph-gear', children: 'Settings', onClick: () => setEditing(true) })}
                    </div>
                  </div>
                </div>

                <div class="show-body">
                  ${(() => {
                    const episodes = show.episodes || []
                    const seasons = episodes.reduce((acc, ep) => {
                      const s = ep.season || 0
                      if (!acc[s]) acc[s] = []
                      acc[s].push(ep)
                      return acc
                    }, {})
                    const sortedSeasons = Object.keys(seasons).sort((a,b) => b-a)
                    
                    return sortedSeasons.map((s, idx) => html`
                      <details class="season-section glass" ${idx === 0 ? 'open' : ''}>
                        <summary class="season-summary hover-glass">
                          <div class="flex items-center gap-3">
                            <i class="ph ph-caret-down season-caret"></i>
                            <h3 class="m-0">${s == '0' ? 'Specials' : (s > 2000 ? `Year ${s}` : `Season ${s}`)}</h3>
                            <span class="season-count text-muted">
                              ${seasons[s].length} Episodes
                            </span>
                          </div>
                          <div class="season-actions">
                            ${Button({ 
                              variant: 'glass', 
                              size: 'small', 
                              icon: 'ph ph-download-simple', 
                              children: 'Download All', 
                              onClick: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if(confirm(`Download all ${seasons[s].length} episodes in ${s == '0' ? 'Specials' : `Season ${s}`}?`)) {
                                  seasons[s].forEach(ep => handleDownload(ep.id))
                                }
                              }
                            })}
                          </div>
                        </summary>
                        
                        <div class="episode-list border-top-glass">
                          ${seasons[s].sort((a,b) => b.episode - a.episode).map(ep => {
                            const airDate = ep.airDate ? new Date(ep.airDate) : null
                            const isUnreleased = airDate && airDate > new Date()
                            const status = isUnreleased ? 'unreleased' : ep.status

                            return html`
                            <div class="episode-row flex items-center p-3 hover-glass">
                              <div class="episode-num text-muted">${ep.episode || '–'}</div>
                              
                              <div class="episode-thumb">
                                ${ep.imageUrl ? html`<img src="${ep.imageUrl}" />` : html`<div class="placeholder-thumb"><i class="ph ph-image"></i></div>`}
                              </div>

                              <div class="episode-info flex-1">
                                <div class="episode-title">${ep.title || `Episode ${ep.episode}`}</div>
                                <div class="text-muted is-size-7">${getNiceDate(ep.airDate)}</div>
                              </div>

                              <div class="episode-status">
                                <span class="status-badge is-${status} whitespace-nowrap">
                                  ${status}
                                </span>
                              </div>

                              <div class="episode-actions">
                                ${Button({ 
                                  variant: 'glass', 
                                  size: 'small',
                                  className: 'whitespace-nowrap',
                                  icon: ep.status === 'downloaded' ? 'ph ph-check' : ep.status === 'downloading' ? 'ph ph-spinner spin' : 'ph ph-download-simple', 
                                  onClick: () => handleDownload(ep.id),
                                  disabled: isUnreleased || ep.status === 'downloaded' || ep.status === 'downloading',
                                  children: isUnreleased ? 'Unreleased' : ep.status === 'downloading' ? 'Requesting...' : 'Download'
                                })}
                              </div>
                            </div>
                          `})}
                        </div>
                      </details>
                    `)
                  })()}
                </div>
              </div>
            `}
            
            <!-- Settings Side Panel -->
            <div class="side-panel ${editing ? 'is-active' : ''}">
              <div class="side-panel-overlay" onClick=${() => setEditing(false)}></div>
              <div class="side-panel-content">
                <div class="p-6">
                  <div class="flex justify-between items-center push-bottom">
                    <h3 class="m-0">Show Settings</h3>
                    ${Button({ variant: 'ghost', icon: 'ph ph-x', onClick: () => setEditing(false) })}
                  </div>

                  <div class="form-group push-bottom">
                    <label class="label">Preferred Quality</label>
                    ${Select({
                      value: show?.preferredQuality || '',
                      options: [
                        { label: 'Default (Highest)', value: '' },
                        { label: '1080p', value: '1080p' },
                        { label: '720p', value: '720p' },
                        { label: '480p', value: '480p' },
                        { label: '360p', value: '360p' }
                      ],
                      onChange: e => setShow({ ...show, preferredQuality: e.target.value })
                    })}
                  </div>

                  <div class="form-group push-bottom">
                    <label class="label">Library Path</label>
                    ${Input({
                      placeholder: 'Default (./downloads)',
                      value: show?.downloadPath || '',
                      onInput: e => setShow({ ...show, downloadPath: e.target.value })
                    })}
                  </div>

                  <div class="flex flex-col gap-3 push-top">
                    ${Button({ 
                      variant: 'primary', 
                      fullWidth: true, 
                      children: 'Save Changes', 
                      loading: saving,
                      onClick: handleSave 
                    })}
                    ${Button({ 
                      variant: 'danger', 
                      ghost: true,
                      fullWidth: true, 
                      icon: 'ph ph-trash',
                      children: 'Remove from Library', 
                      onClick: handleDelete
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `
  }
}
