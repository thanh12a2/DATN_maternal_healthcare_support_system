FROM kong:3.9

# Kong runs in traditional mode. PostgreSQL stores all Kong entities and allows
# them to be managed through Kong Manager or the Admin API.
ENV KONG_PROXY_LISTEN=0.0.0.0:8000 \
    KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    KONG_ADMIN_GUI_URL=http://localhost:8002

COPY --chown=kong:kong docs/api-specs/kong.yml /usr/local/kong/declarative/kong.yml
COPY --chmod=755 --chown=kong:kong gateway/init-kong.sh /usr/local/bin/init-kong.sh

EXPOSE 8000 8001 8002
