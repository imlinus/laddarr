import { mount } from 'https://js.imlin.us/component'
import { createRouter } from 'https://js.imlin.us/router'

import Dashboard from './pages/Dashboard.js'
import Library from './pages/Library.js'
import Queue from './pages/Queue.js'
import Settings from './pages/Settings.js'
import ShowDetails from './pages/ShowDetails.js'

const router = createRouter([
  { path: '/', component: Dashboard },
  { path: '/library', component: Library },
  { path: '/library/:id', component: ShowDetails },
  { path: '/queue', component: Queue },
  { path: '/settings', component: Settings }
])

const handleRouteChange = (state) => {
  const { route, params } = state
  const View = route.component
  const appRoot = document.getElementById('app')

  if (appRoot && View) {
    // Cloning the node is a "hacky" way to strip all event listeners
    // because my simple component framework doesn't support 'unmount' cleanup yet.
    // This prevents duplicate event listeners accumulating on #app.
    const newRoot = appRoot.cloneNode(false)
    appRoot.parentNode.replaceChild(newRoot, appRoot)

    // Mount the View directly with props
    mount(View, '#app', { 
      router: router, 
      params: params,
      path: state.path
    })
  }
}

// Registering the listener triggers an immediate initial render
router.onChange(handleRouteChange)
