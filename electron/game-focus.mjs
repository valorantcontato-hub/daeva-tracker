/** Dragging a Lotus overlay keeps the game context; other applications don't. */
export function gameFocusAllows(message, overlayHandles, previouslyAllowed) {
  return message.game === true || (previouslyAllowed && overlayHandles.includes(String(message.handle)));
}
