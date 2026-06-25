import type { JSX } from 'react'

/**
 * Rendu markdown minimal : titres, gras, italique, listes, séparateurs.
 * Pas de dépendance externe.
 */

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'hr' }
  | { type: 'p'; text: string }

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let listItems: string[] | null = null

  function flushList() {
    if (listItems) { blocks.push({ type: 'ul', items: listItems }); listItems = null }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^### /.test(line)) { flushList(); blocks.push({ type: 'h3', text: line.slice(4) }); continue }
    if (/^## /.test(line))  { flushList(); blocks.push({ type: 'h2', text: line.slice(3) }); continue }
    if (/^# /.test(line))   { flushList(); blocks.push({ type: 'h1', text: line.slice(2) }); continue }
    if (/^---+$/.test(line))  { flushList(); blocks.push({ type: 'hr' }); continue }
    if (/^[*-] /.test(line)) {
      if (!listItems) listItems = []
      listItems.push(line.slice(2))
      continue
    }

    flushList()
    if (line.trim() === '') continue
    blocks.push({ type: 'p', text: line })
  }
  flushList()
  return blocks
}

function inlineToJSX(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  let rest = text
  let key = 0
  while (rest) {
    const boldMatch = rest.match(/\*\*(.+?)\*\*/)
    const italicMatch = rest.match(/\*(.+?)\*/)
    const first = boldMatch && italicMatch
      ? (boldMatch.index! <= italicMatch.index! ? boldMatch : italicMatch)
      : (boldMatch ?? italicMatch)

    if (!first || first.index === undefined) { parts.push(rest); break }

    if (first.index > 0) parts.push(rest.slice(0, first.index))
    const isBold = first === boldMatch
    parts.push(
      isBold
        ? <strong key={key++} className="font-semibold text-white">{first[1]}</strong>
        : <em key={key++} className="italic">{first[1]}</em>
    )
    rest = rest.slice(first.index + first[0].length)
  }
  return parts
}

interface Props {
  children: string
  className?: string
}

export function MarkdownText({ children, className = '' }: Props) {
  const blocks = parseBlocks(children)

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h1': return <h1 key={i} className="text-base font-bold text-white mt-3 first:mt-0">{block.text}</h1>
          case 'h2': return <h2 key={i} className="text-sm font-bold text-amber-300 mt-3 first:mt-0">{block.text}</h2>
          case 'h3': return <h3 key={i} className="text-xs font-semibold text-stone-300 uppercase tracking-wide mt-2 first:mt-0">{block.text}</h3>
          case 'hr': return <hr key={i} className="border-stone-700 my-2" />
          case 'ul': return (
            <ul key={i} className="space-y-0.5 pl-3">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-stone-300 text-sm leading-relaxed">
                  <span className="text-stone-500 shrink-0 mt-0.5">·</span>
                  <span>{inlineToJSX(item)}</span>
                </li>
              ))}
            </ul>
          )
          case 'p': return (
            <p key={i} className="text-stone-300 text-sm leading-relaxed">
              {inlineToJSX(block.text)}
            </p>
          )
        }
      })}
    </div>
  )
}
