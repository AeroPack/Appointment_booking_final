/**
 * One place to turn an RTK Query error into a message a user can read.
 *
 * Previously six near-identical copies of this existed across AuthFlow,
 * ForgotPassword, and SignupFlow, and every one of them fell back to a generic
 * string ("Login failed", "Registration failed", ...) whenever the response
 * body wasn't the API's { error: { message } } envelope - which happens not
 * just for real validation failures but for a dead backend, a proxy timeout,
 * or a CORS failure returning an HTML error page. Those two situations need
 * different messages: one is the user's mistake, the other is not.
 */

interface ApiErrorPayload {
  data?: { error?: { code?: string; message?: string } }
  status?: number | string
}

const UNREACHABLE_MESSAGE = 'Could not reach the server. Check your connection and try again.'

/**
 * @param err - Whatever RTK Query's `.unwrap()` rejected with
 * @param fallback - Message to use only when the server *did* respond with a
 *   recognizable error shape but no message string was present
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') {
    return UNREACHABLE_MESSAGE
  }

  const payload = err as ApiErrorPayload

  // FETCH_ERROR / TIMEOUT_ERROR: the request never got a response at all.
  // PARSING_ERROR: something answered, but not with JSON (an nginx 502 page).
  if (payload.status === 'FETCH_ERROR' || payload.status === 'TIMEOUT_ERROR' || payload.status === 'PARSING_ERROR') {
    return UNREACHABLE_MESSAGE
  }

  const apiMessage = payload.data?.error?.message
  if (apiMessage) {
    return apiMessage
  }

  // A response arrived and parsed as JSON but didn't carry our error envelope -
  // still worth treating as reachable-but-unrecognized rather than offline.
  return fallback
}
