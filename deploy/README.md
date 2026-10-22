# Deploy — outfit check

Producción: **https://hack.cesura.duckdns.org**
Previews: **https://hack.cesura.duckdns.org/preview/&lt;rama-con-guiones&gt;/**
OpenCode: **https://code.hack.cesura.duckdns.org**

## Cómo funciona

GitHub es la fuente de verdad:

- `main` → producción (`/srv/segunda-piel/current` → `releases/<sha>`).
- Cualquier otra rama → `/srv/segunda-piel/previews/<slug>/`.
- El VPS tiene un **poller** (`segunda-piel-deploy.service`) que hace
  `git fetch` cada 20 s y publica sin depender de GitHub Actions. Es el camino
  activo: el equipo solo hace push a GitHub y no necesita secretos ni acceso SSH
  al VPS.
- GitHub Actions (`deploy.yml` / `preview.yml`) hace lo mismo vía `rsync` cuando
  los secretos estén configurados. Es opcional: si se activa, hay que apagar el
  poller para no tener dos deployers. Sin secretos, los workflows se saltan el
  deploy y no fallan.
- El build de cada rama corre como usuario `builder`, sin sudo y sin permiso de
  escritura sobre `releases/`, `previews/` ni el resto del VPS. El poller solo
  copia el `dist/` generado.

## Build local

```bash
./scripts/build-site.sh
# resultado en dist/
```

No hay build en la raíz del repo. `deck/` y `demo/` se copian tal cual. Si
existe `apps/viewer/package.json`, se construye con pnpm y se copia su `dist/`.
Si no existe, el viewer se omite sin romper el build.

## Secretos de GitHub Actions

Configurar en **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| `SSH_HOST` | IP o dominio del VPS |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | contenido completo de la clave privada generada en el VPS |

La clave privada está en el VPS en `/home/ubuntu/.ssh/hackathon_deploy`
(permisos `600`). La pública ya está en `/home/deploy/.ssh/authorized_keys`.
No se commitea ni se pega en el repo.

Con `gh` autenticado:

```bash
gh secret set SSH_HOST --body "130.110.235.61"
gh secret set SSH_USER --body "deploy"
gh secret set SSH_KEY < /home/ubuntu/.ssh/hackathon_deploy
```

## Publicar (equipo)

```bash
git fetch origin --prune
./scripts/sync-check.sh
git add -A && git commit -m "tipo(scope): ..."
git push -u origin HEAD
```

La URL de preview aparece en el output del push (o se calcula con el slug de la
rama) y en el `Summary` del workflow. Regla: **nadie hace push directo a
`main` salvo el lead**.

## Infraestructura del VPS

| Ruta | Uso |
|---|---|
| `/srv/segunda-piel/repo` | clon principal |
| `/srv/segunda-piel/worktrees/<persona>` | un worktree por persona |
| `/srv/segunda-piel/releases/<sha>` | releases de producción |
| `/srv/segunda-piel/previews/<slug>` | previews por rama |
| `/srv/segunda-piel/current` | symlink atómico a la release activa |
| `/srv/segunda-piel/bin/deploy-watch.sh` | poller de deploy |

El servidor web es un contenedor nginx (`hack-site`) detrás de Nginx Proxy
Manager, que ya gestionaba el 80/443 de este VPS. No se ha instalado Caddy para
no pisar el proxy existente.

Revertir producción a una release anterior:

```bash
cd /srv/segunda-piel
ln -sfn releases/<sha-anterior> current.new && mv -Tf current.new current
```

Parar el poller: `sudo systemctl disable --now segunda-piel-deploy`.
