FROM node:20-bookworm

# சிஸ்டமிற்கு தேவையான ffmpeg மற்றும் python3 டூல்ஸை இன்ஸ்டால் செய்கிறோம்
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# 🌟 FIX: லினக்ஸ் சிஸ்டமிற்குள் yt-dlp-ஐ குளோபலாக npm மூலமாக இன்ஸ்டால் செய்கிறோம்
RUN npm install -g yt-dlp

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
