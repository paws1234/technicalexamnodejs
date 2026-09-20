# Local development image. Deployment stays on Vercel (plan.md Phase 4), which builds
# straight from package.json, so there is no production stage here.
FROM node:22-slim

# This host's containers have no IPv6 route while DNS answers with AAAA records first,
# so npm hangs on registry.npmjs.org. Preferring IPv4 fixes it for build and runtime.
RUN printf 'precedence ::ffff:0:0/96  100\n' >> /etc/gai.conf

WORKDIR /app

# Overridden by compose; present so the image is sane on its own.
CMD ["npm", "run", "dev"]
