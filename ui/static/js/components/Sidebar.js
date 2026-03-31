import { functional, html } from 'https://js.imlin.us/component'

export const Sidebar = functional(({ path, onNavigate, title, logo }) => {
  const items = [
    { label: 'Dashboard', path: '/', icon: 'ph-squares-four' },
    { label: 'Library', path: '/library', icon: 'ph-books' },
    { label: 'Activity', path: '/queue', icon: 'ph-activity' },
    { label: 'Settings', path: '/settings', icon: 'ph-gear-six' }
  ]

  return html`
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="logo">
          ${logo}
          <span>${title}</span>
          <span class="badge">PVR</span>
        </h2>
      </div>

      <div class="sidebar-scroll" style="flex: 1">
        <nav class="sidebar-nav">
          ${items.map(item => html`
            <div 
              class="menu-item ${path === item.path ? 'active' : ''}" 
              onClick=${(e) => { e.preventDefault(); onNavigate(item.path); }}>
              <i class="ph ${item.icon} menu-icon"></i>
              <span class="menu-label">${item.label}</span>
            </div>
          `)}
        </nav>
      </div>

      <div style="padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.03)">
         <div class="text-muted" style="font-size: 0.75rem; opacity: 0.5; text-align: center">
           version 2026.04.01
         </div>
      </div>
    </aside>
  `
})

export default Sidebar
