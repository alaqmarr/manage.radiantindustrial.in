import slugify from 'slugify'
import { randomBytes } from 'crypto'

export function generateSlug(text: string, addRandom = false): string {
  const baseSlug = slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  })

  if (addRandom || !baseSlug) {
    const randomSuffix = randomBytes(4).toString('hex')
    return baseSlug ? `${baseSlug}-${randomSuffix}` : randomSuffix
  }

  return baseSlug
}
