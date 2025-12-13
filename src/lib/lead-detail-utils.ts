import { PIPELINE_STAGES, NOTE_TRUNCATE_LENGTH } from './lead-detail-constants';

/**
 * Formata o telefone para o padrão +55 99 99999-9999
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  let rest = digits.startsWith('55') ? digits.slice(2) : digits;
  const area = rest.slice(0, 2);
  const number = rest.slice(2);
  if (!area || !number) return phone;
  if (number.length >= 9) {
    return `+55 ${area} ${number.slice(0, 5)}-${number.slice(5, 9)}`;
  }
  if (number.length >= 8) {
    return `+55 ${area} ${number.slice(0, 4)}-${number.slice(4, 8)}`;
  }
  return `+55 ${area} ${number}`;
}

/**
 * Formata uma data para o padrão brasileiro com hora
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verifica se uma anotação é longa o suficiente para precisar de expansão
 */
export function isNoteLong(content: string): boolean {
  return content.length > NOTE_TRUNCATE_LENGTH;
}

/**
 * Trunca o texto da anotação se não estiver expandida
 */
export function getTruncatedContent(content: string, isExpanded: boolean): string {
  if (!isNoteLong(content) || isExpanded) {
    return content;
  }
  return content.substring(0, NOTE_TRUNCATE_LENGTH) + '...';
}

/**
 * Calcula o índice da etapa atual no pipeline
 */
export function getCurrentStageIndex(stage: string): number {
  return PIPELINE_STAGES.findIndex(s => s.id === stage);
}

/**
 * Calcula a porcentagem de progresso no pipeline
 */
export function getProgressPercentage(stage: string): number {
  const currentStageIndex = getCurrentStageIndex(stage);
  return currentStageIndex >= 0 ? ((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100 : 0;
}

/**
 * Gera as iniciais do nome para o avatar
 */
export function getNameInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
