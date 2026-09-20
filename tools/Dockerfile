# Shopify CLI, for ad-hoc store work (product seeding, auth checks). Not part of the
# running stack and not required by the sync, which uses the Admin API tokens.
FROM node:22-slim

# Containers here have no IPv6 route while DNS answers with AAAA records first, so npm
# hangs on registry.npmjs.org.
RUN printf 'precedence ::ffff:0:0/96  100\n' >> /etc/gai.conf

RUN npm install -g --no-audit --no-fund @shopify/cli@latest

# The CLI opens its auth URL in a browser by spawning `xdg-open`, and `auth login` treats
# a missing binary as fatal (`Error: spawn xdg-open ENOENT`, exit 1) *after* printing the
# one-time device code — so that code could never be redeemed. This image has no browser
# and needs none, but the CLI also pipes the opener's output and refuses to print the URL
# itself when it believes a browser opened. So the stand-in reports success *and* reprints
# the URL where a human can read it. See ./xdg-open for the full reasoning.
COPY xdg-open /usr/local/bin/xdg-open
RUN chmod +x /usr/local/bin/xdg-open

WORKDIR /work

ENTRYPOINT ["shopify"]
CMD ["version"]
