// db.js
import 'dotenv/config';
import fs from 'fs';
import neo4j from 'neo4j-driver';

const {
  NEO4J_URI = 'bolt://localhost:7687',
  NEO4J_USER = 'neo4j',
  NEO4J_PASSWORD = 'password123',
} = process.env;

export class Neo4jDB {
  constructor() {
    this.driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  }

  async close() {
    await this.driver.close();
  }

  async bootstrap(cypherPath = 'cypher_bootstrap.cypher') {
    const text = fs.readFileSync(cypherPath, 'utf-8');
    const stmts = text
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    const session = this.driver.session();
    try {
      for (const stmt of stmts) {
        await session.run(stmt);
      }
    } finally {
      await session.close();
    }
  }

  // ---------- personas ----------
  async addPerson({ nombre, ciudad, hobby }) {
    // MERGE garantiza un solo nodo por 'nombre' (unique constraint).
    // ON CREATE/ON MATCH setean/actualizan propiedades ciudad/hobby.
    const cypher = `
      MERGE (p:Persona {nombre: $nombre})
      ON CREATE SET p.ciudad = $ciudad, p.hobby = $hobby
      ON MATCH  SET p.ciudad = $ciudad, p.hobby = $hobby
      RETURN p
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { nombre, ciudad, hobby });
      return res.records[0]?.get('p') ?? null;
    } finally {
      await session.close();
    }
  }

  async listPeople() {
    // Lista todas las personas con sus propiedades básicas, ordenadas por nombre.
    const cypher = `
      MATCH (p:Persona)
      RETURN p.nombre AS nombre, p.ciudad AS ciudad, p.hobby AS hobby
      ORDER BY nombre
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher);
      return res.records.map(r => ({
        nombre: r.get('nombre'),
        ciudad: r.get('ciudad'),
        hobby: r.get('hobby'),
      }));
    } finally {
      await session.close();
    }
  }

  async findPerson(nombre) {
    // Busca una persona exacta por 'nombre' y devuelve el nodo.
    const session = this.driver.session();
    try {
      const res = await session.run('MATCH (p:Persona {nombre:$nombre}) RETURN p', { nombre });
      return res.records[0]?.get('p') ?? null;
    } finally {
      await session.close();
    }
  }

  async deletePerson(nombre) {
    // Elimina la persona y TODAS sus relaciones (DETACH DELETE).
    const session = this.driver.session();
    try {
      await session.run('MATCH (p:Persona {nombre:$nombre}) DETACH DELETE p', { nombre });
    } finally {
      await session.close();
    }
  }

  // ---------- amistades ----------
  // Nota de modelado:
  // Se crea una ÚNICA relación :AMIGO_DE y la guardamos en dirección canónica:
  // (nombre menor) -[:AMIGO_DE]-> (nombre mayor).
  // Luego consultamos con patrón NO dirigido -[:AMIGO_DE]- para simetría.

  async createFriendship(aName, bName) {
    if (!aName || !bName || aName === bName) return 0;

    // MATCH encuentra ambos nodos por nombre.
    // WITH reordena 'a' y 'b' para obtener 'left' y 'right' en orden alfabético.
    // MERGE crea (left)-[:AMIGO_DE]->(right) si no existe; si ya existe, no duplica.
    const cypher = `
      MATCH (a:Persona {nombre:$a}), (b:Persona {nombre:$b})
      WITH a, b,
        CASE WHEN a.nombre < b.nombre THEN a ELSE b END AS left,
        CASE WHEN a.nombre < b.nombre THEN b ELSE a END  AS right
      MERGE (left)-[r:AMIGO_DE]->(right)
      RETURN r
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { a: aName, b: bName });
      return res.records.length > 0 ? 1 : 0;
    } finally {
      await session.close();
    }
  }

  async listFriends(nombre) {
    // Recupera todos los amigos de 'nombre' usando patrón NO dirigido
    // para que la relación sea tratada como simétrica.
    const cypher = `
      MATCH (:Persona {nombre:$nombre})-[:AMIGO_DE]-(f:Persona)
      RETURN f.nombre AS nombre, f.ciudad AS ciudad, f.hobby AS hobby
      ORDER BY nombre
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { nombre });
      return res.records.map(r => ({
        nombre: r.get('nombre'),
        ciudad: r.get('ciudad'),
        hobby: r.get('hobby'),
      }));
    } finally {
      await session.close();
    }
  }

  async deleteFriendship(aName, bName) {
    // Borra la(s) relación(es) de amistad entre a y b en ambas direcciones,
    // usando un patrón NO dirigido para cubrir cualquier orientación.
    const cypher = `
      MATCH (a:Persona {nombre:$a})-[r:AMIGO_DE]-(b:Persona {nombre:$b})
      DELETE r
      RETURN count(r) AS borradas
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { a: aName, b: bName });
      return neo4j.integer.toNumber(res.records[0].get('borradas'));
    } finally {
      await session.close();
    }
  }

  // ---------- recomendaciones ----------
  async recommendByCity(nombre) {
    // Recomienda personas de la MISMA ciudad que 'p' que aún NO son amigas de 'p'.
    // NOT (p)-[:AMIGO_DE]-(c) evita sugerir amistades ya existentes.
    const cypher = `
      MATCH (p:Persona {nombre:$nombre})
      MATCH (c:Persona {ciudad: p.ciudad})
      WHERE c <> p AND NOT (p)-[:AMIGO_DE]-(c)
      RETURN c.nombre AS nombre, c.ciudad AS ciudad, c.hobby AS hobby
      ORDER BY nombre
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { nombre });
      return res.records.map(r => ({
        nombre: r.get('nombre'),
        ciudad: r.get('ciudad'),
        hobby: r.get('hobby'),
      }));
    } finally {
      await session.close();
    }
  }

  async recommendByHobby(nombre) {
    // Recomienda personas con el MISMO hobby que 'p' que aún NO son amigas de 'p'.
    const cypher = `
      MATCH (p:Persona {nombre:$nombre})
      MATCH (c:Persona {hobby: p.hobby})
      WHERE c <> p AND NOT (p)-[:AMIGO_DE]-(c)
      RETURN c.nombre AS nombre, c.ciudad AS ciudad, c.hobby AS hobby
      ORDER BY nombre
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher, { nombre });
      return res.records.map(r => ({
        nombre: r.get('nombre'),
        ciudad: r.get('ciudad'),
        hobby: r.get('hobby'),
      }));
    } finally {
      await session.close();
    }
  }

  // ---------- estadísticas ----------
  async stats() {
    // Subconsulta 1: cuenta total de personas.
    // Subconsulta 2: cuenta total de relaciones :AMIGO_DE (una por amistad).
    // Calcula el promedio de amigos por persona = total_amistades / total_personas.
    const cypher = `
      CALL {
        WITH 1 AS _
        MATCH (p:Persona)
        RETURN count(p) AS total_personas
      }
      CALL {
        WITH 1 AS _
        MATCH ()-[r:AMIGO_DE]->()
        RETURN count(r) AS total_amistades
      }
      RETURN total_personas, total_amistades,
             CASE WHEN total_personas = 0 THEN 0.0
                  ELSE toFloat(total_amistades)/toFloat(total_personas) END AS promedio_amigos
    `;
    const session = this.driver.session();
    try {
      const res = await session.run(cypher);
      const rec = res.records[0];
      return {
        total_personas: neo4j.integer.toNumber(rec.get('total_personas')),
        total_amistades: neo4j.integer.toNumber(rec.get('total_amistades')),
        promedio_amigos: rec.get('promedio_amigos'),
      };
    } finally {
      await session.close();
    }
  }
}
