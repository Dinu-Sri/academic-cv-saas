FROM php:8.2-apache

# --- Base PHP & Apache ---
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev \
    libzip-dev libcurl4-openssl-dev unzip curl cron poppler-utils \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd pdo pdo_mysql zip curl \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# --- TeX Live xetex stack (LaTeX render backend) ---
# Pinned to the recommended package set: xetex engine, core LaTeX, common
# extras, fonts, Latin Modern (matches the FPDF Computer-Modern look),
# DejaVu (broad Unicode coverage for non-Latin user data).
# Adds ~1.2 GB; isolated in its own RUN to keep upper layers cache-friendly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    lmodern \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && xelatex --version | head -n 1

# Apache config: serve from /var/www/html/public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf \
    /etc/apache2/apache2.conf

# Allow .htaccess overrides
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' \
    /etc/apache2/apache2.conf

# Cache-bust: change this value to force rebuild of COPY layer
LABEL cache.bust="2026-05-03b"
LABEL pdf.engine="xelatex"

# Copy application
COPY . /var/www/html/

# Create storage directories with proper permissions
RUN mkdir -p /var/www/html/storage/generated \
             /var/www/html/storage/logs \
             /var/www/html/storage/temp \
             /var/www/html/storage/uploads \
    && chown -R www-data:www-data /var/www/html/storage \
    && chmod -R 775 /var/www/html/storage

# Create .htaccess for clean URLs
RUN echo '<IfModule mod_rewrite.c>\n\
    RewriteEngine On\n\
    RewriteCond %{REQUEST_FILENAME} !-f\n\
    RewriteCond %{REQUEST_FILENAME} !-d\n\
    RewriteRule ^(.*)$ index.php [QSA,L]\n\
</IfModule>' > /var/www/html/public/.htaccess

# Signal to the application that the LaTeX backend is available. The renderer
# still probes at runtime, but env-based detection is faster and lets admin UI
# show accurate availability without spawning a process.
ENV CVSCHOLAR_LATEX_ENABLED=1

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["docker-entrypoint.sh"]
