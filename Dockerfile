FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY profile.jpg /usr/share/nginx/html/profile.jpg
COPY default.conf /etc/nginx/conf.d/default.conf
