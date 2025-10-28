# Mini Social Network (Node.js + Neo4j)

Pequeña app de consola para gestionar personas, amistades y recomendaciones con Neo4j.

## Stack
- Node 18+, neo4j-driver, dotenv
- Neo4j 5 (Docker)

## Setup
```bash
docker run --name neo4j-social -p 7474:7474 -p 7687:7687 -d -e NEO4J_AUTH=neo4j/password123 neo4j:5
npm install
npm start
```

# Análisis Post-Implementacion: Neo4j en Aplicación de Red Social

## 🧩 Pregunta 1:

### ✅ Ajuste al dominio (red social)

La lógica del dominio gira en torno a **relaciones entre personas**: amistades, amigos de amigos, y recomendaciones por afinidad. En este contexto:

- Las **relaciones son entidades de primera clase** en Neo4j.
- Los **recorridos multi-hop** (ej. amigos de amigos) son naturales y eficientes.
- El modelo de grafos se adapta perfectamente a este tipo de consultas.

### 🔎 Consultas más simples con Cypher

#### Ejemplo: obtener amigos de una persona

```cypher
MATCH (p:Persona {nombre: $nombre})-[:AMIGO_DE]-(f:Persona)
RETURN f
```
#### Ejemplo: recomendaciones evitando amistades existentes

```cypher
MATCH (p:Persona {nombre: $nombre})
MATCH (c:Persona {ciudad: p.ciudad})
WHERE c <> p AND NOT (p)-[:AMIGO_DE]-(c)
RETURN c
```

En SQL, este tipo de lógica requiere múltiples JOIN y subconsultas, lo que genera consultas más verbosas y difíciles de mantener.

### 🚀 Complejidad y rendimiento

- El costo operativo depende del subgrafo alcanzado y del grado de los nodos, no del tamaño total de la base.

- Las consultas como "amigos de amigos" son eficientes y escalan bien.

- La topología del grafo permite consultas más inteligentes y eficientes.

### 🔄 Evolución del modelo

- El modelo es esquema-ligero y flexible.

- Agregar nuevas relaciones como :SIGUE o :TRABAJA_EN no requiere migraciones complejas.

- Ideal para proyectos en evolución constante.

## 🧩 Pregunta 2:

### ✅ Optimizaciones propuestas:
---
### 🔍 Índices y constraints

- CONSTRAINT de unicidad en Persona.nombre para lookups O(1).

- Índices en propiedades clave: ciudad, hobby, etc.

- Evitar indexar propiedades con baja selectividad global.

### 🧠 Optimización de consultas

- Filtrar primero por propiedades indexadas.

- Usar NOT (p)-[:AMIGO_DE]-(c) después para reducir fan-out.

- Uso de LIMIT y paginación para evitar grandes volúmenes de respuesta.

- Usar PROFILE/EXPLAIN para verificar uso de índices.
