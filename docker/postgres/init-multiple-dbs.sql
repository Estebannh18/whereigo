-- docker/postgres/init-multiple-dbs.sql
-- Crea las bases de datos adicionales necesarias para los microservicios.
-- PostgreSQL ejecuta automáticamente los archivos .sql de /docker-entrypoint-initdb.d/
-- la primera vez que se inicializa el volumen de datos.

CREATE DATABASE whereigo_traffic;
CREATE DATABASE whereigo_routes;
CREATE DATABASE whereigo_alerts;
