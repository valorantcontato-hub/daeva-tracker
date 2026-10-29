# Daeva Tracker — AION 2

Tracker leve para AION 2 com dados **reais**:

- **DPS ao vivo** da sua party nas DGs: nomes, classes e skills reais (com ícones oficiais), HP do chefe, gráfico e detalhamento por skill.
- **Conta e party**: perfil real da PlayNC (CP, item level, atributos, Daevanion, equipamentos e skills). Vinculado automaticamente pela captura.
- **Bestiário**: cada mob que você mata entra sozinho com o nome oficial, e os abates contam para os marcos **5 / 25 / 75**.
- **Widgets de overlay**: DPS da party, Skills e Farm, cada um numa janela que fica por cima do jogo.

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

### Atualização automática

O app procura versões novas no GitHub Releases ao abrir e a cada 4 horas, baixa em segundo plano e instala ao reiniciar (aparece uma faixa “Reiniciar e atualizar”). Nunca é preciso baixar um instalador novo.

O workflow `.github/workflows/release.yml` publica as versões:
- **a cada 6 horas** confere o motor de captura; se ele mudou (ex.: opcodes corrigidos após um patch do jogo), gera e publica uma versão nova sozinho;
- **tag `v*`** (`git tag v0.2.0 && git push --tags`) publica uma versão manual.

Para ligar: crie um repositório **público** no GitHub, rode `node tools/set-publish.mjs <seu-usuario> <repositorio>` e faça push. O primeiro instalador sai da primeira execução do workflow (Actions > Release > Run workflow).

## Desenvolvimento

1. `npm install`, [.NET 10 SDK](https://dotnet.microsoft.com/download) e Npcap.
2. Compile a captura: `powershell -ExecutionPolicy Bypass -File capture\setup.ps1` (o motor fica em `%LOCALAPPDATA%\DaevaTracker\engine`).
3. `npm start` abre o app e inicia `capture\bin\daeva-capture.exe` sozinho.
4. `npm run dist` gera o instalador em `dist\` (captura com o runtime .NET embutido).

Opções da captura: `--url http://localhost:4173` (app no navegador com `npm run web`), `--boss-only` (só dano em chefes), `--replay arquivo.pcap`.
Se um patch do jogo mudar os opcodes, coloque um `opcodes.json` atualizado (formato do Aion2DpsMeter) em `%APPDATA%\DaevaTracker\`.

## Testar sem o jogo

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
