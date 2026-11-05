FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip python3-venv curl && rm -rf /var/lib/apt/lists/*

# சிஸ்டமிற்குள் yt-dlp-ஐ பாதுகாப்பாக இன்ஸ்டால் செய்கிறோம்
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
