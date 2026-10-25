import { getConfiguracoes } from '@/lib/config'

export async function WhatsAppFloat() {
  const cfg = await getConfiguracoes()

  if (!cfg.clinicaWhatsApp) return null

  const mensagem = `Olá! Gostaria de agendar uma consulta no ${cfg.clinicaNome}.`
  const link = `https://wa.me/${cfg.clinicaWhatsApp}?text=${encodeURIComponent(mensagem)}`

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float group"
      aria-label="Conversar no WhatsApp"
      title="Conversar no WhatsApp"
    >
      <span className="whatsapp-float-btn">
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z"/>
        </svg>
      </span>
      <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        WhatsApp
      </span>
    </a>
  )
}