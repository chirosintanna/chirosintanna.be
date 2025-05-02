const TOKEN_KEY = 'chirosintanna-token'
const EDITING_KEY = 'chirosintanna-editing'
const REPO = 'chirosintanna/chirosintanna.be'

const editorButton = document.querySelector('footer .editor')
if (editorButton) {
  initialize()
}

function initialize() {
  if (localStorage.getItem(TOKEN_KEY)) {
    editorButton.textContent = 'Bewerken'
  } else {
    sessionStorage.removeItem(EDITING_KEY)
  }
  if (sessionStorage.getItem(EDITING_KEY)) {
    enableEditor()
  }

  editorButton.addEventListener('click', () => {
    if (sessionStorage.getItem(EDITING_KEY)) {
      disableEditor()
      return
    }
    if (localStorage.getItem(TOKEN_KEY) === null) {
      const token = prompt('Inloggen met github_pat')
      if (token && token.startsWith('github_pat_')) {
        localStorage.setItem(TOKEN_KEY, token)
      } else {
        alert('Ongeldige token!')
        return
      }
    }
    enableEditor()
  })
}

function enableEditor() {
  sessionStorage.setItem(EDITING_KEY, 'true')
  document.body.classList.add('editing')
  editorButton.textContent = 'Bewerken uitschakelen'
  document.querySelectorAll('[data-edit]').forEach((e) => {
    e.addEventListener('click', (evt) => {
      if (!sessionStorage.getItem(EDITING_KEY)) {
        return
      }
      evt.preventDefault()
      makeEdit(e.getAttribute('data-edit'))
        .then((success) => {
          if (success) alert('Succesvol bewerkt! Aanpassing is publiek binnen enkele seconden...')
        })
        .catch((e) => alert(e instanceof Error ? e.message : `${e}`))
    })
  })
}

function disableEditor() {
  sessionStorage.removeItem(EDITING_KEY)
  document.body.classList.remove('editing')
  editorButton.textContent = 'Bewerken'
}

async function makeEdit(key) {
  // 1. Huidige broncode ophalen van GitHub
  const path = `${location.pathname.replace(/^\//, '')}index.html`
  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
    },
  })
  const getData = await getRes.json()
  if (!getRes.ok) {
    throw new Error(`Kan pagina niet bewerken: ${getRes.status} ${getData.message}`)
  }
  const text = decodeURIComponent(escape(atob(getData.content)))
  const parser = new DOMParser()
  const html = parser.parseFromString(text, 'text/html')
  const element = html.querySelector(`[data-edit=${key}]`)

  // 2. Element aanpassen in de DOM
  if (element instanceof HTMLAnchorElement && element.href.startsWith('https://')) {
    const newLink = prompt('Link aanpassen', element.href)
    if (!newLink || element.href === newLink) {
      return false
    }
    if (!newLink.startsWith('https://')) {
      throw new Error('Link moet beginnen met https://')
    }
    element.href = newLink
  } else {
    throw new Error('Kan dit element niet bewerken')
  }

  // 3. Nieuwe broncode committen naar GitHub
  const documentText = html.documentElement.outerHTML
    .replace('<html lang="nl"><head>', '<html lang="nl">\n<head>')
    .replace('</body></html>', '</body>\n</html>')
    .replace(/\n+<\/body>/, '\n</body>')
  const newText = `<!DOCTYPE html>\n${documentText}\n`
  const newTextUtf8 = unescape(encodeURIComponent(newText))
  const putRes = await fetch (`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `🤖 Bewerk ${key}`,
      content: btoa(newTextUtf8),
      sha: getData.sha,
    })
  })
  const putData = await putRes.json()
  if (!putRes.ok) {
    throw new Error(`Fout tijdens het aanpassen: ${putRes.status} ${putData.message}`)
  }
  return true
}
