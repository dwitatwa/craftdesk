# Craftdesk

Craftdesk is a Linux-first desktop-like web IDE for managing projects, tasks, files, terminal sessions, and Git from a single local app.

The npm package name is `craftdeskide`. The installed CLI command is `craftdesk`.

## Requirements

- Linux only
- Node.js `>=22.12.0`
- npm

Some systems may also need native build prerequisites during `npm install -g craftdeskide` because the package depends on `node-pty`:

- `python3`
- `make`
- `g++`

## Install From npm

```bash
npm install -g craftdeskide
```

After the package is installed, prepare the local runtime:

```bash
craftdesk install
```

This command:

1. Checks required Linux tools such as `bash` and `git`
2. Installs missing Linux packages with `apt`, `dnf`, or `pacman` when possible
3. Prepares Craftdesk data and runtime directories under your home directory
4. Migrates older installs from `~/.local/share/craftdesk/runtime/data` when possible

## Start The App

```bash
craftdesk start
```

By default, Craftdesk runs on:

```text
http://127.0.0.1:4000
```

You can choose a different port:

```bash
craftdesk start --port=4010
```

## Stop Or Remove The App

Stop the running app:

```bash
craftdesk stop
```

Delete Craftdesk runtime data and local state:

```bash
craftdesk delete
```

This removes files under `~/.local/share/craftdesk`. It does not uninstall the global npm package itself.

To remove the CLI package too:

```bash
npm uninstall -g craftdeskide
```

## Runtime Paths

Craftdesk uses these paths:

- Package runtime: global npm install location
- Data: `~/.local/share/craftdesk/data`
- Runtime files: `~/.local/share/craftdesk/runtime`
- Logs: `~/.local/share/craftdesk/logs/server.log`
- PID file: `~/.local/share/craftdesk/run/craftdesk.pid`

## Common Commands

```bash
craftdesk help
craftdesk install
craftdesk start
craftdesk stop
craftdesk delete
```

## Troubleshooting

If `npm install -g craftdeskide` fails while building `node-pty`, install native build tools first.

Ubuntu or Debian:

```bash
sudo apt update
sudo apt install -y python3 make g++
```

If `craftdesk install` reports missing Linux tools, let it install them or install them manually and retry.

If the server exits immediately after `craftdesk start`, check:

```bash
~/.local/share/craftdesk/logs/server.log
```
