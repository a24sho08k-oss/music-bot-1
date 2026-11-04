FROM node:20-bookworm

# சிஸ்டமிற்கு தேவையான ffmpeg, python3 மற்றும் pip டூல்ஸை இன்ஸ்டால் செய்கிறோம்
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip python3-venv curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 🌟 FIX: லினக்ஸ் சிஸ்டமிற்குள் yt-dlp-ஐ pip மூலமாகப் பாதுகாப்பாக இன்ஸ்டால் செய்கிறோம்
RUN pip3 install --break-system-packages yt-dlp

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
