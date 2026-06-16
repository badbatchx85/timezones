# Relógios Mundiais / WORLD TIMETABLE — app estático servido por nginx.
FROM nginx:1.27-alpine

# Apenas os arquivos do app vão para o webroot (docs/.git/.superpowers ficam de fora).
COPY index.html /usr/share/nginx/html/
COPY tests.html /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
