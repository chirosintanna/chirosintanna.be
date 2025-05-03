const TOKEN_KEY = 'chirosintanna-token'
const EDITING_KEY = 'chirosintanna-editing'
const REPO = 'chirosintanna/chirosintanna.be'

const editorButton = document.querySelector('footer .editor')
if (editorButton) {
  initialize()
}

function initialize() {
  if (localStorage.getItem(TOKEN_KEY)) {
    editorButton.textContent = '[Bewerken]'
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
  editorButton.textContent = '[Bewerken uitschakelen]'
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
        .catch((e) => {
          console.error(e)
          alert(e instanceof Error ? e.message : `${e}`)
        })
    })
  })
}

function disableEditor() {
  sessionStorage.removeItem(EDITING_KEY)
  document.body.classList.remove('editing')
  editorButton.textContent = '[Bewerken]'
}

/**
 * @param {string} key
 */
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
  const doc = parser.parseFromString(text, 'text/html')
  const element = doc.querySelector(`[data-edit=${key}]`)

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
  } else if (element instanceof HTMLPictureElement) {
    throw new Error('Afbeeldingen bewerken is nog niet mogelijk')
  } else if (element instanceof HTMLDivElement) {
    const markdown = htmlToMarkdown(element)
    const newMarkdown = prompt('Tekst aanpassen', markdown)
    if (!newMarkdown || markdown === newMarkdown) {
      return false
    }
    const indentLevel = getIndentLevel(element)
    element.innerHTML = markdownToHtml(newMarkdown, indentLevel)
  } else {
    throw new Error('Kan dit element niet bewerken')
  }

  // 3. Nieuwe broncode committen naar GitHub
  const documentText = doc.documentElement.outerHTML
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

/**
 * @param {HTMLDivElement} element
 */
function htmlToMarkdown(element) {
  let md = ''
  for (const child of element.children) {
    if (child instanceof HTMLHeadingElement) {
      const prefix = {H1: '#', H2: '##', H3: '###'}[child.tagName] ?? '####'
      md += `${prefix} ${child.textContent.replace(/\s+/g, ' ').trim()}\n`
    } else if (child instanceof HTMLParagraphElement) {
      md += `${inlineHtmlToMarkdown(child)}\n\n`
    } else if (child instanceof HTMLUListElement) {
      for (const item of child.children) {
        md += `- ${inlineHtmlToMarkdown(item)}\n`
      }
      md += '\n'
    } else {
      throw new Error('Deze tekst is te complex om te bewerken.')
    }
  }
  return md.trimEnd()
}

/**
 * @param {HTMLElement} element 
 */
function inlineHtmlToMarkdown(element) {
  let md = ''
  for (const child of element.childNodes) {
    if (child instanceof Text) {
      md += child.textContent.replace(/\s+/g, ' ')
    } else if (child instanceof HTMLAnchorElement) {
      md += `[${child.textContent.replace(/\s+/g, ' ').trim()}](${child.href})`
    }
  }
  return md.trim()
}

/**
 * @param {HTMLDivElement} div
 */
function getIndentLevel(div) {
  if (!div.parentElement) return 0
  const parentHtml = div.parentElement.innerHTML
  const divIndex = parentHtml.indexOf(div.outerHTML)
  if (divIndex === -1) return 0
  const precedingText = parentHtml.substring(
    parentHtml.lastIndexOf('>', divIndex - 1) + 1,
    divIndex
  )
  const lastNewline = precedingText.lastIndexOf('\n')
  const indentationText = lastNewline === -1 
    ? precedingText 
    : precedingText.substring(lastNewline + 1)
  return (indentationText.match(/ /g) || []).length
}

/**
 * @param {string} md
 * @param {number} indentLevel
 */
function markdownToHtml(md, indentLevel) {
  const i0 = ' '.repeat(indentLevel)
  const i1 = i0 + '  '
  const i2 = i1 + '  '
  const lines = md.split('\n')
  let html = `\n`
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s(.*)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      html += `${i1}<h${level}>\n${i2}${escapeHtml(text)}\n${i1}</h${level}>\n`
      i++
      continue
    }

    // Unordered lists
    if (line.startsWith('- ')) {
      html += `${i1}<ul>\n`
      while (i < lines.length && lines[i].startsWith('- ')) {
        const text = lines[i].substring(2).trim()
        html += `${i2}<li>${inlineMarkdownToHtml(text)}</li>\n`
        i++
      }
      html += `${i1}</ul>\n`
      continue
    }

    // Paragraphs
    html += `${i1}<p>\n`
    while (i < lines.length) {
      const line = lines[i].trim()
      if (!line || line.startsWith('- ') || line.match(/^(#{1,4})\s/)) {
        break
      }
      html += `${i2}${inlineMarkdownToHtml(line)}\n`
      i++
    }
    html += `${i1}</p>\n`
  }

  return html + i0
}

/**
 * @param {string} text
 */
function inlineMarkdownToHtml(text) {
  let html = ''
  while (text.length > 0) {
    const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/)
    if (!linkMatch) {
      html += escapeHtml(text)
      break
    }

    if (linkMatch.index > 0) {
      html += escapeHtml(text.substring(0, linkMatch.index))
    }
    const href = escapeHtml(linkMatch[2])
    html += `<a href="${href}"${href.startsWith('https://') ? ' target="_blank"' : ''}>${escapeHtml(linkMatch[1])}</a>`
    text = text.substring(linkMatch.index + linkMatch[0].length)
  }
  return html
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
