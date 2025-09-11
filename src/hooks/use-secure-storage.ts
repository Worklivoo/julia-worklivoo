import { useCallback } from 'react'
import { encryptData, decryptData, isEncrypted } from '../utils/encryption'

interface StoredItem {
  data: string
  timestamp: number
  encrypted: boolean
}

/**
 * Hook para gerenciar armazenamento seguro no localStorage
 * com criptografia e expiração automática
 */
export const useSecureStorage = () => {
  /**
   * Armazena um item de forma segura no localStorage
   * @param key - Chave do item
   * @param value - Valor a ser armazenado
   * @param encrypt - Se deve criptografar o valor (padrão: true)
   */
  const setSecureItem = useCallback((key: string, value: string, encrypt: boolean = true) => {
    try {
      const processedData = encrypt ? encryptData(value) : value
      const timestamp = Date.now()
      
      const item: StoredItem = {
        data: processedData,
        timestamp,
        encrypted: encrypt
      }
      
      localStorage.setItem(key, JSON.stringify(item))
    } catch (error) {
      console.error(`Erro ao armazenar item '${key}':`, error)
    }
  }, [])

  /**
   * Recupera um item do localStorage com verificação de expiração
   * @param key - Chave do item
   * @param maxAge - Idade máxima em milissegundos (padrão: 1 hora)
   * @returns Valor descriptografado ou null se expirado/não encontrado
   */
  const getSecureItem = useCallback((key: string, maxAge: number = 3600000): string | null => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null

      const storedItem: StoredItem = JSON.parse(item)
      
      // Verifica se o item expirou
      if (Date.now() - storedItem.timestamp > maxAge) {
        localStorage.removeItem(key)
        return null
      }

      // Descriptografa se necessário
      if (storedItem.encrypted) {
        return decryptData(storedItem.data)
      }
      
      return storedItem.data
    } catch (error) {
      console.error(`Erro ao recuperar item '${key}':`, error)
      // Remove item corrompido
      localStorage.removeItem(key)
      return null
    }
  }, [])

  /**
   * Remove um item específico do localStorage
   * @param key - Chave do item a ser removido
   */
  const removeSecureItem = useCallback((key: string) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Erro ao remover item '${key}':`, error)
    }
  }, [])

  /**
   * Limpa todos os itens expirados do localStorage
   * @param maxAge - Idade máxima em milissegundos (padrão: 1 hora)
   */
  const clearExpiredItems = useCallback((maxAge: number = 3600000) => {
    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        
        try {
          const item = localStorage.getItem(key)
          if (!item) continue
          
          const storedItem: StoredItem = JSON.parse(item)
          
          // Verifica se tem a estrutura esperada e se expirou
          if (storedItem.timestamp && Date.now() - storedItem.timestamp > maxAge) {
            keysToRemove.push(key)
          }
        } catch {
          // Se não conseguir fazer parse, pode ser um item antigo sem estrutura
          // Mantém para não quebrar funcionalidades existentes
        }
      }
      
      // Remove itens expirados
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      return keysToRemove.length
    } catch (error) {
      console.error('Erro ao limpar itens expirados:', error)
      return 0
    }
  }, [])

  /**
   * Limpa todos os dados do localStorage (usar com cuidado)
   */
  const clearAllSecureItems = useCallback(() => {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Erro ao limpar localStorage:', error)
    }
  }, [])

  /**
   * Verifica se um item existe e não expirou
   * @param key - Chave do item
   * @param maxAge - Idade máxima em milissegundos (padrão: 1 hora)
   * @returns true se o item existe e é válido
   */
  const hasValidItem = useCallback((key: string, maxAge: number = 3600000): boolean => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return false

      const storedItem: StoredItem = JSON.parse(item)
      return Date.now() - storedItem.timestamp <= maxAge
    } catch {
      return false
    }
  }, [])

  /**
   * Migra dados existentes do localStorage para o formato seguro
   * @param key - Chave do item a ser migrado
   * @param encrypt - Se deve criptografar durante a migração
   */
  const migrateExistingItem = useCallback((key: string, encrypt: boolean = true) => {
    try {
      const existingValue = localStorage.getItem(key)
      if (!existingValue) return false

      // Verifica se já está no formato seguro
      try {
        const parsed: StoredItem = JSON.parse(existingValue)
        if (parsed.timestamp && parsed.data !== undefined) {
          return true // Já está migrado
        }
      } catch {
        // Não está no formato seguro, precisa migrar
      }

      // Migra para o formato seguro
      setSecureItem(key, existingValue, encrypt)
      return true
    } catch (error) {
      console.error(`Erro ao migrar item '${key}':`, error)
      return false
    }
  }, [setSecureItem])

  return {
    setSecureItem,
    getSecureItem,
    removeSecureItem,
    clearExpiredItems,
    clearAllSecureItems,
    hasValidItem,
    migrateExistingItem
  }
}

export default useSecureStorage