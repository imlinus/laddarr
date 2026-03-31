const BASE = '/api'

export async function getShows () {
  const res = await fetch(`${BASE}/shows`)
  return res.json()
}

export async function getShow (id) {
  const res = await fetch(`${BASE}/shows/${id}`)
  return res.json()
}

export async function addShow (url) {
  const res = await fetch(`${BASE}/shows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  return res.json()
}

export async function updateShow (id, data) {
  const res = await fetch(`${BASE}/shows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function deleteShow (id) {
  return fetch(`${BASE}/shows/${id}`, { method: 'DELETE' })
}

export async function downloadEpisode (showId, episodeId) {
  const res = await fetch(`${BASE}/shows/${showId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodeId })
  })
  return res.json()
}

export async function getConfig () {
  const res = await fetch(`${BASE}/config`)
  return res.json()
}

export async function saveConfig (config) {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  return res.json()
}

export async function getCalendar () {
  const res = await fetch(`${BASE}/calendar`)
  return res.json()
}

export async function getStats () {
  const res = await fetch(`${BASE}/stats`)
  return res.json()
}

export async function scanLibrary () {
  const res = await fetch(`${BASE}/scan`, { method: 'POST' })
  return res.json()
}

export async function getQueue () {
  const res = await fetch(`${BASE}/queue`)
  return res.json()
}
