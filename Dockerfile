FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY ironman.html /usr/share/nginx/html/ironman.html
COPY resume.html /usr/share/nginx/html/resume.html
COPY robots.txt /usr/share/nginx/html/robots.txt
COPY sitemap.xml /usr/share/nginx/html/sitemap.xml
COPY llms.txt /usr/share/nginx/html/llms.txt
COPY favicon.svg /usr/share/nginx/html/favicon.svg
COPY site.webmanifest /usr/share/nginx/html/site.webmanifest
COPY profile.png /usr/share/nginx/html/profile.png
COPY intro.mp4 /usr/share/nginx/html/intro.mp4
COPY screenshots/ /usr/share/nginx/html/screenshots/
COPY default.conf /etc/nginx/conf.d/default.conf

COPY google173ab49c2a6ca019.html /usr/share/nginx/html/google173ab49c2a6ca019.html
