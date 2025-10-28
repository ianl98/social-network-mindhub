import { Neo4jDB } from './db.js';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function imprimirPersonas(rows) {
  if (!rows || rows.length === 0) {
    console.log('No hay personas registradas.');
    return;
  }
  console.log(`${'Nombre'.padEnd(20)} ${'Ciudad'.padEnd(15)} ${'Hobby'.padEnd(15)}`);
  console.log('-'.repeat(52));
  for (const r of rows) {
    console.log(
      `${(r.nombre ?? '').toString().slice(0, 20).padEnd(20)} ` +
      `${(r.ciudad ?? '').toString().slice(0, 15).padEnd(15)} ` +
      `${(r.hobby ?? '').toString().slice(0, 15).padEnd(15)}`
    );
  }
}

async function inputObligatorio(rl, prompt) {
  while (true) {
    const v = (await rl.question(prompt)).trim();
    if (v) return v;
    console.log('⚠️  Este campo es obligatorio.');
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const db = new Neo4jDB();

  try {
    await db.bootstrap();

    while (true) {
      console.log(`
=== MINI RED SOCIAL ===
1. Agregar persona
2. Listar todas las personas
3. Buscar persona
4. Crear amistad
5. Ver amigos de una persona
6. Eliminar amistad
7. Recomendaciones por ciudad
8. Recomendaciones por hobby
9. Estadísticas
10. Eliminar persona
0. Salir
`);
      const op = (await rl.question('Elegí una opción: ')).trim();

      if (op === '1') {
        const nombre = await inputObligatorio(rl, 'Nombre: ');
        const ciudad = await inputObligatorio(rl, 'Ciudad: ');
        const hobby  = await inputObligatorio(rl, 'Hobby: ');
        try {
          await db.addPerson({ nombre, ciudad, hobby });
          console.log('✅ Persona creada/actualizada.');
        } catch (e) {
          console.error('❌ Error al crear/actualizar la persona:', e.message);
        }

      } else if (op === '2') {
        const rows = await db.listPeople();
        imprimirPersonas(rows);

      } else if (op === '3') {
        const nombre = await inputObligatorio(rl, 'Nombre a buscar: ');
        const p = await db.findPerson(nombre);
        if (p) {
          console.log(`✅ Encontrada: ${p.properties.nombre} | ${p.properties.ciudad ?? ''} | ${p.properties.hobby ?? ''}`);
        } else {
          console.log('❌ No se encontró la persona.');
        }

      } else if (op === '4') {
        const a = await inputObligatorio(rl, 'Nombre 1: ');
        const b = await inputObligatorio(rl, 'Nombre 2: ');
        try {
          const created = await db.createFriendship(a, b);
          console.log(created
            ? '✅ Amistad creada (semántica simétrica).'
            : 'ℹ️  Sin cambios (ya eran amigos o nombres inválidos).');
        } catch (e) {
          console.error('❌ Error al crear la amistad:', e.message);
        }

      } else if (op === '5') {
        const nombre = await inputObligatorio(rl, 'Persona: ');
        const rows = await db.listFriends(nombre);
        if (!rows.length) console.log('No tiene amigos registrados.');
        else imprimirPersonas(rows);

      } else if (op === '6') {
        const a = await inputObligatorio(rl, 'Nombre 1: ');
        const b = await inputObligatorio(rl, 'Nombre 2: ');
        const borradas = await db.deleteFriendship(a, b);
        console.log(`✅ Relaciones de amistad eliminadas: ${borradas}`);

      } else if (op === '7') {
        const nombre = await inputObligatorio(rl, 'Persona: ');
        const rows = await db.recommendByCity(nombre);
        console.log('— Recomendaciones por ciudad —');
        imprimirPersonas(rows);

      } else if (op === '8') {
        const nombre = await inputObligatorio(rl, 'Persona: ');
        const rows = await db.recommendByHobby(nombre);
        console.log('— Recomendaciones por hobby —');
        imprimirPersonas(rows);

      } else if (op === '9') {
        const r = await db.stats();
        if (r) {
          console.log(`👥 Total de personas: ${r.total_personas}`);
          console.log(`🔗 Total de amistades: ${r.total_amistades}`);
          console.log(`📊 Promedio de amigos por persona: ${Number(r.promedio_amigos).toFixed(2)}`);
        } else {
          console.log('Estadísticas no disponibles.');
        }

      } else if (op === '10') {
        const nombre = await inputObligatorio(rl, 'Nombre a eliminar: ');
        await db.deletePerson(nombre);
        console.log('✅ Persona (y sus relaciones) eliminada.');

      } else if (op === '0') {
        console.log('¡Hasta luego!');
        break;
      } else {
        console.log('Opción inválida. Probá de nuevo.');
      }
    }
  } finally {
    rl.close();
    await db.close();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
