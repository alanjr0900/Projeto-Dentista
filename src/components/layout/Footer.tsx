import Link from 'next/link'
import { getConfiguracoes } from '@/lib/config'

export async function Footer() {
  const cfg = await getConfiguracoes()
  const anoAtual = new Date().getFullYear()
  const nomeShort = (cfg.dentistaNome || 'Dra. [Nome]').trim()
  const nomeConsultorio = cfg.clinicaNome.trim() || `Consultório ${nomeShort}`
  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  // horarioFuncionamento é indexado por dia da SEMANA JS (0 = domingo)
  const diasOrdem = [1, 2, 3, 4, 5, 6, 0]

  return (
    <footer className="bg-neutral-950 text-neutral-300" role="contentinfo">
      <div className="container-pad py-16 lg:py-24">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Sobre a clínica */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6" aria-label="Página inicial">
              <svg className="w-8 h-8 text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="font-heading text-2xl font-semibold text-white">{nomeShort}</span>
            </Link>
            <p className="text-base-lg text-neutral-400 max-w-xs leading-relaxed">
              Atendimento humanizado e especializado há 15 anos. Cuidamos do seu sorriso com carinho, 
              técnica e respeito ao seu tempo.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a 
                href={`https://wa.me/${cfg.clinicaWhatsApp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-400 hover:text-green-400 transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z"/>
                </svg>
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
              <a 
                href={`tel:${cfg.clinicaTelefone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-neutral-400 hover:text-primary-400 transition-colors"
                aria-label="Telefone"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 19.79 19.79 0 0 1 8.63 3.07A19.5 19.5 0 0 1 20 12a19.79 19.79 0 0 1 3.07 8.67 2 2 0 0 1-1.72 2z" />
                </svg>
                <span className="hidden sm:inline">Ligar</span>
              </a>
            </div>
          </div>

          {/* Contato */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-white mb-4">Contato</h3>
            <address className="not-italic text-base-lg text-neutral-400 leading-relaxed space-y-3">
              <p>{cfg.clinicaEndereco || '[Endereço do consultório]'}</p>
              <p>
                <a href={`tel:${cfg.clinicaTelefone.replace(/\D/g, '')}`} className="hover:text-white transition-colors">
                  {cfg.clinicaTelefone}
                </a>
              </p>
              <p>
                <a href={`mailto:${cfg.clinicaEmail}`} className="hover:text-white transition-colors">
                  {cfg.clinicaEmail}
                </a>
              </p>
            </address>
          </div>

          {/* Horários */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-white mb-4">Horários</h3>
            <dl className="space-y-2 text-base-lg text-neutral-400">
              {diasOrdem.map((indiceDia, i) => {
                const periodos = cfg.horarioFuncionamento?.[indiceDia] || []
                const texto = periodos.length === 0
                  ? 'Fechado'
                  : periodos.map(p => `${p.inicio.replace(':', 'h')}–${p.fim.replace(':', 'h')}`).join(' / ')
                return (
                  <div className="flex justify-between" key={DIAS[i]}>
                    <dt>{DIAS[i]}</dt>
                    <dd className={`font-medium ${texto === 'Fechado' ? '' : 'text-white'}`}>{texto}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-neutral-500 text-sm">
            © {anoAtual} {nomeConsultorio}. Todos os direitos reservados.
          </p>
          <nav className="flex items-center gap-6 text-sm text-neutral-500" aria-label="Links legais">
            <Link href="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            <Link href="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link href="/lgpd" className="hover:text-white transition-colors">LGPD</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}