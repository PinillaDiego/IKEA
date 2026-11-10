# Etiquetas Envía — versión Netlify

Todo corre en la nube, sin servidor en la bodega:

```
Navegador (estación)  ──►  Netlify Functions /api/*  ──►  Netlify Blobs (cruce + auditoría)
       │
       └── ZPL ──►  Zebra Browser Print (instalado en el PC)  ──►  Impresora Zebra (USB o red)
```

- Los Excel SCI y ENVIA se leen **en el navegador** y solo se envían a la nube las columnas necesarias.
- El cruce, la generación del ZPL, la auditoría y los pendientes viven en la función de Netlify.
- Cada estación imprime en **su** Zebra a través de Zebra Browser Print.

## 1. Publicar en Netlify

El sitio tiene funciones con dependencias, así que **no sirve arrastrar la carpeta** a Netlify Drop. Use una de estas dos opciones:

**Opción A — GitHub (recomendada, se redespliega sola en cada cambio)**
1. Suba esta carpeta a un repositorio en GitHub.
2. En Netlify: *Add new site → Import an existing project →* elija el repo.
3. Netlify lee `netlify.toml`; no hay que configurar comando de build.

**Opción B — Netlify CLI**
```
npm install -g netlify-cli
cd etiquetas_netlify
npm install
netlify login
netlify init        (crear sitio nuevo)
netlify deploy --prod
```

**PIN de acceso (recomendado):** el sitio es público. En Netlify, vaya a *Site configuration → Environment variables* y agregue `APP_PIN` con un valor numérico. Luego redespliegue. Cada estación escribe ese PIN una vez en *Configuración*.

Netlify Blobs se activa solo; no requiere cuenta ni base de datos adicional.

## 2. Preparar cada PC de estación (una sola vez)

1. Instale **Zebra Browser Print** para Windows, desde la página oficial de Zebra (buscar "Zebra Browser Print").
2. Ábralo (queda en la bandeja del sistema) y agregue la impresora:
   - USB: aparece sola.
   - Red: *Add Network Printer* con la IP de la Zebra.
   - Márquela como predeterminada.
3. En Chrome o Edge abra `https://127.0.0.1:9101/ssl_support` y acepte el certificado.
4. Abra el sitio de Netlify. Si aparecen avisos de Browser Print o del navegador pidiendo permitir este sitio o el acceso a la red local, acéptelos.
5. En la pestaña **Configuración**:
   - escriba el nombre de la estación (por ejemplo, Empaque 1) y el PIN;
   - pulse *Buscar impresoras*, elija la impresora y pulse *Guardar*;
   - pulse *Imprimir prueba* para confirmar.

## 3. Uso diario
1. **Cargar archivos:** SCI + ENVIA (en ENVIA el encabezado está en la fila 2). Marque *Reiniciar auditoría* solo al empezar una nueva jornada u ola.
2. **Escanear:** lea el OLPN con la pistola. El color indica el resultado:
   - Verde: impresa.
   - Ámbar: reimpresión.
   - Rojo: error.
3. **Pendientes / Auditoría:** tablas con filtro y botón para descargar en Excel.

## Notas
- La etiqueta solo se registra en la auditoría si Browser Print aceptó el envío.
- Cargar archivos nuevos **sin** reiniciar la auditoría conserva lo ya impreso.
- Límite práctico: Netlify acepta hasta ~6 MB por petición. Como solo se envían 8 columnas de SCI y 5 de ENVIA, esto alcanza para decenas de miles de filas.
