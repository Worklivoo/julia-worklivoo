import CryptoJS from 'crypto-js'

// Chave de criptografia obtida das variáveis de ambiente
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY

/**
 * Criptografa uma string usando AES
 * @param data - Dados a serem criptografados
 * @returns String criptografada
 */
export const encryptData = (data: string): string => {
  if (!SECRET_KEY) {
    console.warn('VITE_ENCRYPTION_KEY não está definida. Dados não serão criptografados.')
    return data
  }
  
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString()
  } catch (error) {
    console.error('Erro ao criptografar dados:', error)
    return data
  }
}

/**
 * Descriptografa uma string usando AES
 * @param encryptedData - Dados criptografados
 * @returns String descriptografada
 */
export const decryptData = (encryptedData: string): string => {
  if (!SECRET_KEY) {
    console.warn('VITE_ENCRYPTION_KEY não está definida. Retornando dados sem descriptografia.')
    return encryptedData
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    
    if (!decrypted) {
      throw new Error('Falha na descriptografia - resultado vazio')
    }
    
    return decrypted
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error)
    return encryptedData
  }
}

/**
 * Gera uma chave aleatória para criptografia
 * @returns Chave aleatória de 32 caracteres
 */
export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString()
}

/**
 * Verifica se os dados estão criptografados
 * @param data - Dados a serem verificados
 * @returns true se os dados parecem estar criptografados
 */
export const isEncrypted = (data: string): boolean => {
  // Verifica se a string parece ser base64 (formato típico do CryptoJS)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  return base64Regex.test(data) && data.length > 20
}