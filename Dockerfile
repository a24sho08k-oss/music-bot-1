FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg python3 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# SnapDeploy standard web routing port
EXPOSE 8080

CMD ["node", "index.js"]
