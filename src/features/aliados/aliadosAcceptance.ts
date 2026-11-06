// Aceptacion electronica obligatoria del aliado (terminos y aviso de privacidad). El navegador solo envia las
// versiones que mostro y las dos casillas; la identidad, la fecha, la accion y el origen los fija la base
// (ally_accept_terms, migracion 0006) a partir de la sesion autenticada. El acceso nunca se concede aqui: tras
// guardar se vuelve a consultar el estado en la base y solo "accepted = true" abre el panel.
import { PRIVACY_VERSION, TERMS_VERSION } from './aliadosLegal';

export const ACCEPTANCE_ROUTE = '/aliados/aceptar';

export const TERMS_CHECKBOX_LABEL = `He leído y acepto los Términos y Condiciones de Aliados Charlitron, versión ${TERMS_VERSION}, y entiendo que las comisiones se acuerdan por proyecto y no están garantizadas`;
export const PRIVACY_CHECKBOX_LABEL = `Confirmo que el Aviso Integral de Privacidad, versión ${PRIVACY_VERSION}, fue puesto a mi disposición y pude consultarlo`;
export const ACCEPT_BUTTON_LABEL = 'Aceptar condiciones y entrar al panel';

export interface AcceptanceInput {
  terms: boolean;
  privacy: boolean;
}

export interface AcceptanceState {
  accepted: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
}

interface RpcResult {
  data: unknown;
  error: unknown;
}

// Subconjunto minimo de supabase-js, para poder probar la logica sin red.
export interface AcceptanceClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

// El boton solo se habilita con ambas casillas marcadas de forma independiente.
export function canSubmitAcceptance(input: AcceptanceInput): boolean {
  return input.terms === true && input.privacy === true;
}

// Cualquier error o respuesta inesperada se propaga: ante la duda, sin acceso.
export async function fetchAcceptanceState(client: AcceptanceClient): Promise<AcceptanceState> {
  const result = await client.rpc('ally_acceptance_state');
  if (result.error) throw new Error('No se pudo verificar la aceptación.');
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as
    | { accepted?: unknown; current_terms_version?: unknown; current_privacy_version?: unknown }
    | null
    | undefined;
  if (!row || typeof row.accepted !== 'boolean') throw new Error('No se pudo verificar la aceptación.');
  return {
    accepted: row.accepted,
    termsVersion: typeof row.current_terms_version === 'string' ? row.current_terms_version : null,
    privacyVersion: typeof row.current_privacy_version === 'string' ? row.current_privacy_version : null,
  };
}

export type AcceptanceResult = { ok: true } | { ok: false; message: string };

export function acceptanceErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code ?? '';
  if (code === '22023') return 'Los documentos se actualizaron. Recarga la página para ver las versiones vigentes.';
  if (code === '42501') return 'Tu cuenta no está autorizada para aceptar estas condiciones. Contacta a Charlitron.';
  if (/failed to fetch|networkerror|load failed/i.test(error?.message ?? '')) {
    return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  }
  return 'No pudimos guardar tu aceptación. No tienes acceso al panel todavía; intenta de nuevo.';
}

const NOT_SAVED: AcceptanceResult = {
  ok: false,
  message: 'No pudimos confirmar tu aceptación. No tienes acceso al panel todavía; intenta de nuevo.',
};

// Registra la aceptacion y la verifica con una segunda consulta; solo entonces devuelve ok.
export async function recordAcceptance(client: AcceptanceClient, input: AcceptanceInput): Promise<AcceptanceResult> {
  if (!canSubmitAcceptance(input)) {
    return { ok: false, message: 'Marca ambas casillas para continuar.' };
  }
  let saved: RpcResult;
  try {
    saved = await client.rpc('ally_accept_terms', {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_terms_accepted: true,
      p_privacy_confirmed: true,
    });
  } catch (error) {
    return { ok: false, message: acceptanceErrorMessage(error as { message?: string }) };
  }
  if (saved.error) return { ok: false, message: acceptanceErrorMessage(saved.error as { code?: string; message?: string }) };

  try {
    const state = await fetchAcceptanceState(client);
    return state.accepted ? { ok: true } : NOT_SAVED;
  } catch {
    return NOT_SAVED;
  }
}
