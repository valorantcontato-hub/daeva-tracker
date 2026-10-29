// Bloco de notas de macros por personagem; não envia comandos nem automatiza o jogo.
import { load, save } from '../store.js';
import { getMe } from '../profiles.js';
import { esc, uid, toast } from '../util.js';

export function renderMacros(root, _params, profile) {
  const me = profile || getMe();
  root.className = 'page macros-page';
  if (!me) {
    root.innerHTML = '<div class="card empty"><h1>Macros</h1><p class="muted">Vincule o seu personagem para organizar as macros.</p></div>';
    return;
  }
  const key = 'macros:' + JSON.stringify([me.region, me.serverId, me.characterId]);
  let macros = load(key, []);
  let selected = macros[0]?.id || '';
  root.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Macros</h2><button class="btn sm" data-act="new">+ Nova macro</button></div>
      <p class="muted small">Anotações e comandos salvos para este personagem. A execução é feita por você no jogo.</p>
      <div class="macro-layout"><nav class="macro-list" aria-label="Macros salvas"></nav>
        <form class="macro-editor">
          <label>Nome<input name="name" required maxlength="60" autocomplete="off"></label>
          <label>Comandos<textarea name="commands" rows="10" maxlength="10000" spellcheck="false" required></textarea></label>
          <div class="head-actions"><button class="btn primary" type="submit">Salvar macro</button><button class="btn ghost" type="button" data-act="delete">Excluir macro</button></div>
          <span class="small muted" role="status" id="macro-status"></span>
        </form>
      </div>
    </section>`;
  const form = root.querySelector('form');
  let dirty = false;
  function draw() {
    const current = macros.find(m => m.id === selected);
    root.querySelector('.macro-list').innerHTML = macros.map(m => `<button type="button" class="btn ${m.id === selected ? 'primary' : ''}" data-macro="${esc(m.id)}">${esc(m.name)}</button>`).join('') || '<p class="small muted">Nenhuma macro salva.</p>';
    form.elements.name.value = current?.name || '';
    form.elements.commands.value = current?.commands || '';
    root.querySelector('[data-act="delete"]').disabled = !current;
    dirty = false;
  }
  const discard = () => !dirty || confirm('Descartar as alterações não salvas desta macro?');
  form.addEventListener('input', () => { dirty = true; root.querySelector('#macro-status').textContent = ''; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name.value.trim(), commands = form.elements.commands.value.trim();
    if (!name || !commands) return;
    const macro = { id: selected || uid(), name, commands };
    const next = [...macros.filter(m => m.id !== macro.id), macro];
    if (!save(key, next)) return toast('Não foi possível salvar a macro.');
    macros = next; selected = macro.id; draw();
    root.querySelector('#macro-status').textContent = 'Macro salva.';
  });
  root.addEventListener('click', e => {
    const item = e.target.closest('[data-macro]');
    const action = e.target.closest('[data-act]')?.dataset.act;
    if (item && discard()) { selected = item.dataset.macro; draw(); }
    if (action === 'new' && discard()) { selected = ''; draw(); form.elements.name.focus(); }
    if (action === 'delete' && selected && confirm('Excluir esta macro?')) {
      const next = macros.filter(m => m.id !== selected);
      if (!save(key, next)) return toast('Não foi possível salvar a alteração.');
      macros = next; selected = macros[0]?.id || ''; draw();
    }
  });
  draw();
}
