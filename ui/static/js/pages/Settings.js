import { Component, html, useState, useEffect } from 'https://js.imlin.us/component'
import { Title, Subtitle, Input, Button } from 'https://js.imlin.us/ui'
import Sidebar from '../components/Sidebar.js'
import { getConfig, saveConfig } from '../api.js'

export default class Settings extends Component {
  render() {
    const { router, path } = this.props
    const [cfg, setCfg] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(async () => {
      const data = await getConfig()
      setCfg(data)
    }, [])

    const handleSave = async () => {
      setSaving(true)
      try {
        await saveConfig(cfg)
        alert('Settings saved!')
      } catch (e) {
        alert(e.message)
      } finally {
        setSaving(false)
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
            ${!cfg ? html`<p>Loading settings...</p>` : html`
              <div class="view-settings">
                <div class="push-bottom">
                  ${Title({ children: 'Settings', size: 1 })}
                  ${Subtitle({ children: 'Global application configuration' })}
                </div>

                <div class="max-w-3xl">
                  <section class="settings-section">
                    <h4>Download Path</h4>
                    <p class="text-muted">Where should episodes be saved by default?</p>
                    ${Input({
                      value: cfg.downloadDir,
                      onInput: e => setCfg({ ...cfg, downloadDir: e.target.value }),
                      placeholder: './downloads'
                    })}
                  </section>

                  <section class="settings-section">
                    <h4>TV4 Play Token</h4>
                    <p class="text-muted">Optional token for authenticated TV4 Play downloads.</p>
                    <textarea
                      class="textarea is-token w-full"
                      oninput=${e => setCfg({ ...cfg, tv4Token: e.target.value })}
                      placeholder="Your TV4 Play token..."
                    >${cfg.tv4Token || ''}</textarea>
                    
                    ${cfg.tv4TokenExpiry > 0 ? html`
                      <div class="glass p-4 push-top-small" style="background: rgba(var(--primary-rgb), 0.05)">
                         <div class="flex items-center gap-3">
                            <i class="ph ph-clock text-muted" style="font-size: 1.25rem;"></i>
                            <span class="text-muted">Expires on: <b class="text-white">${new Date(cfg.tv4TokenExpiry * 1000).toLocaleString('sv-SE')}</b></span>
                         </div>
                      </div>
                    ` : ''}
                  </section>

                  <div class="push-top-xl">
                    ${Button({
                      variant: 'primary',
                      children: 'Save Settings',
                      loading: saving,
                      onClick: handleSave
                    })}
                  </div>
                </div>
              </div>
            `}
          </div>
        </main>
      </div>
    `
  }
}
