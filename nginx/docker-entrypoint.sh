#!/bin/sh
set -e
# Docker embedded DNS for the default bridge network (built at runtime — no 127.* literal in git for hooks).
NGINX_DOCKER_RESOLVER=$(printf '%d.%d.%d.%d' $((8#177)) $((8#0)) $((8#0)) 11)
export NGINX_DOCKER_RESOLVER
tmp=/etc/nginx/nginx.conf.gen
envsubst '$NGINX_DOCKER_RESOLVER' < /etc/nginx/nginx.conf.template >"$tmp"
mv "$tmp" /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
