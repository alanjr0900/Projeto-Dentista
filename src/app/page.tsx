import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { FotoDentista } from '@/components/FotoDentista'
import { prisma } from '@/lib/prisma'
import { getConfiguracoes } from '@/lib/config'
import {
  LINK_LIGAR,
  TELEFONE_EXIBICAO,
  ENDERECO,
  MAPS_LINK,
  MAPS_EMBED_SRC,
  linkWhatsApp,
  MENSAGEM_WHATSAPP_PADRAO,
} from '@/lib/contato'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default async function HomePage() {
  const cfg = await getConfiguracoes()
  const foto = cfg.dentistaFoto?.trim()

  // Serviços ativos, do banco, na ordem definida no painel
  const servicos = await prisma.servico.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
    take: 9,
  })

  const nome = cfg.dentistaNome || 'Dra. [Nome da Dentista]'

  // Nome curto para títulos: retira o tratamento "Dra. " se existir
  const primeiroNome = nome.replace(/^Dra\.?\s+/i, '').split(' ')[0] || nome

  // Horários de funcionamento formatados por dia
  const horariosPorDia = DIAS.map((dia, i) => {
    const periodos = cfg.horarioFuncionamento[i] || []
    if (periodos.length === 0) return { dia, texto: 'Fechado' }
    return {
      dia,
      texto: periodos.map(p => `${p.inicio}–${p.fim}`).join(' e '),
    }
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dentist',
            name: nome,
            description: 'Cirurgiã-dentista com atendimento humanizado em consultório próprio.',
            telephone: cfg.clinicaTelefone.replace(/\D/g, ''),
            email: cfg.clinicaEmail,
          }),
        }}
      />
      <Header nomeDentista={nome} />
      <main id="main-content" className="flex-1" role="main">
        {/* ===== Seção principal (hero): foto, nome, CRO e boas-vindas ===== */}
        <section
          id="inicio"
          aria-labelledby="hero-titulo"
          className="bg-gradient-to-b from-primary-50 via-primary-50/40 to-white"
        >
          <div className="container-pad">
            <div className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
              <div className="text-center lg:text-left">
                <Image
                  src="/logo/logo-simbolo.png"
                  alt="Símbolo da Dra. Luciana Ripa"
                  width={310}
                  height={300}
                  priority
                  className="mb-6 block h-auto w-16 sm:w-20 lg:w-[88px]"
                />
                <h1 id="hero-titulo" className="font-heading text-4xl font-bold text-neutral-900 sm:text-5xl">
                  {nome}
                </h1>
                {cfg.dentistaCRO && (
                  <p className="mt-3 text-lg font-medium text-primary-700">{cfg.dentistaCRO}</p>
                )}
                <p className="mx-auto mt-6 max-w-prose text-lg leading-relaxed text-neutral-600 lg:mx-0">
                  Seja bem-vindo(a)! Aqui, cada sorriso recebe a atenção que merece:
                  atendimento com calma, explicação clara em cada etapa e um ambiente
                  acolhedor, pensado para você se sentir tranquilo.
                </p>

                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Link
                    href="/agendar"
                    className="btn btn-primary btn-lg w-full px-8 py-4 text-lg sm:w-auto"
                    data-testid="cta-agendar-hero"
                  >
                    Agendar consulta
                  </Link>
                  {cfg.clinicaWhatsApp && (
                    <a
                      href={linkWhatsApp('Olá! Gostaria de informações sobre os atendimentos.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn w-full px-8 py-4 text-lg text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 sm:w-auto"
                    >
                      Falar no WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Foto da doutora (enviada no painel) ou acolhimento visual */}
              <div className="relative mx-auto w-full max-w-sm">
                {foto ? (
                  <FotoDentista
                    src={foto}
                    alt={`Foto de ${nome}`}
                    focoX={cfg.dentistaFotoFocoX}
                    focoY={cfg.dentistaFotoFocoY}
                    zoom={cfg.dentistaFotoZoom}
                  />
                ) : (
                  <div className="aspect-[4/5] w-full rounded-3xl bg-gradient-to-br from-primary-100 to-primary-200 flex flex-col items-center justify-center gap-3 border-8 border-white shadow-soft text-primary-300">
                    <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-sm text-neutral-500 px-6 text-center">
                      Foto da doutora ainda não configurada (envie no painel em Configurações)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== Sobre ela (formação e experiência vindas do painel) ===== */}
        <section id="sobre" aria-labelledby="sobre-titulo" className="py-16 lg:py-24">
          <div className="container-pad">
            <div className="max-w-3xl mx-auto text-center">
              <h2 id="sobre-titulo" className="font-heading text-3xl font-bold text-neutral-900 sm:text-4xl">
                Sobre a {primeiroNome}
              </h2>
              {cfg.dentistaFormacao?.trim() && (
                <p className="mt-8 text-lg leading-relaxed text-neutral-700">
                  {cfg.dentistaFormacao}
                </p>
              )}
              {cfg.dentistaExperiencia?.trim() && (
                <p className="mt-5 text-lg leading-relaxed text-neutral-700">
                  {cfg.dentistaExperiencia}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ===== Serviços oferecidos (do banco) ===== */}
        <section id="servicos" aria-labelledby="servicos-titulo" className="bg-primary-50/60 py-16 lg:py-24">
          <div className="container-pad">
            <div className="max-w-2xl mx-auto text-center">
              <h2 id="servicos-titulo" className="font-heading text-3xl font-bold text-neutral-900 sm:text-4xl">
                Serviços oferecidos
              </h2>
              <p className="mt-4 text-neutral-600">
                Cuidados completos para toda a família, com agendamento fácil e online.
              </p>
            </div>

            {servicos.length === 0 ? (
              <p className="mt-10 text-center text-neutral-500">
                Nenhum serviço publicado ainda. Cadastre os serviços no painel administrativo.
              </p>
            ) : (
              <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Lista de serviços">
                {servicos.map(s => (
                  <li
                    key={s.id}
                    className="rounded-2xl bg-white p-6 shadow-soft border border-primary-100/60 flex flex-col"
                  >
                    <h3 className="font-heading text-lg font-semibold text-neutral-900">{s.nome}</h3>
                    {s.descricao?.trim() && (
                      <p className="mt-2 text-sm leading-relaxed text-neutral-600 flex-1">
                        {s.descricao.length > 160 ? `${s.descricao.slice(0, 160)}…` : s.descricao}
                      </p>
                    )}
                    <p className="mt-4 text-xs font-medium text-primary-700 bg-primary-50 self-start rounded-full px-3 py-1">
                      ≈ {s.duracaoMin} minutos
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-12 text-center">
              <Link
                href="/agendar"
                className="btn btn-primary btn-lg px-10 py-4 text-lg inline-flex"
                data-testid="cta-agendar-servicos"
              >
                Agendar consulta
              </Link>
            </div>
          </div>
        </section>

        {/* ===== Contato e horários (das configurações) ===== */}
        <section id="contato" aria-labelledby="contato-titulo" className="py-16 lg:py-24">
          <div className="container-pad">
            <div className="max-w-2xl mx-auto text-center">
              <h2 id="contato-titulo" className="font-heading text-3xl font-bold text-neutral-900 sm:text-4xl">
                Onde nos encontrar
              </h2>
            </div>

            {/* 1.3 — Contato (esquerda), mapa no meio, horários embaixo.
                Desktop: 2 colunas (contato | mapa) e horários ocupando as duas;
                Mobile: empilha na ordem contato → mapa → horários. */}
            <div className="mt-12 grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Card de contato (sem endereço — ele fica no mapa abaixo) */}
              <address className="rounded-2xl bg-white p-8 shadow-soft border border-neutral-100 not-italic space-y-5">
                <h3 className="font-heading text-lg font-semibold text-neutral-900">Contato</h3>
                {cfg.clinicaTelefone && (
                  <p className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-primary-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <a href={LINK_LIGAR} className="text-neutral-700 hover:text-primary-600">
                      {TELEFONE_EXIBICAO}
                    </a>
                  </p>
                )}
                {cfg.clinicaWhatsApp && (
                  <p className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.369-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.377-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.67-.297-.472-.404-.915-.57-1.384-.179-.486-.194-.585-.298-.694-.104-.124-.268-.239-.496-.375z" />
                    </svg>
                    <a
                      href={linkWhatsApp(MENSAGEM_WHATSAPP_PADRAO)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-700 hover:text-green-700"
                    >
                      WhatsApp do consultório
                    </a>
                  </p>
                )}
                {cfg.clinicaEmail && (
                  <p className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-primary-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {/* 1.1 — E-mail como link mailto: */}
                    <a href={`mailto:${cfg.clinicaEmail}`} className="text-neutral-700 hover:text-primary-600">
                      {cfg.clinicaEmail}
                    </a>
                  </p>
                )}
              </address>

              {/* Mapa incorporado (entre os dois cards) + botão para abrir em nova aba */}
              <div className="rounded-2xl bg-white p-6 shadow-soft border border-neutral-100 flex flex-col gap-4">
                <iframe
                  src={MAPS_EMBED_SRC}
                  title={`Mapa do consultório — ${ENDERECO}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-64 md:h-full min-h-64 flex-1 rounded-xl border-0"
                />
                <a
                  href={MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-full"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Abrir no Google Maps
                </a>
              </div>

              {/* Horários de funcionamento (abaixo dos dois, ocupando as 2 colunas) */}
              <div className="md:col-span-2 rounded-2xl bg-white p-8 shadow-soft border border-neutral-100">
                <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-4">Horários de funcionamento</h3>
                <table className="w-full text-sm">
                  <caption className="sr-only">Horários de funcionamento por dia da semana</caption>
                  <tbody>
                    {horariosPorDia.map(({ dia, texto }) => (
                      <tr key={dia} className="border-b border-neutral-100 last:border-0">
                        <th scope="row" className="py-2.5 text-left font-medium text-neutral-900">{dia}</th>
                        <td className={`py-2.5 text-right ${texto === 'Fechado' ? 'text-neutral-400' : 'text-neutral-700'}`}>
                          {texto}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}
