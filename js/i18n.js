// Interface em inglês. O app é escrito em português; no modo inglês este módulo traduz, na própria
// tela, tudo o que aparece (textos, dicas, placeholders, avisos), inclusive o que é desenhado depois.
// Os NOMES DO JOGO (itens, skills, classes, títulos) não passam por aqui: vêm do site oficial
// da PlayNC já no idioma escolhido (veja profiles.js e server.mjs).
import { getLang } from './lang.js';

// Texto completo em português -> inglês.
const EXACT = {
  "Boneco de Treinamento": "Training Dummy",
  "Coleção do jogo": "In-game collection",
  "Monstros · abates do app": "Monsters · app kills",
  "Em progresso": "In progress",
  "Faltando": "Missing",
  "Completos": "Completed",
  "Não sincronizados": "Not synchronized",
  "Não sincronizado": "Not synchronized",
  "Completo": "Complete",
  "Nome do treino": "Run name",
  "Tempo (segundos)": "Time (seconds)",
  "Adicionar e iniciar": "Add and start",
  "Cancelar treino": "Cancel run",
  "Tentativas": "Runs",
  "Selecione duas concluídas para comparar.": "Select two completed runs to compare.",
  "Nenhuma tentativa ainda.": "No runs yet.",
  "Pronto": "Ready",
  "Em andamento": "In progress",
  "Concluído": "Completed",
  "Cancelado": "Cancelled",
  "Interrompido": "Interrupted",
  "Iniciar": "Start",
  "Comparativo": "Comparison",
  "Tempo medido": "Measured time",
  "Tempo A / B": "Time A / B",
  "Crítico A → B": "Critical A → B",
  "Dano A → B": "Damage A → B",
  "Dano A": "Damage A",
  "Dano B": "Damage B",
  "Média": "Average",
  "Tentativas cronometradas. Somente o seu dano no boneco é contado.": "Timed runs. Only your own damage to the training dummy counts.",
  "Adicione uma tentativa e inicie. A contagem começa após 5 segundos.": "Add a run and start. Measurement begins after 5 seconds.",
  "Finalizando a medição…": "Finishing measurement…",
  "Nenhum dano registrado no intervalo.": "No damage recorded during this interval.",
  "Os tempos são diferentes. Use o DPS para comparar a taxa de dano.": "Durations differ. Use DPS to compare damage rate.",
  "As tentativas usaram bonecos diferentes.": "The runs used different dummies.",
  "Deslize a tabela para ver todas as colunas.": "Scroll the table to see every column.",
  "Aguardando a coleção do jogo. Com a captura atualizada e ligada, volte à seleção de personagens e entre novamente. Até receber a lista, o progresso fica desconhecido.": "Waiting for the in-game collection. With updated capture running, return to character selection and enter again. Progress remains unknown until the list is received.",
  "Abates observados pelo app. Esse histórico não recupera abates anteriores e não equivale às almas da coleção.": "Kills observed by this app. This history cannot recover previous kills and does not equal collection souls.",
  "Nenhuma luta contra boss ainda": "No boss fights yet",
  "Favoritos do bestiário, com o progresso de almas lido do jogo.": "Bestiary favorites with soul progress read from the game.",
  'Anterior': 'Previous', 'Próxima': 'Next',
  'Vincule o seu personagem para organizar as macros.': 'Link your character to organize macros.',
  '+ Nova macro': '+ New macro', 'Macros salvas': 'Saved macros', 'Comandos': 'Commands',
  'Salvar macro': 'Save macro', 'Excluir macro': 'Delete macro', 'Macro salva.': 'Macro saved.',
  'Nenhuma macro salva.': 'No saved macros.',
  'Anotações e comandos salvos para este personagem. A execução é feita por você no jogo.': 'Notes and commands saved for this character. You run them yourself in game.',
  'Sem abates registrados': 'No recorded kills', 'Progresso registrado': 'Recorded progress',
  'Foto do monstro': 'Monster photo', 'Foto indisponível': 'Photo unavailable', 'Sem foto': 'No photo',
  // Navegação e topo
  'Início': 'Home', 'Intelectual': 'Intellect', 'Feral': 'Feral', 'Natural': 'Natural', 'Variante': 'Variant', 'Especial': 'Special', 'Imagens dos monstros:': 'Monster images:', 'Imagens:': 'Images:', 'Bestiário': 'Bestiary', 'Mascotes': 'Pets', 'Conta': 'Account', 'Contas': 'Accounts', 'Alternar tema claro/escuro': 'Toggle light/dark theme',
  'Alternar tema': 'Toggle theme', 'Seções': 'Sections', 'Idioma': 'Language', 'Janela': 'Window', 'Minimizar': 'Minimize', 'Fechar': 'Close',
  // Ficha do personagem
  'Personagem': 'Character', 'Menu do personagem': 'Character menu', 'Equipamentos': 'Equipment', 'Aparência': 'Appearance',
  'Arcanas': 'Arcana', 'Atributos': 'Attributes', 'Sem itens de aparência.': 'No appearance items.',
  'Abrir com o Windows': 'Open with Windows',
  'A captura já fica rodando quando o jogo abrir, e o app reconhece o personagem sozinho': 'Capture is already running when the game opens, so the app recognizes your character on its own',
  'Seu personagem aparece aqui': 'Your character appears here',
  'Buscar meu personagem': 'Find my character', 'Abrir minha conta': 'Open my account',
  'Atualizar': 'Refresh', 'Atualizando…': 'Refreshing…', 'Perfil atualizado': 'Profile updated',
  // Skills
  'Skills ativas': 'Active skills', 'Skills passivas': 'Passive skills', 'Stigmas': 'Stigmas',
  'As skills que contam no widget de DPS.': 'The skills counted in the DPS widget.',
  '✔ Equipada': '✔ Equipped', 'Não equipada': 'Not equipped',
  'Vincule o seu personagem para ver as skills.': 'Link your character to see your skills.',
  // Daevanion
  'Pontos do tabuleiro': 'Board points', 'Efeitos de habilidade': 'Skill effects', 'Efeitos de atributo': 'Attribute effects',
  'Carregando…': 'Loading…', 'Tabuleiro vazio.': 'Empty board.', 'Casa': 'Node', '✔ Aberta': '✔ Open', '✖ Fechada': '✖ Closed',
  'Vincule o seu personagem para ver os tabuleiros.': 'Link your character to see the boards.',
  'Atualize o perfil do personagem para carregar os tabuleiros.': 'Refresh the character profile to load the boards.',
  // Tooltip de item
  'Atributos principais': 'Main attributes', 'Atributos adicionais': 'Additional attributes', 'Habilidades': 'Skills',
  'Pedras mágicas': 'Magic stones', 'Detalhes indisponíveis.': 'Details unavailable.',
  // Conta
  'Buscar personagem': 'Search character', 'Nome do personagem': 'Character name', 'Região': 'Region', 'Buscar': 'Search',
  'Buscando…': 'Searching…', 'Nenhum personagem encontrado.': 'No character found.', 'Minha party': 'My party',
  'Sou eu': 'This is me', '+ Party': '+ Party', 'Na party': 'In party', 'Eu': 'Me', 'Remover da party': 'Remove from party',
  'Nenhum personagem vinculado': 'No character linked', 'Use a busca ao lado para encontrar seu personagem.': 'Use the search to find your character.',
  'Buscando perfil na PlayNC…': 'Fetching profile from PlayNC…',
  'Europa': 'Europe', 'NA Leste': 'NA East', 'NA Oeste': 'NA West', 'América Latina': 'Latin America', 'Ásia/Oceania': 'Asia/Oceania',
  // Widgets
  'Abrir janela': 'Open window', 'No jogo': 'In game', 'Posição': 'Position', 'Opacidade': 'Opacity', 'Somente chefe': 'Boss only',
  '(ignora mobs comuns; conta só o dano no chefe)': '(ignores regular mobs; counts only damage to the boss)',
  'Livre (arrastar)': 'Free (drag)', '↖ Superior esquerdo': '↖ Top left', '↗ Superior direito': '↗ Top right',
  '↙ Inferior esquerdo': '↙ Bottom left', '↘ Inferior direito': '↘ Bottom right',
  'Travar (clique passa para o jogo)': 'Lock (clicks go through to the game)',
  'Travar (o clique passa para o jogo). Destrave com Ctrl+Shift+L': 'Lock (clicks go through to the game). Unlock with Ctrl+Shift+L',
  'Fechar widget': 'Close widget',
  'Cada widget é uma janela separada por cima do jogo. Arraste pela barra do título e redimensione pelas bordas.': 'Each widget is a separate window on top of the game. Drag it by the title bar and resize it by the edges.',
  'Ranking de DPS da party na luta atual, com classe e porcentagem do dano.': "Party DPS ranking for the current fight, with class and damage share.",
  'Dano de cada skill do seu personagem. Mostra só as skills ativas — sem stigmas e passivas.': "Damage of each of your character's skills. Shows only active skills — no stigmas or passives.",
  'Monstros marcados como “Farmando agora”, com +1 rápido e os marcos 5 / 25 / 75.': 'Monsters marked as “Farming now”, with a quick +1 and the 5 / 25 / 75 milestones.',
  'Nenhuma luta contra chefe ainda.': 'No boss fight yet.', 'Sem lutas ainda.': 'No fights yet.',
  'Seu personagem ainda não foi identificado nesta luta.': "Your character hasn't been identified in this fight yet.",
  'Nenhuma skill ativa usada ainda.': 'No active skill used yet.', 'Marque monstros com ★ no Bestiário.': 'Mark monsters with ★ in the Bestiary.',
  'Widget desconhecido.': 'Unknown widget.', '· chefe': '· boss',
  'No navegador os widgets abrem como janelas comuns. Para ficarem por cima do jogo, use o app desktop.': 'In the browser, widgets open as regular windows. To keep them on top of the game, use the desktop app.',
  // DPS
  'Encontros': 'Encounters', 'Importar': 'Import', 'Importar log': 'Import log', 'Exportar': 'Export', 'Excluir': 'Delete',
  'Vitória': 'Victory', 'Ao vivo': 'Live', 'Exemplo': 'Sample', 'DPS da party': 'Party DPS', 'Dano total': 'Total damage',
  'Duração': 'Duration', 'Maior DPS': 'Top DPS', 'HP do chefe': 'Boss HP', 'Tempo do boss': 'Boss time', 'Tempo boss': 'Boss time', 'Dano da party': 'Party damage',
  'Toque num jogador para ver as skills': "Tap a player to see their skills", 'Jogador': 'Player', 'Dano': 'Damage', 'Média': 'Avg', 'Máx': 'Max',
  'DPS ao longo do tempo': 'DPS over time', 'média móvel de 5s': '5s moving average', 'Escolher encontro': 'Choose encounter',
  'Nenhuma luta ainda': 'No fights yet', 'Ver demonstração': 'See demo', 'Nenhum encontro salvo': 'No saved encounters',
  'DPS ao vivo': 'Live DPS', 'Jogadores': 'Players',
  // Bestiário
  'Todos': 'All', 'Treino': 'Training', 'MÁX.': 'MAX', 'Farmando': 'Farming', 'Sem foto': 'No photo', '★ Farmando': '★ Farming', 'Em progresso': 'In progress', 'Não iniciado': 'Not started', 'Completo': 'Complete',
  '+ Monstro': '+ Monster', 'Novo monstro': 'New monster', 'Editar monstro': 'Edit monster', 'Nome': 'Name', 'Nível': 'Level', 'Abates': 'Kills',
  'Salvar': 'Save', 'Cancelar': 'Cancel', 'Todas as regiões': 'All regions', 'Progresso geral': 'Overall progress',
  'Buscar monstro, região ou nota…': 'Search monster, region or note…', 'Buscar': 'Search', 'Farmando agora': 'Farming now',
  '★ Farmando agora': '★ Farming now', 'Nada por aqui': 'Nothing here', 'Nenhum monstro corresponde aos filtros.': 'No monster matches the filters.',
  'Marcar como farmando agora': 'Mark as farming now', 'Farmando agora ': 'Farming now ', 'Editar': 'Edit',
  'Clique para digitar o valor': 'Click to type the value', 'Quantidade de abates': 'Number of kills',
  'Completo ✓': 'Complete ✓', 'Mundo aberto': 'Open world', 'Detectado pela captura': 'Detected by capture',
  'Skills de': 'Skills of', 'Os membros entram sozinhos nas lutas contra chefes, ou use a busca em Conta (+ Party).': 'Members join automatically in boss fights, or use the search in Account (+ Party).', 'Ex.: perto do obelisco norte': 'E.g.: near the north obelisk', 'Nota / local': 'Note / location', 'Filtro': 'Filter',
  'Atalhos globais:': 'Global shortcuts:', 'mostra/esconde os widgets no jogo': 'shows/hides the widgets in game',
  'Remover 1 abate': 'Remove 1 kill', 'Adicionar 1 abate': 'Add 1 kill', 'Adicionar 5 abates': 'Add 5 kills',
  // Faixa do app desktop
  'Reiniciar e atualizar': 'Restart and update', 'Baixar Npcap': 'Download Npcap', 'Já instalei': 'Already installed',
  // Avisos
  'Servidor local offline. Rode "node server.mjs" ou abra o app desktop.': 'Local server offline. Run "node server.mjs" or open the desktop app.',
  'Perfil atualizado.': 'Profile updated.',
};

// Textos com números/nomes no meio.
const RULES = [
  [/^Prepare-se: (\d+)$/, 'Get ready: $1'],
  [/^Combe agora · (.+) restantes · (.+) DPS$/, 'Go now · $1 remaining · $2 DPS'],
  [/^Nv\. (\d+) · (\d+)\/(\d+) almas$/, 'Lv. $1 · $2/$3 souls'],
  [/^(\d+) almas até o nível III$/, '$1 souls to level III'],
  [/^(\d+) abates no app$/, '$1 kills in app'],
  [/^(\d+) \/ (\d+) completos · (\d+) favoritos$/, '$1 / $2 complete · $3 favorites'],
  [/^Coleção recebida do jogo em (.+)\. O último estado fica salvo para este personagem\.$/, 'Collection received from the game at $1. The last state is saved for this character.'],
  [/^(\d+)–(\d+) \/ (\d+) monstros$/, '$1–$2 / $3 monsters'],
  [/^1 jogadores$/, '1 player'], [/^Dano ([↓↑])$/, 'Damage $1'], [/^Média ([↓↑])$/, 'Avg $1'], [/^Máx ([↓↑])$/, 'Max $1'],
  [/^Nível (\d+)$/, 'Level $1'], [/^Nv\. (\d+)$/, 'Lv. $1'], [/^Nv\. (.+)$/, 'Lv. $1'],
  [/^(\d+) equipadas · (\d+) no total$/, '$1 equipped · $2 total'],
  [/^(.+) · (\d+) jogadores$/, '$1 · $2 players'], [/^(\d+) jogadores$/, '$1 players'],
  [/^Encontros \((\d+)\)$/, 'Encounters ($1)'],
  [/^(\d+) membro\(s\)$/, '$1 member(s)'],
  [/^(\d+) itens$/, '$1 items'],
  [/^(.+) · (\d+) de (\d+) casas abertas$/, '$1 · $2 of $3 nodes open'],
  [/^(\d+) \/ (\d+) casas$/, '$1 / $2 nodes'],
  [/^Skills de (.+)$/, '$1’s skills'],
  [/^Excluir o encontro "(.+)"\?$/, 'Delete encounter "$1"?'],
  [/^(\d+) abates?$/, '$1 kills'], [/^faltam (\d+) p\/ (I+)$/, '$1 to go for $2'], [/^faltam (\d+)$/, '$1 to go'],
  [/^· faltam (\d+)$/, '· $1 to go'], [/^· completo$/, '· complete'],
  [/^(\d+) marcos · (\d+) abates$/, '$1 milestones · $2 kills'], [/^(\d+)\/(\d+) marcos · (\d+) abates$/, '$1/$2 milestones · $3 kills'],
  [/^(\d+)\/(\d+) completos$/, '$1/$2 complete'], [/^(\d+) abates, editar$/, '$1 kills, edit'], [/^Marco ([IVX]+)$/, 'Milestone $1'],
  [/^(.+) alcançado!$/, '$1 reached!'], [/^(.+): marco ([IVX]+) \((\d+)\) alcançado!$/, '$1: milestone $2 ($3) reached!'],
  [/^(.+): marco de (\d+) abates alcançado!$/, '$1: $2-kill milestone reached!'],
  [/^Marcos de abate por monstro:/, 'Kill milestones per monster:'],
  [/^(.+) vinculado como você$/, '$1 linked as you'], [/^(.+) adicionado à party$/, '$1 added to the party'],
  [/^Vitória$/, 'Victory'],
  [/^Nova versão (.+) pronta\.$/, 'New version $1 ready.'], [/^Baixando atualização… (\d+)%$/, 'Downloading update… $1%'],
  [/^(\d+) importados?$/, '$1 imported'],
  [/^Detalhes de (.+)$/, '$1 details'],
  [/^Remover (.+)$/, 'Remove $1'], [/^Editar (.+)$/, 'Edit $1'],
  [/^Vínculo da alma: (.+)%$/, 'Soul bind: $1%'],
  [/^Prévia (.+)$/, '$1 preview'],
  [/^(.+) · (.+)$/, null], // reservado: tratado pela divisão abaixo
];

// Frases longas (parágrafos) por trecho.
const PHRASES = [
  ['Catálogo de monstros com fotos quando disponíveis. Os abates são os registrados neste app; o histórico anterior da conta não é sincronizado. Zero registrado não confirma que esteja faltando no jogo.', 'Monster catalog with photos when available. Kills are those recorded in this app; previous account history is not synchronized. Zero recorded does not confirm that it is missing in game.'],
  ['Abates registrados neste app. O histórico anterior da conta e o catálogo completo não são fornecidos pelo perfil público; zero aqui não confirma que o monstro esteja faltando no jogo.', 'Kills recorded in this app. The public profile does not provide previous account history or the full catalog; zero here does not mean the monster is missing in game.'],
  ['Os membros entram sozinhos nas lutas contra chefes, ou use a busca em Conta (+ Party).', 'Members are linked automatically during boss fights, or use Account search (+ Party).'],
  ['O jogo só informa o nome do personagem ao teleportar ou entrar numa DG. Faça um desses com o app aberto e o', 'The game only reveals your character name when you teleport or enter a dungeon. Do one of those with the app open and'],
  ['Lotus Tracker carrega o visual e os equipamentos sozinho — nas próximas vezes ele já lembra de você.', 'Lotus Tracker loads your look and equipment by itself — next time it already remembers you.'],
  ['Ou vincule agora pela busca.', 'Or link it now using search.'],
  ['Nenhuma luta ainda', 'No fights yet'],
  ['Abra o jogo com a captura ligada', 'Open the game with capture running'],
  ['A luta aparece aqui ao vivo, com os nomes, classes e skills reais da party.', 'The fight shows up here live, with the real names, classes and skills of your party.'],
  ['Para ver o DPS ao vivo, instale o', 'To see live DPS, install'],
  ['(marque “WinPcap API-compatible Mode”).', '(check “WinPcap API-compatible Mode”).'],
  ['A captura não foi encontrada. Reinstale o app ou rode', 'Capture not found. Reinstall the app or run'],
  ['Com a captura ligada, cada monstro que você mata entra aqui sozinho, com o nome oficial do jogo, e os abates são contados automaticamente. Você também pode usar “+ Monstro” ou importar uma lista.', 'With capture running, every monster you kill is added here automatically with its official game name, and kills are counted for you. You can also use “+ Monster” or import a list.'],
  ['Adicione monstros com “+ Monstro” ou importe uma lista.', 'Add monsters with “+ Monster” or import a list.'],
  ['Busque seu personagem e marque “Sou eu”. Depois adicione os membros da party: nomes, classes e ícones de skills no medidor de DPS vêm daqui.', 'Search for your character and mark “This is me”. Then add your party members: names, classes and skill icons in the DPS meter come from here.'],
  ['Atalhos globais', 'Global shortcuts'],
  ['mostra/esconde os widgets no jogo', 'shows/hides the widgets in game'],
  ['trava/destrava todos. Use o jogo em', 'locks/unlocks all. Use the game in'],
  ['Janela', 'Windowed'], ['Tela cheia sem bordas', 'Borderless fullscreen'],
  ['mostra/esconde os widgets no jogo ·', 'shows/hides the widgets in game ·'],
  ['No navegador os widgets abrem como janelas comuns. Para ficarem', 'In the browser, widgets open as regular windows. To keep them'],
  ['por cima do jogo', 'on top of the game'], [', use o app desktop.', ', use the desktop app.'],
];

const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'alt'];

function tr(text) {
  const s = text.trim();
  if (!s) return text;
  let out = EXACT[s];
  if (out === undefined) {
    for (const [re, rep] of RULES) {
      if (rep && re.test(s)) { out = s.replace(re, rep); break; }
    }
  }
  if (out === undefined) {
    let t = s, changed = false;
    for (const [pt, en] of PHRASES) if (t.includes(pt)) { t = t.split(pt).join(en); changed = true; }
    if (changed) out = t;
  }
  // "A · B" (rótulos compostos): traduz cada parte.
  if (out === undefined && s.includes(' · ')) {
    const parts = s.split(' · ');
    const mapped = parts.map(p => tr(p));
    if (mapped.some((p, i) => p !== parts[i])) out = mapped.join(' · ');
  }
  return out === undefined ? text : text.replace(s, out);
}

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName)) return;
    const next = tr(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  for (const a of ATTRS) {
    if (node.hasAttribute?.(a)) {
      const v = node.getAttribute(a), next = a === 'data-tip' ? v.split('\n').map(tr).join('\n') : tr(v);
      if (next !== v) node.setAttribute(a, next);
    }
  }
  for (const child of node.childNodes) translateNode(child);
}

export function initI18n() {
  if (getLang() !== 'en-US') return;
  document.documentElement.lang = 'en';
  const fixTitle = () => { const t = tr(document.title); if (t !== document.title) document.title = t; };
  translateNode(document.body);
  fixTitle();
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(translateNode);
      else if (m.type === 'characterData') translateNode(m.target);
      else if (m.type === 'attributes') translateNode(m.target);
    }
    fixTitle();
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
