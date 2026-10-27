/**
 * Fonte ÚNICA de contato do site (regra permanente — ver AGENTS.md):
 * telefone/WhatsApp e endereço do consultório NÃO ficam espalhados pelo
 * código. Alterar aqui atualiza site público, rodapé, e-mails e o que
 * mais usar as funções de config.
 */

/** DDI + DDD + número, apenas dígitos. Base para wa.me/5511964074862. */
export const WHATSAPP_NUMERO = '5511964074862'

/** Telefone em formato de exibição. */
export const TELEFONE_EXIBICAO = '+55 11 96407-4862'

/** Endereço completo do consultório (única fonte; alimenta mapa e textos). */
export const ENDERECO = 'Avenida Pietro Petri, 601'

/** Link tel: com DDI/DDD completos. */
export const LINK_LIGAR = `tel:+${WHATSAPP_NUMERO}`

/** Mensagem inicial padrão ao abrir o WhatsApp do consultório. */
export const MENSAGEM_WHATSAPP_PADRAO =
  'Olá! Gostaria de informações sobre o consultório.'

/** wa.me com mensagem inicial já codificada. */
export function linkWhatsApp(mensagem: string = MENSAGEM_WHATSAPP_PADRAO): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`
}

/** Busca do endereço no Google Maps (link gerado, nunca digitado à mão). */
export const MAPS_QUERY = ENDERECO

/** Link "Abrir no Google Maps" (nova aba). */
export const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`

/** Src do iframe embutido do Google Maps (sem necessidade de API key). */
export const MAPS_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&hl=pt-BR&z=16&output=embed`
