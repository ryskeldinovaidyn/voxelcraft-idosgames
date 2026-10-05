# Вокселькрафт на iDos Games

Проект собран из официального каркаса iDos Games и каталожного модуля `voxelcraft` (0.4.1). В лобби подключены базовые модули, `multiplayer` и `workshop`.

Title ID: `PD6RHBTL` (`src/idos.title.ts`).

## Локальный запуск

```sh
npm install
npm run dev
```

Откройте адрес, который напечатает Vite. Для проверки кода: `npm run typecheck` и `npm run build`.

Вход игрока и данные игры идут через iDos Games. Для запуска под указанным Title ID нужен доступ к нему в аккаунте iDos Games. Изменения живой конфигурации тайтла выполняются через HTTP MCP `idosgames` после OAuth-входа.
