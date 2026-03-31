import { Component, html, useState, useEffect } from 'https://js.imlin.us/component'
import { Title, Subtitle, Button, Input, Tag } from 'https://js.imlin.us/ui'
import Sidebar from '../components/Sidebar.js'
import Loader from '../components/Loader.js'
import { getShows, addShow, deleteShow, scanLibrary } from '../api.js'

export default class Library extends Component {
  render() {
    const { router, path } = this.props
    const [shows, setShows] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [showUrl, setShowUrl] = useState('')
    
    const refresh = async () => {
      setLoading(true)
      try {
        const data = await getShows()
        setShows(data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    useEffect(refresh, [])

    const handleAdd = async () => {
      if (!showUrl) return
      setLoading(true)
      try {
        await addShow(showUrl)
        setShowUrl('')
        setAdding(false)
        await refresh()
      } catch (e) {
        alert(e.message)
      } finally {
        setLoading(false)
      }
    }

    const handleScan = async () => {
      try {
        await scanLibrary()
        alert('Scan started in background!')
      } catch (e) {
        alert(e.message)
      }
    }

    const handleNavigate = (show) => {
      router.push(`/library/${show.id}`)
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
            <div class="view-library">
              <div class="flex justify-between items-center" style="margin-bottom: 2.5rem !important;">
                <div>
                  ${Title({ children: 'Library', size: 1 })}
                  ${Subtitle({ children: 'Manage your tracked TV shows' })}
                </div>
                <div class="flex gap-15">
                  ${Button({ variant: 'glass', icon: 'ph ph-arrows-clockwise', children: 'Scan Library', onClick: handleScan })}
                  ${Button({ variant: 'primary', icon: 'ph ph-plus', children: 'Add Show', onClick: () => setAdding(!adding) })}
                </div>
              </div>

              ${adding && html`
                <div class="glass p-4 push-bottom flex gap-15">
                  <div style="flex: 1">
                    ${Input({ 
                      placeholder: 'Paste SVT Play or TV4 Play URL...', 
                      value: showUrl, 
                      onInput: e => setShowUrl(e.target.value) 
                    })}
                  </div>
                  ${Button({ variant: 'primary', children: 'Fetch', onClick: handleAdd })}
                </div>
              `}

              <div class="library-list">
                ${loading && shows.length === 0 ? html`<div class="flex justify-center p-12">${Loader()}</div>` : 
                  shows.length === 0 ? html`
                    <div class="empty-state glass p-12 text-center">
                      <i class="ph ph-film-strip" style="font-size: 3rem; opacity: 0.5"></i>
                      <h3 class="m-0">No shows tracked yet</h3>
                      <p class="text-muted">Add a show to get started</p>
                    </div>
                  ` : shows.map(s => html`
                  <div class="library-item glass push-bottom-small" onClick=${() => handleNavigate(s)}>
                    <div class="library-item__image">
                      <img src="${s.imageUrl || 'https://via.placeholder.com/160x90?text=No+Image'}" />
                    </div>
                    <div class="library-item__info flex-1">
                      <div class="library-item__title">${s.title || 'Untitled'}</div>
                      <div class="library-item__meta">
                        ${Tag({ variant: 'glass', size: 'small', className: s.source === 'svt' ? 'is-svt' : (s.source === 'tv4' ? 'is-tv4' : ''), children: s.source })}
                        <span>${s.episodes ? s.episodes.length : 0} Episodes</span>
                        <span class="text-muted opacity-50">| ${s.url}</span>
                      </div>
                    </div>
                    <div class="library-item__actions">
                      ${Button({ variant: 'ghost', icon: 'ph ph-caret-right', onClick: (e) => { e.stopPropagation(); handleNavigate(s); } })}
                    </div>
                  </div>
                  `)
                }
              </div>
            </div>
          </div>
        </main>
      </div>
    `
  }
}
