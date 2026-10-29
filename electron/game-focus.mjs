/** Dragging a Lotus overlay keeps the game context; other applications don't. */
export function gameFocusAllows(message, overlayHandles, previouslyAllowed) {
  return message.game === true || (previouslyAllowed && overlayHandles.includes(String(message.handle)));
}

/**
 * O overlay só existe (janela visível) com o jogo em primeiro plano há um instante e com atividade.
 * Esconder de verdade em vez de deixar a janela transparente por cima evita mexer em estilos da janela
 * durante o alt-tab, que deixava o jogo preso com o cursor no centro.
 */
export function overlayShouldShow({ gameAllowed, since, now, manualHidden, active, positioning = false, delayMs = 600 }) {
  if (positioning) return true; // modo posicionar: mostra tudo, com o jogo em foco ou não
  return !!gameAllowed && !manualHidden && active !== false && now - since >= delayMs;
}
