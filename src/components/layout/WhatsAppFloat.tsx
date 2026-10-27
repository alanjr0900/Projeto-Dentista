import { getConfiguracoes } from '@/lib/config'
import { MENSAGEM_WHATSAPP_PADRAO, linkWhatsApp } from '@/lib/contato'

export async function WhatsAppFloat() {
  const cfg = await getConfiguracoes()

  if (!cfg.clinicaWhatsApp) return null

  // Mesmo link do rodapé (regra da fonte única em src/lib/contato.ts):
  // wa.me com a mensagem inicial já codificada.
  const link = linkWhatsApp(MENSAGEM_WHATSAPP_PADRAO)

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float group"
      aria-label="Falar pelo WhatsApp"
      title="Falar pelo WhatsApp"
    >
      <span className="whatsapp-float-btn">
        {/* Logotipo oficial do WhatsApp (SVG) no lugar do ícone de telefone */}
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z"/>
          <path d="M12.05 2C6.5 2 2 6.5 2 12.05c0 1.77.46 3.45 1.3 4.9L2 22l5.2-1.36a10.02 10.02 0 0 0 4.85 1.24h.01c5.54 0 10.05-4.5 10.05-10.05C22.11 6.5 17.6 2 12.05 2zm0 18.16a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.09.81.83-3.01-.2-.31a8.27 8.27 0 0 1-1.26-4.41c0-4.59 3.74-8.32 8.33-8.32 4.59 0 8.32 3.73 8.32 8.32 0 4.59-3.74 8.26-8.4 8.26z"/>
        </svg>
      </span>
      <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        Falar pelo WhatsApp
      </span>
    </a>
  )
}
