# Розгортання на Railway

Система опублікована та працює:

| Складова | Адреса |
|---|---|
| Вебверсія | https://web-production-a87bf.up.railway.app |
| Сервер (API) | https://server-production-34fe.up.railway.app/api |
| Перевірка живучості | https://server-production-34fe.up.railway.app/api/health |

## Склад проєкту в Railway

| Служба | Що це |
|---|---|
| `Postgres` | керована база даних (шаблон Railway) |
| `drive` | вбудоване об'єктне сховище Railway, сумісне з S3 |
| `server` | NestJS API, образ із `Dockerfile.server` |
| `web` | Next.js, образ із `Dockerfile.web` |

## Чому не MinIO

Локально сховище піднімає MinIO з `docker-compose.yml`. Для продакшену це не
спрацювало: образ MinIO прибрали з Docker Hub, а до `quay.io` Railway не
достукався — розгортання падало з «unable to connect to the registry».

Натомість узято **вбудоване сховище Railway** (`railway bucket`). Код не
змінювався взагалі — лише значення змінних. Саме на це й розраховувала
архітектура: сховище замінне, бо застосунок працює з ним через S3-сумісний
інтерфейс.

Різниця з MinIO лише у двох налаштуваннях:

- `S3_FORCE_PATH_STYLE=false` — Railway адресує контейнер піддоменом
  (`virtual-host`), а MinIO — шляхом;
- `S3_PUBLIC_ENDPOINT` не потрібен — endpoint і так публічний.

## Три граблі, на які варто не наступати

**1. Порт.** Railway призначає службі власний порт через `PORT` (зазвичай 8080),
а домен за замовчуванням дивиться туди, куди ви вкажете при створенні. Якщо
вони не збігаються — 502 «Application failed to respond». Перевірити:

```bash
railway logs --service server | grep -i "слухає\|Local:"
railway domain update <домен> --port 8080 --service server
```

**2. Адреса API у вебверсії.** `NEXT_PUBLIC_API_URL` вбудовується у клієнтський
код на етапі **складання**. Задавати її треба до `railway up`; зміна після
складання нічого не дасть — потрібна повторна збірка.

**3. `railway.json` більше не працює.** Config as Code застарів, Railway
відповідає помилкою. Шлях до Dockerfile задається налаштуванням служби:

```bash
railway api 'mutation {
  serviceInstanceUpdate(
    serviceId: "<id>" environmentId: "<id>"
    input: { dockerfilePath: "Dockerfile.server" }
  )
}'
```

## Відтворення з нуля

```bash
npm i -g @railway/cli
railway login
railway init --name it-lab1-remote-drive
railway add --database postgres
railway bucket create drive --region iad
railway bucket credentials --bucket drive      # звідси беруться ключі

railway add --service server
railway variables --service server \
  --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" \
  --set "S3_ENDPOINT=<AWS_ENDPOINT_URL>" \
  --set "S3_REGION=auto" \
  --set "S3_BUCKET=<AWS_S3_BUCKET_NAME>" \
  --set "S3_ACCESS_KEY=<AWS_ACCESS_KEY_ID>" \
  --set "S3_SECRET_KEY=<AWS_SECRET_ACCESS_KEY>" \
  --set "S3_FORCE_PATH_STYLE=false" \
  --set "JWT_SECRET=<випадковий рядок>"
# задати dockerfilePath = Dockerfile.server (див. вище)
railway up --service server --ci
railway domain --service server --port 8080

railway add --service web
railway variables --service web --set "NEXT_PUBLIC_API_URL=https://<домен-server>/api"
# задати dockerfilePath = Dockerfile.web
railway up --service web --ci
railway domain --service web --port 8080

# замкнути: дозволити origin вебверсії
railway variables --service server --set "CORS_ORIGINS=https://<домен-web>"
```

## Перевірка

```bash
curl https://<домен-server>/api/health
# {"status":"ok","database":"up","uptime":...}
```

Далі відкрити вебверсію, увійти, завантажити файл і відкрити прев'ю зображення:
якщо картинка показується, значить підписані посилання формуються правильно.
