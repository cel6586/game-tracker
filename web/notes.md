# Frontend container: things to change later

## Before it works in compose
- Add an `api` service to `docker-compose.yml` (service name must be `api`, listening on port 8000) so `API_UPSTREAM=http://api:8000` resolves.
- Add a `web` service: build from `web/`, publish `8080:8080`, `depends_on: api`.
- nginx exits at startup if the `api` hostname can't be resolved, so `api` must be up first.

## Security
- Add a Content-Security-Policy header once fonts are self-hosted (placeholder comment is in `nginx.conf.template`).
- Scan the image with Trivy (later, in CI).
- Optional: pin the base image by digest (`sha256:...`) instead of the tag.
- Optional: compare against `nginxinc/nginx-unprivileged:1.30-alpine` (replaces the `RUN touch/chown`, `USER`, `EXPOSE` lines) or a Docker Hardened Image.

## Nice to have
- Turn on gzip in the nginx template.
- Cache is `expires 5m` for dev; revisit if a build step with hashed filenames is added.

## Kubernetes
- Dockerfile and template stay the same; only `API_UPSTREAM` changes (set in the Deployment `env:`), e.g. `http://<service-name>:8000`, or `http://<service-name>.<namespace>:8000` across namespaces.
- Kubernetes ignores `HEALTHCHECK`; use liveness/readiness probes on `/healthz` port 8080.
- `containerPort` and the Service target port must be 8080.
