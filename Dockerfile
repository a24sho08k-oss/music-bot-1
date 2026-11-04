FROM nikolaik/python-nodejs:python3.10-nodejs20

RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# 🌟 FIX: இந்த முறை முழுமையான சரியான லிங்க் கொடுத்துள்ளேன்!
RUN curl -L https://github.com/yt-dlp/yt-dlp.git/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
