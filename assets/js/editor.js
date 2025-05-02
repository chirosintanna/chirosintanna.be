const TOKEN_KEY = 'chirosintanna-token'
const EDITING_KEY = 'chirosintanna-editing'
const REPO = 'chirosintanna/chirosintanna.be'

const editorButton = document.querySelector('footer .editor')

main()

function main() {
  if (localStorage.getItem(TOKEN_KEY)) {
    editorButton.textContent = 'Bewerken'
  } else {
    sessionStorage.removeItem(EDITING_KEY)
  }
  if (sessionStorage.getItem(EDITING_KEY)) {
    enableEditor()
  }

  editorButton?.addEventListener('click', () => {
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
      console.log('CLICK', e.getAttribute('data-edit'))
      // TODO
    })
  })
}

function disableEditor() {
  sessionStorage.removeItem(EDITING_KEY)
  document.body.classList.remove('editing')
  editorButton.textContent = 'Bewerken'
}
