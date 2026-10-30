# Runs the local stdio server, for directories that build MCP servers to
# list their tools (Glama). The package has no dependencies, so the source is
# all it needs. Without credentials it still starts and lists its tools.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENTRYPOINT ["node", "src/index.js"]
