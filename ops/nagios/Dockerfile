# ops/nagios/Dockerfile
# Nagios Core 4.5 (Ubuntu 24.04) con la configuración, plugins y handlers de Whereigo.
# La imagen base ya trae python3, gettext (envsubst) y los plugins estándar.
FROM jasonrivers/nagios:latest

# Código propio fuera de los VOLUME de la imagen base (/opt/nagios/etc,
# /opt/Custom-Nagios-Plugins), para que no se pierda al construir.
COPY config/   /opt/whereigo/config/
COPY plugins/  /opt/whereigo/plugins/
COPY handlers/ /opt/whereigo/handlers/
COPY --chmod=755 entrypoint.sh /usr/local/bin/whereigo-entrypoint

RUN chmod 755 /opt/whereigo/plugins/*.py /opt/whereigo/handlers/*.py

ENTRYPOINT ["/usr/local/bin/whereigo-entrypoint"]
