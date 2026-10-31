/**
 * Backfill dos códigos de agendamento.
 *
 * - Gera código novo (criptográfico, 8 chars, sem ambíguos) para registros
 *   antigos que ainda usam o cuid() do banco;
 * - Normaliza para MAIÚSCULAS códigos válidos em minúsculas.
 *
 * Uso: node prisma/backfill-codigos.mjs
 */
import { PrismaClient } from '@prisma/client'
import { randomInt } from 'crypto'

const prisma = new PrismaClient()
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function gerarCodigo() {
  let codigo = ''
  for (let i = 0; i < 8; i++) codigo += ALFABETO[randomInt(ALFABETO.length)]
  return codigo
}

function codigoValido(codigo) {
  return (
    typeof codigo === 'string' &&
    codigo.length === 8 &&
    [...codigo].every(caractere => ALFABETO.includes(caractere))
  )
}

const existentes = await prisma.agendamento.findMany({ select: { id: true, codigo: true } })
const usados = new Set(existentes.map(a => normalizar(a.codigo)))

function normalizar(codigo) {
  return String(codigo || '').trim().toUpperCase()
}

let atualizados = 0
for (const agendamento of existentes) {
  const normalizado = normalizar(agendamento.codigo)

  if (codigoValido(normalizado)) {
    if (normalizado !== agendamento.codigo) {
      await prisma.agendamento.update({
        where: { id: agendamento.id },
        data: { codigo: normalizado },
      })
      console.log(`${agendamento.codigo} -> ${normalizado} (normalizado)`)
      atualizados++
    }
    continue
  }

  let novo = ''
  do {
    novo = gerarCodigo()
  } while (usados.has(novo))

  await prisma.agendamento.update({ where: { id: agendamento.id }, data: { codigo: novo } })
  usados.add(novo)
  atualizados++
  console.log(`${agendamento.codigo} -> ${novo}`)
}

console.log(`Backfill concluído: ${atualizados} código(s) atualizado(s).`)
await prisma.$disconnect()
