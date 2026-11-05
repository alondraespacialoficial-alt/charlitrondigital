# Revisión legal — Charlitron Digital y Aliados Charlitron

**Estado**: borrador pendiente de revisión jurídica. El registro público de aliados sigue cerrado.

Los textos publicados viven en el código y son la fuente única; este documento no los copia para que no se desfasen:

| Documento | Dónde vive |
| --- | --- |
| Aviso de privacidad general del sitio | `src/components/LegalPage.tsx` (pestaña 1) |
| Términos y condiciones de uso del sitio | `src/components/LegalPage.tsx` (pestaña 2) |
| Aviso de privacidad del programa Aliados (`/aliados/privacidad`) | `PRIVACY_SECTIONS` en `src/features/aliados/aliadosLegal.ts` |
| Términos del programa Aliados (`/aliados/terminos`) | `TERMS_SECTIONS` en `src/features/aliados/aliadosLegal.ts` |
| Identificación del responsable | `src/data/legalEntity.ts` |
| Pendientes jurídicos | `LEGAL_PENDING` en `src/features/aliados/aliadosLegal.ts` |

---

## 1. Identificación (decisión confirmada por Alondra y Charlie)

- **Responsable legal y titular fiscal**: Carlos Leonardo Álvarez Cedillo, persona física, con su consentimiento. Sustituye a la identificación anterior ("José Adrián Álvarez Carlos y/o Charlitron Digital S.A. de C.V."), que se retiró del aviso general y del borrador de Aliados.
- **Administrador de Aliados Charlitron**: José Adrián Álvarez Carlos, director comercial. Figura solo con ese rol en el aviso y los términos de Aliados.
- **Contacto propuesto** (privacidad, ARCO y dudas legales): `nadrian18@gmail.com`, tomado de `CONTACT_EMAIL`. Se eliminaron `privacidad@charlitrondigital.com` y `aliados@charlitron.com`, que no estaban confirmados.
- **Domicilio fiscal**: Calle Lanzagorta 330, colonia San Sebastián, C.P. 78349, San Luis Potosí, San Luis Potosí, México (tomado de la Constancia de Situación Fiscal). Capturado en `LEGAL_FISCAL_ADDRESS`. Carlos Leonardo Álvarez Cedillo **autorizó expresamente** publicarlo como domicilio del responsable (art. 16 LFPDPPP), por lo que `LEGAL_ADDRESS_PUBLICATION_AUTHORIZED = true`. Se muestra únicamente en el aviso de privacidad general y en el de Aliados; no aparece en términos, cookies, landing ni formularios.
- **No se incorporan** CURP, RFC, idCIF ni copias de la constancia; una prueba lo verifica.

No se modificaron créditos de autoría ni los pies de página con la marca "Charlitron Digital" (son marca, no identificación del responsable).

## 2. Tratamientos separados

- **Aviso general**: datos de quien pide información o cotizaciones (nombre, correo, WhatsApp, negocio, mensaje). Finalidades sin cambios. No menciona Aliados.
- **Aviso de Aliados**: solicitud y cuenta del aliado, datos de las personas recomendadas y operación (ventas, cobros, comisiones, auditoría). Declara que es independiente del general y separa las finalidades sobre el aliado de las finalidades sobre las personas recomendadas.

## 3. Inconsistencias resueltas

| Tema | Antes | Ahora |
| --- | --- | --- |
| Responsable | José Adrián "y/o" S.A. de C.V.; contactos de dominios distintos | Carlos Leonardo Álvarez Cedillo; un solo contacto |
| Conservación de solicitudes rechazadas | "Se eliminan a los 7 días" | Se conservan mientras no se defina un plazo de eliminación. Los 30 días son solo el enfriamiento antes de aceptar otra solicitud del mismo correo (migración 0004), no el plazo de conservación. No se promete eliminación automática porque no está implementada |
| Cancelación vs. auditoría | "Auditoría permanente" junto con derecho de cancelación | Se declara que ventas, cobros, comisiones y auditoría no se eliminan por diseño; el alcance de la cancelación queda pendiente |
| Datos de referidos | "Son propiedad de Charlitron" | Son datos de terceros; el aliado declara su autorización (la plataforma la exige); finalidades propias y sin compartirse con otros aliados |
| Autorización de datos | "Autorizo procesar y *compartir* mis datos" | "Tratar" mis datos para las finalidades del aliado; no se comparten con terceros |
| Duplicados | "Charlitron decide la asignación" | La primera recomendación es la referencia (como hace el sistema) y Charlitron decide manualmente las demás |
| Comisiones | "Porcentaje del monto cobrado (no acordado)" y "no puede superar 100 %" | Monto acordado por escrito por proyecto, sin porcentajes fijos; la parte liberable es proporcional a lo cobrado y nunca excede el monto acordado; asignación, autorización y pago manuales |
| Medios de pago | Transferencia, cheque o efectivo | "Por el medio que se acuerde" |
| Plazos (48 h, 30 días, 7 días) | Cifras sin validar en el texto público | Retirados del texto público y listados como pendientes |
| Pasos de activación | `REGISTRO_PUBLICO_HABILITADO` y proyecto `charlitron-aliados-test` | Ver sección 5 |

## 4. Pendientes que requieren revisión jurídica

Lista completa y vigente en `LEGAL_PENDING`. Resumen:

1. Constancia escrita de la designación del responsable y de su aceptación (la autorización de publicar el domicilio ya fue otorgada).
2. Relación de José Adrián con el tratamiento (personal del responsable o encargado).
3. Confirmar el canal oficial de privacidad (el correo propuesto es el del administrador del programa).
4. Procedimiento, medio y plazos ARCO; revocación del consentimiento; derechos adicionales.
5. **Retención**: plazos definitivos y mecanismo de eliminación; hoy no existe proceso de eliminación y no debe prometerse eliminación automática hasta implementarla.
6. Cancelación frente a registros inmutables (ventas, comisiones, cobros y auditoría).
7. **Transferencias y encargados**: Supabase y Vercel, posible tratamiento fuera de México.
8. Cómo se informa a las personas recomendadas al ser contactadas.
9. **Documentación fiscal**: comprobantes y retenciones por comisiones; facturación a nombre del titular fiscal.
10. Formato del acuerdo escrito de comisión por proyecto.
11. Plazos de aviso previo para cambios o terminación.
12. Ley aplicable, jurisdicción, GDPR/CCPA.
13. Revisión y firma de abogado y fecha de vigencia de los tres documentos (el aviso general lleva "Noviembre de 2026" y debe confirmarse al publicar).

## 5. Activación del registro público

Requiere **ambas** llaves; ninguna está abierta:

1. `ALIADOS_LEGAL_APPROVED = true` en `aliadosLegal.ts` (solo con `LEGAL_PENDING` vacío; una prueba lo exige).
2. `aliados_settings.registration_open = true` en la base, con la migración `aliados-lab-0004-registration.sql` instalada.

Además: configurar en el Supabase de Aliados las Redirect URLs (`/aliados/activar`), SMTP propio y la vigencia de las invitaciones, y probar una invitación real.

## 6. Notas técnicas de seguridad

- Supabase de Aliados independiente del editorial; las variables `ALIADOS_*` se validan en el build y en Production son obligatorias.
- RLS en todas las tablas; el aliado solo lee vistas `ally_my_*`, el administrador vistas `admin_*`, y toda escritura pasa por funciones `SECURITY DEFINER`.
- La clave de servicio solo existe en el servidor (`/api/aliados-approve-registration`, `/api/aliados-resend-invitation`).
- Auditoría de solo anexar; cobros y pagos inmutables (se corrigen con reversiones).
- Registro: máximo 10 solicitudes por hora, 30 por día y 100 pendientes (migración 0004).

**Responsable legal final**: Carlos Leonardo Álvarez Cedillo (pendiente de revisión y firma de abogado).
**Fecha de validación final**: pendiente.
