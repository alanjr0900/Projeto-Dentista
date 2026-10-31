/**
 * Higieniza mensagens antes de irem para o log.
 *
 * Regra do projeto: o código de acesso e o e-mail completo NUNCA aparecem em
 * log — nem quando o erro vem do servidor SMTP ou do Prisma. Este módulo é
 * puro e pode ser usado em qualquer camada do servidor.
 */
export function mensagemSegura(erro: unknown): string {
  const texto =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'string'
        ? erro
        : 'erro desconhecido'

  return texto
    // E-mails completos → mascarados.
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***')
    // Códigos de 6 dígitos → mascarados.
    .replace(/\b\d{6}\b/g, '******')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300)
}
