FROM nikolaik/python-nodejs:python3.10-nodejs20

RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# 🌟 FIX: மாற்று முறையான இந்த துல்லியமான லிங்க் மூலம் yt-dlp டவுன்லோட் செய்கிறோம்
RUN curl -L https://github.com -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
