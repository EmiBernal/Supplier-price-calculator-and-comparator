### **Organizacion y comparacion de proveedores**



**Se comparan de la siguiente forma:**



Forma de envio de precios

 - Whatsapp

 - Lista excel

 - Escrito en papel

 

Claridad de condiciones

 - Lista con condiciones claras (efectivo, financiado, por cantidad)

 - Lista sin condiciones (consultar)

 

Por posibilidad de comparacion

 - Se tiene acceso al codigo del proveedor (y es el mismo que el del sistema) y precio unitario, por lo tanto se puede comparar.

 - No se tiene acceso al codigo del proveedor o el precio no es claro, entonces es mas complicado de comparar

 

En el 2do caso, se puede comparar por nombre del articulo (consultar)



### **Funcionales principales del software**



1. *Cargar lista de precios*

 

Se cargan manualmente las condiciones en inputs distintos:



* Proveedor
* Producto
* Precio
* Codigo
* Condición 1
* Condicion 2
* Condicion 3
* Condicion 4



En cualquiera de los casos, un tercero va a ser el encargado de cargar los datos de forma manual o de aclarar, en el caso de un word, donde se encuentran (columnas) los datos que necesita cargar.



En caso de detectar duplicados, se modificara (solicitara confirmación extra)



2\. *Reconocer productos*



Reconocer productos y tabla de equivalencias



El sistema utilizará una tabla de equivalencias editable que relaciona los códigos y nombres usados por cada proveedor con los códigos y nombres internos de la empresa.



1. Al cargar una lista, el sistema busca el código o nombre del producto del proveedor en la tabla de equivalencias.



2\. Si encuentra la equivalencia, la usa para identificar correctamente el producto y   comparar precios.



3\. Si no encuentra una equivalencia, el sistema solicitará al usuario que seleccione o ingrese a qué producto interno corresponde. Esa nueva relación se guarda automáticamente en la tabla para futuras cargas.



La tabla podrá ser modificada manualmente en una interfaz, con control de acceso para evitar errores, y tendrá un historial de cambios para auditoría (Ver si es posible).



Esta tabla permite traducir códigos y nombres externos a un estándar interno, garantizando una comparación precisa y evitando confusiones por nombres o códigos distintos usados por los proveedores.



3\. *Extraer y normalizar precios unitarios*



Luego de reconocer los productos, extraigo los precios unitarios y los normalizo (los transformo todos a un mismo tipo de dato, en este caso, un tipo de dato numerico para que todos los datos se puedan comparar sin problema).



Ademas de extraer los precios, se registran las condiciones. Por ejemplo, precios por cantidad o forma de pago.



Todo esto sera guardado en una base de datos interna del sistema/empresa gestionada por MySQL o PostgreSQL. (buscar info y estudiar como poder hacerlo a gran escala)



4\. *Comparar precios entre proveedores*



Para esto, se hara una consulta en la base de datos comparando todos los precios de los proveedores registrados basado en el producto y se devuelve el de menor precio con sus condiciones.



**Funcionalidades extra para agregar**



 - Caso donde se pueda aplicar algún tipo de filtro (solo efectivo, por cantidad, etc)

*-* Clasificación de proveedores por:

 	- Metodos de envió

 	- Condiciones/No condiciones+

 	- Ver mas



**Estructura del trabajo**



**Lenguaje: Java**

**Interfaz gráfica: JavaFX (recomendado) o Swing**

**Base de datos local: SQLite (recomendado) o H2**

**Lectura de archivos Excel/Word: Librerías como Apache POI o docx4j**

**Auditoría simple (opcional): Archivos de log o tabla de historial**



### **Carga asistida por un menu interactivo para el procesamiento de archivos**



**En el caso de que los proveedores sean prolijos:**



El menu tiene dos opciones: word o texto (ver luego las opciones bien)



En el caso de word, el sistema muestra opciones donde el usuario debe indicar:



¿Que columna es el producto?

¿Que columna es el precio?

¿Que columna es el código del proveedor?

¿En que columnas se dictan las condiciones? ¿Hay condiciones? (ver bien esto)

Entrar las opciones y cargar el archivo...



**En el caso de que los proveedores no sean prolijos:**



El sistema muestra opciones donde el usuario debe indicar:



* Proveedor
* Producto
* Precio
* Codigo
* Condición 1
* Condicion 2
* Condicion 3
* Condicion 4



Etc...



Una vez cargada las opciones, se acepta y se carga todo en la base de datos.



En el caso de que se inserte un producto sin equivalencia, ósea, que no exista en el sistema de forma interna el producto queda guardado en una tabla "Pendiente de revision" para que un responsable la gestione más tarde.



Si hay errores de tipeo en nombre/códigos



### **Tabla de equivalencias**



Cuando un proveedor manda su lista, puede usar nombres o códigos distintos a los que usa el sistema interno de Gampack. Por lo que el sistema necesita saber cual producto del proveedor corresponde a cual producto tuyo.



Para solucionar esto se usa una tabla de equivalencias que relaciona:

* El nombre del proveedor
* El código del proveedor
* EL nombre interno que tiene en la empresa
* El código interno que tiene en la empresa



¿Que se hace?



1. Cuando se carga un producto, busca en la tabla de equivalencias.



2\. Si encuentra el producto, lo compara bien.



3\. Si no lo encuentra, te pregunta a que producto interno corresponde *(ver la forma donde poder seleccionar o aclarar a cual corresponde)*



4\. Esa relación se guarda para la próxima vez (por eso la tabla de equivalencia)



Por lo tanto, nos sirve para poder comparar precios correctamente, aunque cada proveedor use un nombre distinto. Es una forma de traducir el código externo que llega en el código interno para que siempre se entienda.





FALTA PENSAR:





En el caso de que el tercero cargue los datos de forma manual, que pasa si hay errores de tipeo en nombres/códigos? Deberia pedir una confirmación extra?



El sistema puede usar algoritmos de similitud de cadenas (como Levenshtein) para detectar errores de tipeo en nombres o códigos al cargar datos manualmente. Si encuentra coincidencias cercanas, sugiere al usuario la opción correcta antes de guardar, evitando duplicados y mejorando la calidad de los datos.



Ejemplo: si se carga el producto “Tornillo 8x25 zincado” y ya existe “Tornillo 8x25 cincado”, el sistema sugiere esta última como posible coincidencia para confirmar o corregir.

