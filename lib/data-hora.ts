/**
 * Converte um data_hora vindo do banco (coluna timestamptz de
 * corridas_empresa) num Date real, tratando o valor como horario nominal
 * de Brasilia (-03:00).
 *
 * O insert grava a string sem fuso explicito (ex: "2026-07-31T06:45:00"),
 * entao o Postgres assume UTC na gravacao em vez de -03:00 — o valor fica
 * gravado 3h adiantado em relacao a intencao real. O PostgREST devolve
 * isso com um offset "+00:00" que NAO reflete o fuso pretendido, e sim
 * esse erro de gravacao.
 *
 * Por isso sempre ignoramos qualquer offset que venha na string e tratamos
 * os primeiros 19 caracteres (YYYY-MM-DDTHH:mm:ss) como horario nominal de
 * Brasilia — igual ao que o resto do app faz ao exibir via slice().
 */
export function dataHoraBrasilia(valor: string): Date {
  const semOffset = valor.trim().slice(0, 19).replace(' ', 'T')
  return new Date(`${semOffset}-03:00`)
}
