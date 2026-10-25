import { notFound } from 'next/navigation'

/**
 * A rota antiga /admin deixou de existir.
 *
 * O painel agora vive em ADMIN_PATH (definido no .env). Qualquer acesso a
 * /admin ou /admin/... cai aqui e recebe a página 404 padrão, sem redirecionar
 * e sem revelar o endereço novo.
 */
export default function RotaAntigaAdmin() {
  notFound()
}
