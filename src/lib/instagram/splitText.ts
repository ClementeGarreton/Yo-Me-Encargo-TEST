/** Mensajes de texto de Instagram: segmentos por debajo del límite de la API. */
export function splitInstagramText(text: string, maxLength = 900): string[] {
  if (maxLength < 30) throw new Error('Longitud máxima demasiado pequeña')
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > maxLength) {
    let split = remaining.lastIndexOf('\n', maxLength)
    if (split < maxLength / 3) split = remaining.lastIndexOf(' ', maxLength)
    if (split < maxLength / 3) split = maxLength
    const chunk = remaining.slice(0, split).trimEnd()
    if (chunk) chunks.push(chunk)
    remaining = remaining.slice(split).trimStart()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}
