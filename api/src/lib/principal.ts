/** The role the editing page requires. Invitations in Azure assign it. */
export const editorRole = 'editor';

export type Principal = {
  userId: string;
  userDetails: string;
  userRoles: string[];
};

type HeaderSource = { get(name: string): string | null };

/**
 * Reads the signed-in user that Static Web Apps passes to every function.
 *
 * The platform sets this header itself after sign-in, and managed
 * functions cannot be reached except through the platform, so a visitor
 * cannot forge it. The route rules in staticwebapp.config.json check the
 * role first; this check stays in place in case a rule is ever wrong.
 */
export function readPrincipal(headers: HeaderSource): Principal | null {
  const header = headers.get('x-ms-client-principal');
  if (!header) return null;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(header, 'base64').toString('utf8'),
    );

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      typeof parsed.userId === 'string' &&
      'userRoles' in parsed &&
      Array.isArray(parsed.userRoles)
    ) {
      return {
        userId: parsed.userId,
        userDetails:
          'userDetails' in parsed && typeof parsed.userDetails === 'string'
            ? parsed.userDetails
            : '',
        userRoles: parsed.userRoles.filter(
          (role): role is string => typeof role === 'string',
        ),
      };
    }
  } catch {
    // A header that is not valid base64 JSON counts as no user.
  }

  return null;
}

export function isEditor(principal: Principal | null): boolean {
  return principal?.userRoles.includes(editorRole) ?? false;
}
