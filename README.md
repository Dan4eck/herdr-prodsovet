# ProdAdvice для Herdr

Оформление для [Herdr](https://github.com/herdrdev/herdr-app) на macOS и
Windows: проекты и сессии агентов в одной боковой панели, анимированные агенты,
вкладки с файлами, файловый менеджер, Git, GitHub и поиск по проекту. Интерфейс
на русском и английском.

![Иллюстрация с вымышленными данными](preview.png)

## Быстрый старт

Нужны macOS, [Herdr](https://github.com/herdrdev/herdr-app) 0.1.16 (откройте его
хотя бы раз), `python3` и `rg` (`brew install ripgrep`).

```sh
git clone https://github.com/Dan4eck/herdr-prodsovet
cd herdr-prodsovet
git checkout v0.5.0                  # последний релиз, см. Releases
python3 install.py --apply           # или --apply --with-limits, см. ниже
herdr-app do layout.switch '{"name":"PA-Advanced"}'
```

Готово. Переключать оформления можно и через Cmd+Shift+L.

- `python3 install.py` без `--apply` только показывает план и ничего не пишет.
- `--with-limits` включает лимиты Claude и Codex в статус-баре. Для Claude
  читается токен Claude Code из связки ключей macOS, подробнее в
  [ACCESS.md](ACCESS.md).
- Если ваше сочетание клавиш уже занято, установщик остановится; добавьте
  `--skip-conflicting-keys`, чтобы оставить свои.

### Windows

Нужны Windows 10/11 x64, [Herdr](https://herdr.dev/download/) 0.1.16 (откройте
его хотя бы раз), [Python 3](https://www.python.org/downloads/) и `rg`. В
PowerShell:

```powershell
winget install BurntSushi.ripgrep.MSVC   # если rg ещё нет; затем перезапустите Herdr
git clone https://github.com/Dan4eck/herdr-prodsovet
cd herdr-prodsovet
git checkout v0.5.0                      # последний релиз
py install.py --apply                    # или --apply --with-limits (только Codex)
herdr-app do layout.switch --name PA-Advanced
```

Обновление и удаление те же, только `py` вместо `python3`. На Windows:

- клавиши свои: Cmd заменяется на Ctrl+Shift, как в самом Herdr (таблица ниже);
- удаление идёт в Корзину Windows, «Показать в Проводнике» вместо Finder;
- «Открыть в» запускает VS Code и Obsidian по их ссылкам `vscode://` и
  `obsidian://`; программы и скрипты (`.exe`, `.bat`, `.ps1`…) отсюда не
  запускаются, для них есть «Показать в Проводнике»;
- `--with-limits` включает только лимиты Codex: лимиты Claude на Windows не
  переносились, подробнее в [ACCESS.md](ACCESS.md);
- в PA-Advanced маковские шрифты Avenir Next и Bodoni 72 заменяются системными;
  PA-Light выглядит так же, как на Mac (его шрифты встроены в Herdr).

### Обновление

Из той же папки:

```sh
git fetch --tags
git checkout v0.5.0                  # номер нового релиза
python3 install.py --update --apply
```

Ваши размеры панелей и `limits.local.json` сохраняются. Если вы правили файлы
пакета, обновление остановится и назовёт их. Что изменилось — в
[CHANGELOG.md](CHANGELOG.md).

### Удаление

```sh
python3 install.py --uninstall --apply
```

Перед этим переключитесь на другое оформление.

## Два оформления

| | **PA-Advanced** (рекомендуем) | **PA-Light** |
|---|---|---|
| Боковая панель | ПРОЕКТЫ / СЕССИИ | Spaces + Мастерская |
| Открыть проект | Cmd+N: компьютер → сессия → папка | как в Herdr |
| Справа | Файлы, Changes, GitHub | Файлы, Changes |
| Вид | чёрно-белый, квадратные рамки, пиксельные иконки | исходный тёмный, скруглённый |

В обоих есть файлы, редактор, поиск, Changes с подсказкой текста коммита,
анимированные агенты, статус-бар и форк разговора. У каждого есть тёмная и
дневная тема (`…-Night`, `…-Day`). Новое появляется в PA-Advanced.

**Проекты в PA-Advanced.** На вкладке ПРОЕКТЫ сессии сгруппированы по проектам,
worktree висят на линии своего проекта, текущая сессия подсвечена на ней.
Вкладка СЕССИИ — общий список, по статусу или в своём порядке (перетаскиванием).
`+` у проекта запускает сессию, терминал или worktree.

## Клавиши

| Где | macOS | Windows | Что делает |
|---|---|---|---|
| Везде | Cmd+T, Cmd+D / Cmd+Shift+D | Ctrl+Shift+T, Ctrl+Shift+O / Ctrl+Shift+E | терминал, сплит вправо / вниз в корне проекта |
| Везде | Cmd+N | Ctrl+Shift+N | открыть проект (PA-Advanced) |
| Везде | Cmd+P | Ctrl+Shift+K | выбор сессии (PA-Advanced) |
| Везде | Cmd+Shift+O | Ctrl+Shift+S | поиск по проекту |
| Терминал | Cmd+Shift+F | Ctrl+Shift+Y | форк текущего разговора Claude Code / Codex |
| Дерево файлов | F2, Cmd+N / Cmd+Shift+N | F2, Ctrl+N / Ctrl+Shift+N | переименовать, новый файл / папка |
| Дерево файлов | Cmd+C / X / V, Cmd+Backspace | Ctrl+C / X / V, Delete | копировать / вырезать / вставить, в Корзину |
| Дерево файлов | Enter | Enter | отправить путь агенту |
| Поиск | Cmd+Enter, Option+Enter | Ctrl+Enter, Alt+Enter | путь агенту, открыть в приложении |
| Редактор | Cmd+S | Ctrl+S | сохранить |

На Windows клавиши взяты из `keys.windows.json`, на Mac из `keys.json`.

## Что внутри

Пять модов, которые работают вместе: **prodsovet** (панели, агенты, вкладки,
GitHub, статус-бар), **my-files** (файловый менеджер), **file-tab** (редактор и
Markdown), **find** (поиск через ripgrep), **session_fork** (форк разговора).

macOS и Windows: буфер обмена, Корзина, Finder/Проводник и открытие файлов
системные. На Mac это `pbcopy`, `trash` и `open`, на Windows — Windows API через
`mods/my-files/system.py` и `file-ops.py`. Моды запускают программы и работают с
вашими файлами; что именно и куда — в [ACCESS.md](ACCESS.md).

## Подробнее

- [RECIPE.md](RECIPE.md) — как всё устроено: форк разговоров, подсказки
  коммитов, ограничения, установщик в деталях.
- [APPEARANCE.md](APPEARANCE.md) — шрифты, цвета, размеры.
- [VALIDATION.md](VALIDATION.md) — что и как проверено.
- [PUBLISHING.md](PUBLISHING.md) — разработка (`python3 dev.py`) и релизы.

Код под Apache-2.0; сторонние материалы и маскоты — в [NOTICE](NOTICE) и
`licenses/`. Неофициальный проект сообщества.
