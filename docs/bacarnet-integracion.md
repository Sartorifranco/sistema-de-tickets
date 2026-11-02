# API de integración Bacarnet — flujo del ticket

Prefijo: `/api/integrations/bacarnet`

Autenticación: header `X-Api-Key`. No se registra la clave en los logs.

Tope: **300 solicitudes por minuto por IP**. Si se supera, la respuesta es `429`:

```json
{ "success": false, "message": "Demasiadas solicitudes a la integración. Probá de nuevo en un minuto." }
```

Los endpoints que ya estaban en producción no cambian de contrato: `GET /catalogo`, `POST /tickets`, `GET /tickets/:id`, comentarios, adjuntos, y `PUT /tickets/:id/estado` con `cerrar` o `reabrir`.

Antes del deploy hay que correr la migración (no pisa tickets existentes):

```bash
node scripts/run-bacarnet-integration-source-migration.js
```

Agrega `tickets.integration_source` (nullable). Los tickets nuevos de esta API quedan con `bacarnet`. Los anteriores, con título `Bacarnet - ...` y departamento de Bacar, siguen siendo operables sin reescribirlos.

La clave solo puede **modificar** tickets creados por la integración. Un ticket del sistema que no cumple eso responde `403`.

El historial queda en un comentario interno del ticket y en `activity_logs`. El texto empieza con `Integración bacarnet` y el autor es el agente indicado. Esos comentarios no salen en `GET /comentarios` (ahí solo van los públicos).

Horas: el cuerpo pide **minutos**. 1 hora = 60 minutos. Se suman a `horas_reales` (horas, 2 decimales, máximo 999.99), la misma columna que usa la pantalla.

Agente: tiene que existir, estar activo y poder recibir tickets, igual que en la pantalla (agente, administrador, jefe o compras).

Asignar **no cambia** el estado. Así se puede resolver después: `open` → `resolved` → `closed`.

En Desarrollo (y en tareas internas) no se puede resolver sin horas reales mayores a cero. Es la misma validación que al resolver desde la pantalla.

## PUT /tickets/:id/asignar

```bash
curl -X PUT "$BASE/api/integrations/bacarnet/tickets/123/asignar" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentEmail":"agente@example.com"}'
```

También se acepta `agentId` en lugar del email, o los dos si son la misma persona.

```json
{
  "success": true,
  "data": {
    "stTicketId": 123,
    "status": "open",
    "assigned_to_user_id": 1,
    "agentEmail": "agente@example.com",
    "agentNombre": "Agente Ejemplo"
  }
}
```

Errores: `404` ticket o usuario inexistente, `400` usuario inactivo o que no puede recibir tickets, `403` ticket ajeno a la integración.

## POST /tickets/:id/horas

Suma tiempo. No reemplaza lo ya cargado.

```bash
curl -X POST "$BASE/api/integrations/bacarnet/tickets/123/horas" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentEmail":"agente@example.com","minutos":60,"descripcion":"Ajuste de pantalla"}'
```

`descripcion` es opcional (máximo 500 caracteres). También se acepta `agentId`.

```json
{
  "success": true,
  "data": {
    "stTicketId": 123,
    "minutos": 60,
    "horasAgregadas": 1,
    "horas_reales": 1,
    "descripcion": "Ajuste de pantalla",
    "agentEmail": "agente@example.com"
  }
}
```

No se cargan horas si el ticket está `closed` (`400`).

## PUT /tickets/:id/estado

Se agrega `accion: "resolver"`. `cerrar` y `reabrir` siguen igual y siguen exigiendo estado `resolved`.

`resolver` exige estado `open`, el `requesterEmail` del solicitante del ticket, y horas reales si el ticket es de Desarrollo o tarea interna. Pasa a `resolved`.

```bash
curl -X PUT "$BASE/api/integrations/bacarnet/tickets/123/estado" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requesterEmail":"solicitante@example.com","accion":"resolver"}'
```

```json
{
  "success": true,
  "data": {
    "stTicketId": 123,
    "status": "resolved",
    "previousStatus": "open",
    "accion": "resolver"
  }
}
```

Transición inválida (`400`), por ejemplo resolver un ticket que no está `open`:

```json
{
  "success": false,
  "message": "No se puede resolver un ticket en estado 'resolved'. Resolver solo es válido si el estado actual es 'open' (pasa a 'resolved')."
}
```

Cerrar, igual que antes, con el ticket ya en `resolved`:

```bash
curl -X PUT "$BASE/api/integrations/bacarnet/tickets/123/estado" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requesterEmail":"solicitante@example.com","accion":"cerrar"}'
```

## PUT /tickets/:id/cerrar-completo

Asigna, suma las horas, resuelve y cierra en una sola transacción. Si algo no vale, no queda ningún cambio a medias. El ticket tiene que estar `open`.

```bash
curl -X PUT "$BASE/api/integrations/bacarnet/tickets/123/cerrar-completo" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentEmail":"agente@example.com","minutos":60,"descripcion":"Listo"}'
```

```json
{
  "success": true,
  "data": {
    "stTicketId": 123,
    "status": "closed",
    "previousStatus": "open",
    "accion": "cerrar-completo",
    "assigned_to_user_id": 1,
    "agentEmail": "agente@example.com",
    "minutos": 60,
    "horas_reales": 1
  }
}
```

Clave inválida o ausente, en cualquier ruta:

```json
{ "success": false, "message": "API key inválida o ausente.", "code": "INVALID_API_KEY" }
```

Ticket inexistente:

```json
{ "success": false, "message": "Ticket no encontrado." }
```

## Pruebas

```bash
node scripts/test-bacarnet-workflow.js
node scripts/test-bacarnet-integration.js
```

El script de workflow crea tickets de prueba (departamento 52, categoría 25), los asigna al usuario id 1, carga 60 minutos, resuelve y cierra. También cubre ticket inexistente, agente inexistente, transición inválida y clave inválida. No modifica los tickets ya creados por Bacarnet.
