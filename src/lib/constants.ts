/**
 * Caminho do painel administrativo.
 *
 * O painel NÃO fica em /admin. Ele é servido em uma URL própria, definida
 * na variável ADMIN_PATH do .env (ex.: ADMIN_PATH="/painel-dra-luciana").
 * Assim o site público não tem nenhuma pista de que existe uma área admin,
 * e a rota antiga /admin responde 404 (ver src/app/admin/[[...rest]]/page.tsx).
 *
 * Regras:
 * - deve começar com "/" (adicionamos automaticamente se faltar);
 * - deve ter um único segmento (ex.: /painel-dra-luciana);
 * - sem ADMIN_PATH definido, usamos /painel-admin (nunca /admin).
 *
 * Este módulo é exclusivo do servidor (middleware, layouts e rotas de API).
 */
const ADMIN_PATH_PADRAO = '/painel-admin'

function normalizarAdminPath(valor: string | undefined): string {
  const bruto = (valor ?? '').trim()
  if (!bruto) return ADMIN_PATH_PADRAO

  const segmentos = bruto.split('/').filter(Boolean)
  if (segmentos.length === 0) return ADMIN_PATH_PADRAO

  if (segmentos.length > 1) {
    console.warn(
      `[ADMIN_PATH] "${bruto}" tem mais de um segmento; usando "/${segmentos[0]}". ` +
        'Use apenas um segmento, por exemplo /painel-dra-luciana.'
    )
  }

  return `/${segmentos[0]}`
}

export const ADMIN_PATH = normalizarAdminPath(process.env.ADMIN_PATH)

export const ADMIN_LOGIN_PATH = `${ADMIN_PATH}/login`

/** Segmento único usado pelo route group dinâmico src/app/(admin)/[adminPath]. */
export const ADMIN_SEGMENT = ADMIN_PATH.slice(1)

/** True para o painel e qualquer subrota dele (ex.: /painel-dra-luciana/servicos). */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)
}
