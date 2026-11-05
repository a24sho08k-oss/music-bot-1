FROM node:20-bookworm

# System layout-ku ffmpeg and basic download configurations setup panrom
RUN apt-get update && apt-get install -y ffmpeg python3 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
