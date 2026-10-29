/** O personagem não anda dentro da loja: se ele se afastou do ponto onde a loja foi lida, a loja foi fechada. */
export const SHOP_LEAVE_UNITS = 300; // 3 m (a unidade do jogo é 1 cm)
export const leftShop = (anchor, self, limit = SHOP_LEAVE_UNITS) =>
  !!anchor && Number.isFinite(self?.x) && Number.isFinite(self?.y) && Math.hypot(self.x - anchor.x, self.y - anchor.y) > limit;
