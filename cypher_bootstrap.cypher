// nombre único (identidad de persona)
CREATE CONSTRAINT persona_nombre_unique IF NOT EXISTS
FOR (p:Persona)
REQUIRE p.nombre IS UNIQUE;

// índices de filtrado para recomendaciones/búsquedas
CREATE INDEX persona_ciudad IF NOT EXISTS FOR (p:Persona) ON (p.ciudad);
CREATE INDEX persona_hobby  IF NOT EXISTS FOR (p:Persona) ON (p.hobby);