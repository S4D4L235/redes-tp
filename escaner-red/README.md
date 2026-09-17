# Escáner de Red Local IPv4 - Redes E.T. N°36

Aplicación web para el escaneo, diagnóstico y resolución de nombres de direcciones IP en redes de área local (LAN). Desarrollada con Node.js en el backend (sin dependencias externas) y HTML, CSS y JavaScript vanilla en el frontend.

---

## Tabla de Contenidos

- [Cumplimiento de Funcionalidades](#cumplimiento-de-funcionalidades)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Requisitos del Sistema](#requisitos-del-sistema)
- [Instalación y Ejecución](#instalación-y-ejecución)
- [Guía de Uso](#guía-de-uso)
- [Detalle Técnico](#detalle-técnico)
- [Control de Errores](#control-de-errores)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Cumplimiento de Funcionalidades

| Categoría | Requerimiento Funcional | Estado | Implementación |
| :--- | :--- | :---: | :--- |
| **Pantalla Principal** | Campos para IP Inicio e IP Fin | OK | Entradas de texto con validación sintáctica. |
| | Botón Iniciar Escaneo | OK | Desencadena la verificación previa e inicia el stream SSE. |
| | Botón Limpiar Pantalla | OK | Cancela procesos activos y restablece la interfaz. |
| | Configuración de Timeout | OK | Control numérico configurable en milisegundos (200 a 5000 ms). |
| **Escaneo** | Validación previa de IPs | OK | Expresión regular IPv4 y comprobación del rango antes de iniciar. |
| | Conectividad con `ping` | OK | Ejecución de comandos del sistema operativo (`ping -n` / `ping -c`). |
| | Obtención de nombre de equipo | OK | Resolución DNS inversa (`dns.reverse`) y fallback con `nslookup`. |
| | Barra de progreso | OK | Actualización dinámica del porcentaje y recuento de IP en tiempo real vía SSE. |
| | Guardar resultados | OK | Exportación de datos a archivo CSV. |
| **Resultados** | Total de respuestas | OK | Contador de equipos analizados, activos e inactivos. |
| | Tabla de resultados | OK | Muestra IP, Nombre, Estado (Conectado / Sin Respuesta) y Latencia (ms). |
| | Ordenamiento de datos | OK | Clic en encabezados para ordenar por IP (numérico), nombre, estado o tiempo. |
| | Filtrado de datos | OK | Selector para mostrar Todos, Solo Conectados o Solo Inactivos. |
| **Control de Problemas** | Validación al tipear | OK | Evento `oninput` con indicadores visuales de sintaxis correcta/incorrecta. |
| | Control de fallos en `ping` | OK | Manejo de excepciones en consola; marca el host como "Sin Respuesta". |
| | Control de fallos en nombres | OK | Captura de errores DNS; asigna el valor "Desconocido". |
| | Mensajes de error claros | OK | Banners informativos cuando la IP es inválida o falla la conexión. |

---

## Arquitectura del Sistema

El sistema utiliza una arquitectura cliente-servidor unidireccional basada en eventos (Server-Sent Events):

```text
+-------------------------------------------------------------------+
|                           NAVEGADOR WEB                           |
|                                                                   |
|   Inputs IP/Timeout ----> Validación Local (JS)                   |
|           |                                                       |
|           v                                                       |
|   GET /api/validate (Fetch)                                       |
|           |                                                       |
|           v                                                       |
|   GET /api/scan (EventSource SSE) <----+                          |
|                                        | Recibe progreso y datos  |
+----------------------------------------|--------------------------+
                                         | Stream de datos (JSON)
+----------------------------------------|--------------------------+
|                          NODE.JS BACKEND                          |
|                                                                   |
|   Servidor HTTP Nativo <--------------+                           |
|           |                                                       |
|           v                                                       |
|   Generación de Rango IP (NetworkUtils)                           |
|           |                                                       |
|           v                                                       |
|   Escaneo por Host (NetworkScanner):                              |
|     1. pingHost() -> Ejecuta ping del SO                          |
|     2. getHostname() -> dns.reverse() o nslookup                  |
+-------------------------------------------------------------------+
```

---

## Requisitos del Sistema

- **Sistema Operativo:** Windows, Linux o macOS.
- **Node.js:** Versión 14.0.0 o superior.
- **Permisos:** Permisos de ejecución en consola para las herramientas de red `ping` y `nslookup`.

---

## Instalación y Ejecución

1. Ubique los archivos del proyecto en un mismo directorio:
   ```text
   escaner-red/
   ├── index.html
   ├── server.js
   └── README.md
   ```

2. Ejecute el servidor desde la terminal:
   ```bash
   node server.js
   ```

3. Abra su navegador e ingrese a:
   ```text
   http://localhost:3000
   ```

---

## Guía de Uso

1. **Ingreso de Rango:** Introduzca la IP inicial (ej. `192.168.1.1`) y la IP final (ej. `192.168.1.20`).
2. **Ajuste de Timeout:** Defina el tiempo límite de espera por host en milisegundos (valor por defecto: `1000 ms`).
3. **Validación Visual:** Los campos mostrarán un borde verde si la IP es correcta o un borde rojo con un mensaje indicativo si el formato es inválido.
4. **Iniciar Escaneo:** Haga clic en "Iniciar Escaneo". La barra de progreso y la tabla se actualizarán en tiempo real.
5. **Filtrar y Ordenar:** Seleccione la opción deseada en el filtro desplegable o haga clic en los encabezados de la tabla para ordenar las columnas.
6. **Exportar:** Haga clic en "Guardar Resultados (CSV)" para descargar el reporte.

---

## Detalle Técnico

### Conversión Matemática de IPs
Para procesar el rango de direcciones y permitir un ordenamiento correcto, las direcciones IPv4 se convierten a un número entero de 32 bits sin signo:

`IP_Long = (Octeto_1 * 256^3) + (Octeto_2 * 256^2) + (Octeto_3 * 256) + Octeto_4`

Esto evita errores en el ordenamiento alfanumérico (donde `192.168.1.10` quedaría antes que `192.168.1.2`).

### Ejecución de Ping
El servidor invoca el ejecutable del sistema según la plataforma:
- **Windows:** `ping -n 1 -w <timeout_ms> <ip>`
- **Linux / macOS:** `ping -c 1 -W <timeout_sec> <ip>`

El resultado se analiza mediante expresiones regulares para obtener el tiempo de respuesta en milisegundos.

### Resolución de Nombres
1. Se consulta el registro PTR mediante `dns.reverse(ip)`.
2. Si no hay respuesta DNS, se ejecuta como respaldo el comando `nslookup <ip>`.
3. Si el nombre no puede determinarse, se asigna el valor "Desconocido".

### Transmisión por Eventos (SSE)
Se utiliza la cabecera `Content-Type: text/event-stream` para enviar los resultados de cada IP al cliente a medida que son procesados, evitando esperar a que finalice todo el rango.

---

## Control de Errores

- **Límite de Rango:** Se restringe el escaneo a un máximo de 256 direcciones IP por ráfaga para evitar saturar la red o bloquear el proceso.
- **Formato Inválido:** El botón de inicio se deshabilita automáticamente si la sintaxis de las IPs es incorrecta o si la IP final es menor que la inicial.
- **Fallas de Conexión:** Si se interrumpe la comunicación con el servidor, el cliente captura el evento `onerror`, detiene el proceso y muestra un mensaje de error en la interfaz.

---

## Estructura del Proyecto

```text
escaner-red/
├── index.html        # Interfaz de usuario (HTML5, CSS3, JavaScript)
├── server.js         # Servidor HTTP, lógica de red y ejecución de comandos
└── README.md         # Documentación del proyecto
```

---

## Preguntas Frecuentes

#### ¿Por qué un equipo activo figura como "Sin Respuesta"?
Un equipo puede estar encendido pero tener un firewall (como el de Windows) configurado para bloquear las peticiones ICMP (ping).

#### ¿Por qué el nombre del equipo figura como "Desconocido"?
Ocurre cuando la red no dispone de un servidor DNS con zona de búsqueda inversa configurada o el equipo no está registrado en el DNS local.

---
*Materia: Redes — E.T. N°36*
