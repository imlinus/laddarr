import { Component, html } from 'https://js.imlin.us/component'
import { Sidebar, Container } from 'https://js.imlin.us/ui'

export default class Layout extends Component {
  render() {
    const { view: View, router, params, path } = this.props
    
    return html`
      <div class="layout">
        ${Sidebar({
          path: path,
          onNavigate: (p) => router.navigate(p),
          title: 'Laddarr',
          logo: html`<i class="ph ph-television-simple" style="font-size: 1.5rem; color: var(--primary-color); margin-right: 12px;"></i>`
        })}
        
        <main class="layout__content">
          ${Container({
            children: html`<${View} router=${router} ...${params} />`
          })}
        </main>
      </div>
    `
  }
}
