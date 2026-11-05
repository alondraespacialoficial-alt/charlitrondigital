// Identificacion del responsable legal de la operacion Charlitron Digital. Fuente unica del aviso general,
// del aviso de Aliados y de los terminos. No publicar aqui CURP, idCIF, RFC ni documentos fiscales.
export const LEGAL_RESPONSIBLE_NAME = 'Carlos Leonardo Álvarez Cedillo';
export const LEGAL_RESPONSIBLE_ROLE = 'persona física, titular fiscal y responsable legal de la operación Charlitron Digital';
export const LEGAL_LOCATION = 'San Luis Potosí, S.L.P., México';
// Domicilio fiscal capturado de la constancia (solo calle, colonia, C.P. y ciudad; sin CURP, RFC, idCIF ni copias).
export const LEGAL_FISCAL_ADDRESS: string | null =
  'Calle Lanzagorta 330, colonia San Sebastián, C.P. 78349, San Luis Potosí, San Luis Potosí, México';
// No pasar a true sin la autorización expresa de Carlos Leonardo Álvarez Cedillo para publicarlo como domicilio del responsable.
export const LEGAL_ADDRESS_PUBLICATION_AUTHORIZED = false;
export const LEGAL_ADDRESS_LINE = LEGAL_ADDRESS_PUBLICATION_AUTHORIZED && LEGAL_FISCAL_ADDRESS ? LEGAL_FISCAL_ADDRESS : LEGAL_LOCATION;

// Administrador operativo del programa Aliados (no es el responsable legal).
export const ALIADOS_ADMIN_NAME = 'José Adrián Álvarez Carlos';
export const ALIADOS_ADMIN_ROLE = 'director comercial y administrador de Aliados Charlitron';
