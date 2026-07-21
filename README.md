# Lab-02-ISW521

## Dashboard del Mundial FIFA - Aplicación Web Asíncrona (Laboratorio #2)

Este proyecto corresponde al Laboratorio #2 del curso **ISW-521 Programación en Ambiente Web I** de la Universidad Técnica Nacional (UTN).

### Contexto del Proyecto
Consiste en el desarrollo de un Dashboard interactivo y responsivo para el seguimiento de métricas, estadísticas y partidos del Mundial. La aplicación consume servicios REST asíncronos en tiempo real y ofrece soporte completo offline mediante persistencia en caché local, junto con un sistema de tolerancia a fallas de red.

### Módulos del Sistema
* **Partidos por Selección:** Buscador interactivo que permite seleccionar cualquier país y consultar su historial completo de partidos (fechas, marcadores, estadios y rivales).
* **Las Mayores Goleadas:** Algoritmo que procesa los partidos disputados para calcular la diferencia de goles y generar el Top de encuentros con las mayores marcadas del torneo.
* **El Muro (Top 5 Defensas):** Módulo dinámico que calcula en tiempo real los goles en contra totales de cada selección cruzando datos de partidos, mostrando además su próximo rival o su último encuentro disputado si el torneo ha finalizado.
* **Información de Estadios:** Visualización detallada de los estadios sede con capacidad, ubicación geográfica e historial de partidos albergados.
* **Manejo Resiliente de Errores (Backoff Exponencial):** Sistema centralizado para el manejo de fallos HTTP (429, 500 o desconexión). Aplica reintentos automáticos con intervalos exponenciales (1s, 2s, 4s, 8s...) y temporizador visual en pantalla, utilizando la caché local (`localStorage`) como respaldo para garantizar disponibilidad continua.

### Tecnologías Utilizadas
* **HTML5 Semántico:** Estructura modular evaluada bajo estándares de la W3C.
* **CSS3 Nativo:** Maquetado responsivo (Flexbox y CSS Grid), uso de variables CSS para temas y transiciones para banners de alertas.
* **JavaScript Nativo (ES6+ Asíncrono):** Consumo de APIs REST mediante `fetch`, manipulación dinámica del DOM, gestión de temporizadores (`setInterval`/`setTimeout`) y persistencia mediante `localStorage`.

### Estructura del Repositorio
```text
Lab_02/
├── lab2B.html        # Estructura HTML5 principal del Dashboard y vistas
├── css/
│   └── worldcup26_styles.css    # Hojas de estilo responsivas, variables y banners de alerta
└── js/
    └── worldcup26_apps.js       # Lógica de negocio, integración asíncrona, backoff y caché