# Клієнт для взаємодії з віддаленою папкою з файлами

Лабораторна робота №1, система типу 2, варіант 41.

| Параметр варіанту | Значення |
|---|---|
| Перегляд вмісту по кліку | `.cs` (текст), `.jpg` |
| Сортування | за датою і часом створення, зростання / спадання |
| Фільтр | всі файли / лише `.xml`, `.png` |

Десктопний клієнт і вебверсія працюють з одним спільним сервером і
використовують спільні пакети з логікою, не пов'язаною з платформою.

## Запуск

```bash
pnpm install
pnpm infra:up                      # PostgreSQL + MinIO у Docker
pnpm packages:build                # спільні пакети
pnpm server:dev                    # http://localhost:3002/api
pnpm desktop:dev                   # десктопний клієнт (Electron)
pnpm web:dev                       # вебверсія → http://localhost:3000
```

Наповнити кабінет показовими файлами: `node tools/seed.mjs`

Консоль MinIO: http://localhost:9001 (`minioadmin` / `minioadmin`).
Скинути дані: `pnpm infra:reset`.

Порти 3002 (сервер) і 5433 (PostgreSQL) обрані тому, що типові 3001 і 5432
можуть бути зайняті іншими проєктами. Змінюються у `.env`.

## Структура

```
apps/server        NestJS + TypeORM + PostgreSQL + сховище, сумісне з S3
apps/desktop       Electron + React + Vite
apps/web           Next.js 15 + React 19
packages/core      логіка варіанту, синхронізація, шляхи; юніт-тести
packages/api-client  DriveClient на axios
packages/ui        спільні компоненти React
tools              допоміжні скрипти
```

## API

| Метод | Шлях | Призначення |
|---|---|---|
| POST | `/api/auth/register` | реєстрація |
| POST | `/api/auth/login` | вхід, повертає JWT |
| GET | `/api/auth/me` | поточний користувач |
| GET | `/api/health` | стан сервера і бази |
| GET | `/api/files` | список; `?sort=&order=&filter=` |
| GET | `/api/files/manifest` | знімок диска для синхронізації |
| POST | `/api/files` | завантаження (multipart) |
| GET | `/api/files/:id/preview` | текст або посилання на зображення |
| GET | `/api/files/:id/download` | тимчасове посилання |
| PATCH | `/api/files/:id` | перейменування |
| DELETE | `/api/files/:id` | видалення |
| POST | `/api/sync/diff` | план синхронізації |

Колекція запитів для ручної перевірки: `tools/requests/api.http`.

## Транспорт

Клієнт `@drive/api-client` працює через axios: прогрес завантаження файлів,
тайм-аути та перехоплювачі помилок. Тимчасові посилання на сховище
обслуговує окремий екземпляр без перехоплювачів — заголовок авторизації туди
надсилати не можна.

## Тести

```bash
pnpm test
```

117 тестів покривають операцію варіанту, рушій синхронізації, нормалізацію
шляхів і визначення типів файлів.

## Розгортання

Описано в [docs/DEPLOY.md](docs/DEPLOY.md).
