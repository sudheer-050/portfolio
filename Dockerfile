FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY ironman.html /usr/share/nginx/html/ironman.html
COPY resume.html /usr/share/nginx/html/resume.html
COPY profile.png /usr/share/nginx/html/profile.png
COPY screenshots/ /usr/share/nginx/html/screenshots/
COPY default.conf /etc/nginx/conf.d/default.conf
