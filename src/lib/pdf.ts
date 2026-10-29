// A small PDF writer: Helvetica text, wrapped, paginated. Enough for a document the client reads outside the app.

const ascii = (s: string) =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '?')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function wrap(line: string, width: number): string[] {
  const indent = line.match(/^\s*/)![0]
  const words = line.trim().split(/\s+/)
  if (!line.trim()) return ['']
  const out: string[] = []
  let cur = indent
  for (const w of words) {
    if ((cur + w).length > width && cur.trim()) {
      out.push(cur.trimEnd())
      cur = indent + '    '
    }
    cur += `${w} `
  }
  out.push(cur.trimEnd())
  return out
}

export function textToPdf(lines: string[]): Blob {
  const rows = lines.flatMap((l) => wrap(ascii(l), 92))
  const perPage = 50
  const pages: string[][] = []
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage))
  if (pages.length === 0) pages.push([''])

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  const add = (id: number, body: string) => {
    offsets[id] = out.length
    out += `${id} 0 obj\n${body}\nendobj\n`
  }
  const total = 3 + pages.length * 2
  add(1, '<< /Type /Catalog /Pages 2 0 R >>')
  add(2, `<< /Type /Pages /Kids [${pages.map((_, k) => `${4 + k * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  add(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  pages.forEach((p, k) => {
    const page = 4 + k * 2
    const stream = `BT /F1 10.5 Tf 50 752 Td 14 TL ${p.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
    add(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`)
    add(page + 1, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  const xref = out.length
  out += `xref\n0 ${total + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= total; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}
