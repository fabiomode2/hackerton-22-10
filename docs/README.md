# Documentación — outfit check

> **Empieza aquí.** Este directorio no es un vertedero de Markdown: es el sistema de evidencias del proyecto.
> Cada documento tiene un propósito, un público y un estado. Si dos documentos se contradicen, manda el que esté marcado como **canónico**.

---

## 1. Regla de oro

Un claim sin evidencia es marketing. En este repo, cada afirmación del producto tiene que poder responderse con una de estas tres cosas:

1. **Código**: una ruta y un símbolo que lo implementan.
2. **Demo**: una URL y una interacción reproducible.
3. **Documento de decisión**: por qué se eligió, qué se descartó y qué implica.

Si no se puede responder con ninguna, el claim **no existe**. Es la misma regla que usa `docs/pitch.md` para el escenario, pero aplicada a toda la documentación.

---

## 2. Rutas de lectura

### Si eres jurado y tienes 5 minutos

1. [README](../README.md) — qué es y qué no es.
2. [JUDGE-GUIDE](JUDGE-GUIDE.md) — recorrido clicable, qué mirar y qué preguntar.
3. [CLAIMS](CLAIMS.md) — el ledger REAL / DEMO / ROADMAP, con evidencia.

### Si eres jurado técnico y quieres desmontarlo

1. [ARCHITECTURE](ARCHITECTURE.md) — capas, flujo, contratos y fallbacks.
2. [ENGINE](ENGINE.md) — la matemática del cuerpo, la prenda y el fit.
3. [QUALITY](QUALITY.md) — qué se verificó, cómo reproducirlo y qué no está probado.
4. [DECISIONS](DECISIONS.md) — por qué el prototipo es así y no de la forma "bonita".

### Si vas a tocar el código

1. [AGENTS](../AGENTS.md) — propiedad de archivos, contrato y sincronización.
2. [ARCHITECTURE](ARCHITECTURE.md) — dónde vive cada cosa.
3. [ENGINE](ENGINE.md) — unidades, ejes y fórmulas que no se pueden romper.
4. [QUALITY](QUALITY.md) — checks antes de commitear.

### Si vas a contar la historia

1. [HISTORY](HISTORY.md) — crónica de las 4 horas, pivotes y aprendizajes.
2. [PLAN](PLAN.md) — el plan original (histórico).
3. [pitch](pitch.md) — guion y Q&A.
4. [STATS](STATS.md) — cifras y fuentes.

---

## 3. Mapa de documentos

| Documento | Estado | Público | Qué responde |
|---|---|---|---|
| [README](../README.md) | **Canónico** | Todos | Qué es outfit check, qué es real, cómo arrancarlo |
| [MEMORIA](MEMORIA.md) | **Resumen** | Jurado | Versión narrativa breve: problema, producto, alcance y FAQ |
| [JUDGE-GUIDE](JUDGE-GUIDE.md) | **Canónico** | Jurado | Qué hacer en 60 s / 5 min / 15 min |
| [CLAIMS](CLAIMS.md) | **Canónico** | Jurado / producto | Qué claim está probado, cómo y con qué límite |
| [HISTORY](HISTORY.md) | **Canónico** | Todos | Cómo se construyó en 4 horas y qué se aprendió |
| [ARCHITECTURE](ARCHITECTURE.md) | **Canónico** | Técnico | Cómo está montado el sistema y por qué |
| [ENGINE](ENGINE.md) | **Canónico** | Técnico | Matemática, unidades y algoritmos del motor |
| [DECISIONS](DECISIONS.md) | **Canónico** | Técnico / producto | 12 ADRs con contexto y consecuencias |
| [QUALITY](QUALITY.md) | **Canónico** | Técnico / QA | Evidencia ejecutada, criterios y deuda |
| [PLAN](PLAN.md) | **Histórico** | Producto | El plan original de la ventana de 4 h |
| [pitch](pitch.md) | **Escenario** | Presentación | Guion, timing y Q&A |
| [STATS](STATS.md) | **Fuente** | Presentación | Cifras verificadas y cómo citarlas |
| [pipeline](pipeline.md) | **Diseño** | Técnico | Pipeline LLM + herramientas + motor |
| [vision-extraction](vision-extraction.md) | **Investigación** | Producto | Por qué la visión no mide cm sin escala |
| [agent-notes/](agent-notes/README.md) | **Memoria** | Equipo | Descubrimientos, trampas y atajos |
| [MANNEQUIN-PIPELINE](../packages/fit-engine/MANNEQUIN-PIPELINE.md) | **Diseño** | Técnico | Pipeline antropométrica del maniquí |
| [AGENTS](../AGENTS.md) | **Contrato** | Equipo / agentes | Propiedad, sincronización y reglas |
| [deploy](../deploy/README.md) | **Operación** | Infra | Deploy, previews y VPS |

### Estados, en una línea

- **Canónico**: describe el estado actual; si cambia el código, se actualiza.
- **Resumen**: versión corta y narrativa para lectura rápida; no sustituye al canónico.
- **Histórico**: describe lo que se planeó o se vivió; no se reescribe para que "cuadre".
- **Escenario**: guion de presentación; puede resumir, pero no puede contradecir `CLAIMS`.
- **Fuente**: datos externos con URL y fecha; no se inventan cifras.
- **Diseño / Investigación**: propuesta o estudio; puede incluir cosas no implementadas.
- **Memoria**: notas de trabajo; útil, no normativa.
- **Contrato**: reglas de colaboración; manda sobre la organización del repo.
- **Operación**: cómo se publica y se revierte.

---

## 4. Principios de esta documentación

1. **Una sola verdad por documento.** El ledger vive en `CLAIMS.md`; el pitch lo cita, no lo duplica. El plan original vive en `PLAN.md`; la historia cuenta qué cambió.
2. **Los límites van delante.** Un documento que solo enumera virtudes no es documentación; es un folleto. Cada doc técnico tiene una sección de "qué no hace".
3. **Las decisiones se fechan.** Un ADR sin contexto es una opinión. En `DECISIONS.md` cada decisión tiene alternativas y consecuencias.
4. **La evidencia es ejecutable.** Cuando se puede, el documento incluye el comando que reproduce la comprobación (`node --check`, `npx tsx`, `curl`, etc.).
5. **Se escribe en español; el código, en inglés.** La UI y los docs van en es-ES. Los identificadores siguen la convención del repo.
6. **Nada de datos personales.** No se documentan nombres, correos, teléfonos ni medidas de personas reales. Los perfiles de la demo son fixtures.
7. **Si algo no está implementado, se dice.** `ROADMAP` no es una palabra sucia; es una promesa con fecha pendiente.

---

## 5. Cómo mantenerla

Antes de un commit que cambie comportamiento:

- [ ] ¿Cambia un claim? Actualiza `CLAIMS.md` y, si toca, el ledger de `pitch.md`.
- [ ] ¿Cambia una fórmula o un contrato? Actualiza `ENGINE.md` y `ARCHITECTURE.md`.
- [ ] ¿Cambia el alcance? Añade o modifica un ADR en `DECISIONS.md`.
- [ ] ¿Se ha probado algo nuevo? Anótalo en `QUALITY.md` con comando y resultado.
- [ ] ¿Es un descubrimiento no obvio? Va a `agent-notes/` en 5 bullets.
- [ ] ¿Es una decisión que afecta a otra persona? Se avisa antes de tocar el contrato.

**Regla de tamaño:** si un documento supera las ~700 líneas, probablemente contiene dos documentos. Si una nota de agente supera los 5 bullets, es una decisión: va a `DECISIONS.md`.

---

## 6. Lo que este sistema no es

- No es una wiki exhaustiva de cada línea de código. Para eso está el código.
- No es un sustituto de los tests. La documentación explica; los checks verifican.
- No es neutral: toma partido por la determinación, la privacidad y la explicabilidad. Eso es una decisión de producto, no un accidente.
- No es inmutable. Si el código cambia, la documentación canónica cambia con él. Lo histórico se conserva, pero se marca como histórico.

---

<div align="center">
<sub>Si tienes que leer un solo documento después del README, lee <a href="CLAIMS.md">CLAIMS.md</a>. Es el que evita que el proyecto se crea sus propias mentiras.</sub>
</div>
