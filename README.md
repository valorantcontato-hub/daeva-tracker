# Lotus Tracker — AION 2

Tracker leve para AION 2 com dados **reais**:

- **DPS ao vivo** da sua party nas DGs: nomes, classes e skills reais (com ícones oficiais), HP do chefe, gráfico e detalhamento por skill.
- **Conta e party**: perfil real da PlayNC (CP, item level, atributos, Daevanion, equipamentos e skills). Vinculado automaticamente pela captura.
- **Boss**: histórico e status de DPS dos chefes finais de DG identificados no catálogo. Intermediários e bonecos não entram nessa página.
- **Boneco de Treinamento**: tentativas com nome, duração, preparação de 5 segundos, dano próprio e comparação de duas tentativas concluídas.
- **Bestiário**: coleção de 207 pets, com níveis e almas lidos do jogo; catálogo de monstros e abates locais em uma aba separada.
- **Widgets de overlay**: DPS da party, Skills e Farm, cada um numa janela que fica por cima do jogo.

A interface usa um único tema escuro. A janela compacta abre em 580 × 940 px, limitada à área útil
do monitor. O Início ajusta a altura dos itens ao espaço disponível, incluindo a faixa de atualização,
para caber sem rolagem. Equipamentos, aparência e arcanas ficam empilhados; Aparência prioriza
a asa visual equipada e não repete a asa base. O retrato é requisitado novamente ao atualizar o
perfil, a cada minuto e ao voltar para a janela; a mudança visual depende da imagem publicada pela PlayNC.

O painel de combate substitui atributos primários/Daevanion por Ataque, Defesa, Precisão, Evasão,
Crítico, resistência a crítico, PV/PM e velocidades. **A leitura automática desses totais ainda não
está implementada no motor.** Os campos sem fonte ficam indisponíveis. A API pública atual traz
os seis atributos primários e bônus, não esses totais; eles não são inferidos de bônus, inventados
nem copiados de um personagem para outro. O anexo do usuário não foi importado como dado de conta.
Quando um perfil fornece tipos de combate explícitos, o painel usa somente os valores desse perfil.
Detalhes de treino ficam recolhidos até clicar numa tentativa; selecionar duas concluídas abre a comparação.

O bestiário separa abates e favoritos por personagem (região + servidor + ID). O catálogo estático
inclui nomes, níveis, regiões e fotos do MetaBot, relacionadas aos códigos conhecidos da captura.
As fotos são carregadas sob demanda; a lista tem paginação de 60 entradas. Monstros comuns e
nomeados aparecem no bestiário; fotos de chefes também ficam disponíveis no medidor de DPS.
Sem imagem conhecida, mostra “Sem foto”. As linhas são compactas e somente a estrela de favoritos
é editável; os favoritos aparecem no widget Farm. Abates e almas são dados diferentes.
Os filtros Completos/Faltando só usam a coleção recebida do jogo, nunca os contadores de abates.
Ao atualizar, os dados antigos são preservados e migrados para o primeiro personagem vinculado,
sem repetir os mesmos abates nos demais personagens.

### Sincronização da coleção

A captura decodifica `00 90` (coleção completa ao entrar no mundo) e `0D 90` (ganho de almas),
depois da remontagem TCP e descompressão LZ4. O formato foi adaptado do
[aion2-pet-overlay](https://github.com/MartinLVila/aion2-pet-overlay), sob MIT
(aviso em `licenses/pet-overlay-MIT.txt`). Os requisitos são **5, 25 e 75 almas por nível**,
com o contador reiniciando a cada nível: **105 no total**, não 75 abates.

Para a primeira sincronização, use a captura atualizada, volte à seleção de personagens e entre
novamente. A lista só é vinculada por um registro de identidade própria no mesmo fluxo TCP;
nome lembrado e perfil de outro jogador não servem. A sincronização aguarda identidade confirmada
quando esses pacotes não chegam juntos. Uma troca de personagem requer um novo estado completo.
Os dados ficam separados por servidor e nome do personagem, como identificados pelo jogo.
O último snapshot fica salvo com a data; sem snapshot, o estado é **Não sincronizado**, não zero.
O perfil público PlayNC não é a fonte dessa coleção. Esse protocolo não documentado pode mudar.

Os testes cobrem pacotes sintéticos, inclusive fragmentação, retransmissão e LZ4. A confirmação
dos níveis reais depende de uma sessão de jogo com a captura nova; não há fixture de tráfego real
da conta neste repositório.

### Treinamento

Escolha nome e tempo (5–1800 segundos), adicione/inicie e aguarde 5 segundos. Apenas o jogador
local identificado e um alvo classificado como boneco entram no cálculo. O app subtrai snapshots
acumulados para excluir aquecimento e outros jogadores. A precisão temporal depende da frequência
dos snapshots da captura (aproximadamente 500 ms) e da entrega do feed. Tentativas interrompidas
ou canceladas ficam identificadas; somente duas concluídas podem ser comparadas.
Minha party mostra **CP** e **GS** (Item Level); dado ausente aparece como travessão.

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
2. Rode o instalador `Lotus Tracker Setup x.y.z.exe`. Não precisa de .NET nem de Node.
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
node --test tests/*.test.mjs
```

Teste nativo do protocolo (após preparar o motor):
`dotnet run --project tests/capture/CaptureTests.csproj -p:EngineDir=CAMINHO_DO_MOTOR`.

O snapshot está em `js/data/monster-catalog.json`. Para importar uma tabela atualizada no mesmo
formato (`{ fetchedAt, monsters: [{ slug, name, portrait, level, rank, maps, isBoss }] }`), use
`node tools/import-metabot.mjs snapshot.json caminho/para/npcs.en.json`. A origem e a data ficam no
arquivo para auditoria; nenhuma consulta de catálogo é feita ao MetaBot durante o uso do app.

```bash
node tools/fake-capture.mjs --self "SeuNome" --server 2301 --skills "17010000:Earth's Retribution"
```
Envia snapshots no mesmo formato da ponte de captura (números simulados). `tools/replay.mjs` envia eventos crus.

## Direção do personagem no Mini mapa

No app Windows, **Widgets → Ativar leitura de movimento** solicita administrador e reinicia a captura. A opção começa desligada e o Lotus salva a escolha depois que o usuário a habilita. A leitura e a solicitação de elevação são executadas pelo motor C# incluído no app, sem scripts externos. Depois de ativá-la, entre novamente no personagem se o aplicativo pedir identificação.

Esse modo opcional lê somente a chave temporária do protocolo no processo local do AION 2. A chave fica em memória, não é enviada ao servidor de atualizações nem salva pelo aplicativo. O modo comum continua usando apenas captura de rede. Desativar a opção ou fechar o Lotus encerra a captura elevada; a captura comum volta ao desativar.

Os comandos de movimento fornecem posição e direção do personagem, normalmente perto de 10 atualizações/s. A seta mantém a última direção recebida quando os dados param. Girar somente a câmera, sem uma atualização enviada pelo jogo, não gira a seta. A identificação do perfil continua obrigatória: posições de outros jogadores não são usadas como a sua.

O radar usa a mesma orientação vertical do minimapa do jogo para os monstros e para a seta. Se precisar ajustar a referência visual, **Widgets → Mini mapa → Rotação do radar** gira o conjunto sem alterar as posições capturadas.

O leitor depende do formato da versão do jogo. Se a chave ou o alinhamento não forem validados, não interpreta bytes cifrados como posições. A implementação usa a pesquisa de [Aion 2 Protocol Research](https://github.com/lunixxx37/aion2-protocol-research), com licença MIT incluída em `licenses/`.

## Créditos

As imagens dos monstros vêm de [MetaBot.gg](https://metabot.gg/en/aion-2). O responsável informou que não há API, mas que as imagens do site podem ser usadas desde que o app mantenha um link de crédito (dofollow), que fica nas telas Boss e Mascotes. Dados além das imagens (por exemplo, pontos de spawn) não foram autorizados e não são coletados.

## Licença

A ponte `capture/` depende do Aion2DpsMeter, que é **GPL-3.0**. Se você distribuir o Lotus Tracker junto com a captura, o projeto precisa ser distribuído sob a GPL-3.0 (código-fonte aberto).

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
