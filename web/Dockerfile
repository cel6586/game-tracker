# nginx image that serves the web files and passes /api requests to the api
FROM nginx:1.31-alpine

# where nginx sends /api requests, filled into the template at startup
ENV API_UPSTREAM=http://api:8000

RUN apk upgrade --no-cache

# the nginx image fills env vars into anything in /etc/nginx/templates on start
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY src/ /usr/share/nginx/html/

# nginx runs as the nginx user so it has to own the files it writes to
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /etc/nginx/conf.d

USER nginx
# 8080 because a non root user cant use port 80
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1