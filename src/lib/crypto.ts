import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY as string, 'hex')

export function encryptToken(plaintext: string): string {
  const nonce = randomBytes(12) // 96-bit nonce for GCM
  const cipher = createCipheriv(ALGORITHM, KEY, nonce)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Store as: nonce:authTag:ciphertext (all hex)
  return `${nonce.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(stored: string): string {
  const [nonceHex, authTagHex, encryptedHex] = stored.split(':')

  if (!nonceHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format')
  }

  const nonce = Buffer.from(nonceHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, KEY, nonce)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
