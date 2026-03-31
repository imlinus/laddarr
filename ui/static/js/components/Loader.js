import { functional, html } from 'https://js.imlin.us/component'

export const Loader = functional(() => {
  return html`
    <div class="loader-container flex justify-center p-6">
      <div class="spinner"></div>
    </div>
  `
})

export default Loader
