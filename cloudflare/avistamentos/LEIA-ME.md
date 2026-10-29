# Servidor de avistamentos (Cloudflare Workers, gratuito)

Faz os mobs vistos por um jogador aparecerem no Mini mapa dos outros. Guarda só **nome do mob + célula de 25 m**
(sem nome de jogador, sem IP, sem posição exata). Cada app usa um número aleatório anônimo só para contar pessoas diferentes.

## Publicar (uma vez, ~10 minutos)

1. Crie uma conta gratuita em https://dash.cloudflare.com (não precisa de cartão).
2. No terminal, dentro desta pasta (`cloudflare/avistamentos`):

   ```
   npx wrangler login
   npx wrangler d1 create lotus-avistamentos
   ```

   O segundo comando mostra um `database_id`. Cole-o em `wrangler.toml`, no lugar de `COLE_AQUI_O_ID_DO_BANCO`.
3. Crie a tabela e publique:

   ```
   npx wrangler d1 execute lotus-avistamentos --remote --file=schema.sql
   npx wrangler deploy
   ```

4. O último comando mostra o endereço, algo como `https://lotus-avistamentos.SEU-USUARIO.workers.dev`.
   Coloque esse endereço em `js/sightings-config.js` (`SIGHTINGS_URL`) e faça um PR. Depois de mesclado, todos os apps
   passam a compartilhar sozinhos (a interface chega em ~1 minuto, sem reinstalar).

## Ajustes

- `MIN_REPORTERS` em `wrangler.toml`: quantas pessoas diferentes precisam ter visto o mob numa célula para ela aparecer para
  os outros. `1` confia em todos; `2` exige confirmação (mais seguro contra dados falsos, mas demora mais a encher).
- Cada jogador pode desligar o compartilhamento em Widgets > Mini mapa.
- Plano gratuito da Cloudflare: 100 mil gravações por dia no D1 e 100 mil requisições por dia no Worker; de sobra para este uso.
