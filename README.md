# Daeva Tracker — AION 2

Tracker leve para AION 2 com dados **reais**:

- **DPS ao vivo** da sua party nas DGs: nomes, classes e skills reais (com ícones oficiais), HP do chefe, gráfico e detalhamento por skill.
- **Conta e party**: perfil real da PlayNC (CP, item level, atributos, Daevanion, equipamentos e skills). Vinculado automaticamente pela captura.
- **Bestiário**: cada mob que você mata entra sozinho com o nome oficial, e os abates contam para os marcos **5 / 25 / 75**.
- **Widgets de overlay**: DPS da party, Skills e Farm, cada um numa janela que fica por cima do jogo.
- **Macros**: notas e comandos salvos por personagem, no menu da ficha. O app não executa comandos no jogo.

O bestiário separa abates e favoritos por personagem (região + servidor + ID). O catálogo local pode
ter fotos associadas pela edição do monstro, pela importação ou pelo campo `icon` da captura.
Sem imagem conhecida, mostra “Sem foto”. Os contadores são os registrados no app: o perfil público
não fornece o histórico completo da conta nem o catálogo de monstros com fotos. Zero registrado
não significa que o monstro esteja faltando no jogo. Os filtros acompanham a mudança de progresso.
Ao atualizar, os dados antigos são preservados e migrados para o primeiro personagem vinculado,
sem repetir os mesmos abates nos demais personagens.

## Como funciona

```
AION 2 ──(tráfego de rede, leitura passiva)──> daeva-capture.exe (iniciado pelo app)
                                                     │ POST /api/live (snapshots ~2x/s)
PlayNC (perfis oficiais) <──proxy── server.mjs <─────┘
                                       │ SSE /api/live/stream
                         app (Electron) + widgets de overlay
```

- **Captura**: `capture/` é uma ponte em C# que usa o motor do [Aion2DpsMeter](https://github.com/domel1998/Aion2DPSMeter) (Npcap, só leitura, sem tocar na memória do jogo nem alterar pacotes). Ele decodifica dano, skills, nomes da party, HP e mortes, e traz as tabelas oficiais de skills, NPCs e DGs.
- **Perfis**: `server.mjs` consulta os endpoints JSON do site oficial (`aion2.plaync.com`, `api-search.plaync.com`). Eles não são documentados e podem mudar.

## Para quem joga (instalador)

1. Instale o **[Npcap](https://npcap.com)** marcando *"WinPcap API-compatible Mode"* (o app avisa se faltar).
2. Rode o instalador `Daeva Tracker Setup x.y.z.exe`. Não precisa de .NET nem de Node.
3. Abra o app: ele inicia a captura sozinho. Jogue em **Janela** ou **Tela cheia sem bordas**.
4. Em **Widgets**, ligue os que quiser e posicione nos cantos. `Ctrl+Shift+L` trava (clique atravessa), `Ctrl+Shift+H` mostra/oculta.

### Atualização automática (nunca baixe outro instalador)

| O que mudou | Como chega no app instalado | Tempo |
|---|---|---|
| Interface (`index.html`, `css/`, `js/`, `icons/`) | O app baixa só os arquivos alterados do `main` e recarrega as janelas, sem reiniciar | ~1 min após o push |
| Código do app (`electron/`, `server.mjs`, `capture/`, dependências) | O workflow publica uma versão nova; o app baixa e mostra “Reiniciar e atualizar” | build (~10 min) + até 15 min |
| Motor de captura (patch do jogo) | O workflow confere a cada 6 h e publica uma versão nova sozinho | até 6 h |

O workflow `.github/workflows/release.yml` também aceita versão manual por tag (`git tag v0.2.0 && git push --tags`) ou por Actions > Release > Run workflow.

## Desenvolvimento

1. `npm install`, [.NET 10 SDK](https://dotnet.microsoft.com/download) e Npcap.
2. Compile a captura: `powershell -ExecutionPolicy Bypass -File capture\setup.ps1` (o motor fica em `%LOCALAPPDATA%\DaevaTracker\engine`).
3. `npm run dev` abre o app, inicia a captura e entra em modo de teste em tempo real:
   - salvou um arquivo de interface → todas as janelas (app e widgets) recarregam na hora;
   - salvou `electron/`, `server.mjs`, `js/encounter.js` ou `js/util.js` → o app reinicia sozinho.
4. Gostou? `git push` — o app instalado recebe a mudança sozinho (tabela acima).
5. `npm run dist` gera um instalador local em `dist\` (precisa de um caminho de pasta curto; o GitHub Actions já faz isso).

Opções da captura: `--url http://localhost:4173` (app no navegador com `npm run web`), `--boss-only` (só dano em chefes), `--replay arquivo.pcap`.
Se um patch do jogo mudar os opcodes, coloque um `opcodes.json` atualizado (formato do Aion2DpsMeter) em `%APPDATA%\DaevaTracker\`.

## Testar sem o jogo

Testes de estado, migração do bestiário, catálogo de skills e identificação da party:

```bash
node --test tests/state.test.mjs
```

```bash
node tools/fake-capture.mjs --self "SeuNome" --server 2301 --skills "17010000:Earth's Retribution"
```
Envia snapshots no mesmo formato da ponte de captura (números simulados). `tools/replay.mjs` envia eventos crus.

## Licença

A ponte `capture/` depende do Aion2DpsMeter, que é **GPL-3.0**. Se você distribuir o Daeva Tracker junto com a captura, o projeto precisa ser distribuído sob a GPL-3.0 (código-fonte aberto).

## Estrutura

```
server.mjs              arquivos, proxy PlayNC, feed ao vivo (/api/live)
electron/               app desktop, overlay, captura e auto-update
capture/                ponte de captura (C#) + setup.ps1
js/views/               dps, bestiary, account, widgets
js/live.js              feed ao vivo, histórico, contagem de abates, vínculo de perfis
js/profiles.js          perfis PlayNC e ícones reais de skill
js/icons.js             emblemas oficiais de classe + ícones
tools/                  simuladores e set-publish.mjs
.github/workflows/      release automático (GitHub Releases)
```
