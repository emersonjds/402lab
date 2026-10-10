import type { z } from 'zod';

export type Connection = { api: string; token: string };

export class UnauthorizedError extends Error {}

// Any failure that is not a 401: the UI shows fixed copy, never the server's text.
export class UnreachableError extends Error {}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const request = async <Schema extends z.ZodType>(
  connection: Connection,
  path: string,
  schema: Schema,
  init: { method?: 'GET' | 'PATCH'; body?: unknown } = {},
): Promise<z.output<Schema>> => {
  let response: Response;

  try {
    response = await fetch(`${connection.api}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new UnreachableError();
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new UnreachableError();
  }

  const parsed = schema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new UnreachableError();
  }

  return parsed.data;
};
