# Sim Companies VWAP del almacén

[Elegir idioma](README.md)

Consulta el precio medio ponderado por volumen (VWAP) y el precio unitario con descuento de tus existencias, por calidad. El período predeterminado es el día anterior en UTC. Para acceder a los gráficos diarios oficiales por calidad se requiere el estado Supporter en el juego.

## Instalación y actualización

1. Descarga `warehouse-vwap-v*.zip` en **Assets** y descomprime el archivo. [Última versión](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Abre `chrome://extensions`, activa el **Modo de desarrollador** y elige **Cargar descomprimida**. Selecciona la carpeta `warehouse-vwap` que contiene `manifest.json`.
3. Inicia sesión en el juego y abre el almacén. Despliega **VWAP del almacén** para ver los precios de tus existencias o abre un producto para consultar los precios por calidad.

Para actualizar, reemplaza los archivos en la carpeta que cargaste originalmente. Pulsa el icono de recarga de la extensión instalada y actualiza la pestaña del almacén. Si usas la misma carpeta, conservarás los ajustes y los precios almacenados en caché.

## Descuentos e idioma

En la ficha de un producto, pulsa el porcentaje junto al precio con descuento para editar el descuento del producto y los de Q0 a Q12. Al dejar un campo vacío se aplica el ajuste del nivel superior. Introduce 0 para aplicar el precio sin descuento. Los precios se recalculan al guardar.

De forma predeterminada, la extensión usa el idioma de Chrome. Para cambiarlo, abre la extensión desde la barra de herramientas y selecciona **Todos los ajustes → Idioma**.
