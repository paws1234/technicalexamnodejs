# Shopify CLI, for ad-hoc store work (product seeding, auth checks). Not part of the
# running stack and not required by the sync, which uses the Admin API tokens.
FROM node:22-slim

# Containers here have no IPv6 route while DNS answers with AAAA records first, so npm
# hangs on registry.npmjs.org.
RUN printf 'precedence ::ffff:0:0/96  100\n' >> /etc/gai.conf

RUN npm install -g --no-audit --no-fund @shopify/cli@latest

WORKDIR /work

ENTRYPOINT ["shopify"]
CMD ["version"]
