mapboxgl.accessToken = 'pk.eyJ1IjoicGFjby1zb2xzb25hIiwiYSI6ImNseXJlcjN6bDA2M2kyaXB5d2NtYWJ3N2UifQ.s0HyJk7NLcV5ToGO-rLOew';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9',
    projection: 'globe',
    zoom: 13, // Nivel de zoom inicial
    maxBounds: [
        [-100.66596, 20.37553], 
        [-100.13981, 20.86796]
    ],
    center: [-100.39279, 20.59246]
});

map.on('style.load', () => {
    map.setFog({});

    loadGeoTIFF();
});





async function loadGeoTIFF() {
    try {
        const url = 'layers/R22014_CAS_32bit_up.tif';
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const raster = await image.readRasters();

        // Obtener los datos de la primera banda
        const data = raster[0];

        // Calcular el valor mínimo y máximo de los píxeles, omitiendo -99999
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (!isNaN(data[i]) && data[i] !== -99999) { // Ignorar NaN y -99999
                if (data[i] < min) min = data[i];
                if (data[i] > max) max = data[i];
            }
        }
        console.log("Valor mínimo:", min);
        console.log("Valor máximo:", max);
        
        // Normalizar los valores de los píxeles entre 0 y 1, omitiendo -99999
        const normalizedData = data.map(value => {
            if (isNaN(value) || value === -99999) return null; // Omitir NaN y -99999
            return (value - min) / (max - min); // Normalizar
        });

        // Crear una imagen PNG a partir de los datos raster
        const canvas = document.createElement('canvas');
        canvas.width = image.getWidth();
        canvas.height = image.getHeight();
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);

        // Definir la paleta de colores
        const colorPalette = [
            { value: 0.0, color: [0, 0, 0, 0] },        // Transparente
            { value: 0.00001, color: [34, 139, 34, 255] }, // Verde oscuro (bajo)
            { value: 0.2, color: [152, 251, 152, 255] }, // Verde claro
            { value: 0.4, color: [255, 255, 0, 255] },   // Amarillo
            { value: 0.5, color: [255, 165, 0, 255] },   // Naranja
            { value: 0.6, color: [255, 69, 0, 255] },    // Rojo anaranjado
            { value: 0.8, color: [255, 0, 0, 255] },     // Rojo
            { value: 1.0, color: [139, 0, 0, 255] }      // Rojo oscuro (alto)
        ];

        // Función para asignar colores basados en la paleta
        function getColor(value) {
            if (value === null) return [0, 0, 0, 0]; // Transparente para -99999

            // Encontrar el rango de colores correspondiente al valor normalizado
            for (let i = 1; i < colorPalette.length; i++) {
                if (value <= colorPalette[i].value) {
                    const lower = colorPalette[i - 1];
                    const upper = colorPalette[i];
                    const ratio = (value - lower.value) / (upper.value - lower.value);

                    // Interpolar entre los colores inferior y superior
                    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * ratio);
                    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * ratio);
                    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * ratio);
                    const a = Math.round(lower.color[3] + (upper.color[3] - lower.color[3]) * ratio);

                    return [r, g, b, a];
                }
            }

            // Si el valor es mayor que el último en la paleta, usar el último color
            return colorPalette[colorPalette.length - 1].color;
        }

        // Asignar colores a los píxeles
        for (let i = 0; i < normalizedData.length; i++) {
            const color = getColor(normalizedData[i]);
            imageData.data[i * 4] = color[0]; // Rojo
            imageData.data[i * 4 + 1] = color[1]; // Verde
            imageData.data[i * 4 + 2] = color[2]; // Azul
            imageData.data[i * 4 + 3] = color[3]; // Transparencia
        }

        // Dibujar la imagen en el canvas
        ctx.putImageData(imageData, 0, 0);

        // Convertir el canvas a una URL de imagen
        const imageUrl = canvas.toDataURL();

        // Obtener las coordenadas de la imagen
        const bbox = image.getBoundingBox();
        console.log("Bounding box:", bbox); // [minX, minY, maxX, maxY
        const coordinates = [
            [bbox[0], bbox[3]], // Esquina superior izquierda
            [bbox[2], bbox[3]], // Esquina superior derecha
            [bbox[2], bbox[1]], // Esquina inferior derecha
            [bbox[0], bbox[1]]  // Esquina inferior izquierda
        ];

        // Agregar la imagen como una capa en Mapbox
        map.addLayer({
            id: 'raster-layer',
            type: 'raster',
            source: {
                type: 'image',
                url: imageUrl,
                coordinates: coordinates
            },
            paint: {
                'raster-opacity': 0.5 // Ajusta el valor entre 0 (totalmente transparente) y 1 (totalmente opaco)
            }
        });
    } catch (error) {
        console.error("Error al cargar la capa .tif:", error);
    }
}

document.querySelectorAll('.toggle-header').forEach(header => {
    header.addEventListener('click', function() {
        let content = this.nextElementSibling;
        let arrow = this.querySelector('.toggle-arrow');

        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            arrow.textContent = '▲';
        } else {
            content.style.display = 'none';
            arrow.textContent = '▼';
        }
    });
});

////////////////////////////////////////////
////// ALMACENAMOS VARIABLES GLOBALES //////
////////////////////////////////////////////


// Llamar a la función al cargar el mapa
// map.on('load', () => {
//     loadGeoTIFF();
// });

////////////////////////////////////////////
// FUNCION PARA ESCONDER/DESPLEGAR RESUMEN //
////////////////////////////////////////////



