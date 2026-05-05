/**
 * Microsoft Graph + To Do (env: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI; optional MICROSOFT_TENANT default common).
 */
import { query } from '../db/index.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LIST_NAME = 'AK Success CRM';

function enc(body) {
  return new URLSearchParams(body).toString();
}

export function isMicrosoftConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_REDIRECT_URI
  );
}

export function buildAuthorizeUrl(state) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access User.Read Tasks.ReadWrite',
    state,
  });
  const tenant = process.env.MICROSOFT_TENANT || 'common';
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const tenant = process.env.MICROSOFT_TENANT || 'common';
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = enc({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error_description || data.error || res.statusText;
    throw new Error(err || 'Token exchange failed');
  }
  return data;
}

export async function refreshTokens(refreshToken) {
  const tenant = process.env.MICROSOFT_TENANT || 'common';
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = enc({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error_description || data.error || res.statusText;
    throw new Error(err || 'Refresh token failed');
  }
  return data;
}

async function persistTokens(userId, tokenJson) {
  const expiresIn = Number(tokenJson.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000 - 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const refresh = tokenJson.refresh_token || null;
  const rows = await query(
    'SELECT refresh_token FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
    [userId]
  );
  const keepRefresh = refresh || (Array.isArray(rows) && rows[0]?.refresh_token) || null;

  await query(
    `INSERT INTO user_microsoft_graph (user_id, access_token, refresh_token, expires_at, ms_account_id, todo_list_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token),
       refresh_token = COALESCE(VALUES(refresh_token), user_microsoft_graph.refresh_token),
       expires_at = VALUES(expires_at),
       updated_at = NOW()`,
    [userId, tokenJson.access_token, keepRefresh, expiresAt]
  );
}

export async function getValidAccessToken(userId) {
  const rows = await query(
    'SELECT access_token, refresh_token, expires_at FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
    [userId]
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row?.access_token) return null;
  const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (exp < Date.now() + 120_000 && row.refresh_token) {
    const t = await refreshTokens(row.refresh_token);
    await persistTokens(userId, { ...t, refresh_token: t.refresh_token || row.refresh_token });
    return t.access_token;
  }
  return row.access_token;
}

export async function graphGet(userId, path) {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error('Microsoft account not linked');
  const res = await fetch(`${GRAPH}${path.startsWith('/') ? path : '/' + path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || data.error || res.statusText);
  return data;
}

export async function graphPost(userId, path, jsonBody) {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error('Microsoft account not linked');
  const res = await fetch(`${GRAPH}${path.startsWith('/') ? path : '/' + path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || res.statusText);
  return data;
}

export async function graphPatch(userId, path, jsonBody) {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error('Microsoft account not linked');
  const res = await fetch(`${GRAPH}${path.startsWith('/') ? path : '/' + path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonBody),
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || res.statusText);
  return data;
}

export async function saveConnectionFromCode(userId, code) {
  const tokenJson = await exchangeCodeForTokens(code);
  await persistTokens(userId, tokenJson);
  const me = await graphGet(userId, '/me');
  const id = me.id || null;
  if (id) {
    await query('UPDATE user_microsoft_graph SET ms_account_id = ? WHERE user_id = ?', [id, userId]);
  }
  return me;
}

export async function ensureCrmTodoListId(userId) {
  const rows = await query(
    'SELECT todo_list_id FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
    [userId]
  );
  const existing = Array.isArray(rows) && rows[0]?.todo_list_id;
  if (existing) return existing;

  let listId;
  try {
    const escaped = LIST_NAME.replace(/'/g, "''");
    const filter = encodeURIComponent(`displayName eq '${escaped}'`);
    const found = await graphGet(userId, `/me/todo/lists?$filter=${filter}`);
    listId = found?.value?.[0]?.id;
  } catch (_) {
    /* filter unsupported in some cases */
  }
  if (!listId) {
    const all = await graphGet(userId, '/me/todo/lists');
    const v = all?.value || [];
    listId = v.find((x) => x.displayName === LIST_NAME)?.id;
  }
  if (!listId) {
    const created = await graphPost(userId, '/me/todo/lists', {
      displayName: LIST_NAME,
    });
    listId = created.id;
  }
  if (listId) {
    await query('UPDATE user_microsoft_graph SET todo_list_id = ? WHERE user_id = ?', [listId, userId]);
  }
  return listId;
}

function dueDateTimeForTask(dueDate) {
  if (!dueDate) return undefined;
  const d = String(dueDate).slice(0, 10);
  return {
    dateTime: `${d}T17:00:00.0000000`,
    timeZone: 'UTC',
  };
}

export async function upsertTodoForTask(userId, taskRow) {
  const listId = await ensureCrmTodoListId(userId);
  const title = taskRow.title || 'CRM task';
  const notes = taskRow.description ? String(taskRow.description).slice(0, 8000) : '';
  const body = {
    title: title.slice(0, 255),
    body: notes ? { content: notes, contentType: 'text' } : undefined,
    dueDateTime: dueDateTimeForTask(taskRow.due_date),
  };
  const msId = taskRow.microsoft_todo_item_id;

  if (msId) {
    const patch = { title: body.title, dueDateTime: body.dueDateTime };
    if (body.body) patch.body = body.body;
    await graphPatch(userId, `/me/todo/lists/${listId}/tasks/${msId}`, patch);
    return msId;
  }

  const payload = { title: body.title };
  if (body.body) payload.body = body.body;
  if (body.dueDateTime) payload.dueDateTime = body.dueDateTime;

  const created = await graphPost(userId, `/me/todo/lists/${listId}/tasks`, payload);
  const newId = created.id;
  if (newId) {
    await query('UPDATE tasks SET microsoft_todo_item_id = ? WHERE id = ?', [newId, taskRow.id]);
  }
  return newId;
}

export async function completeMicrosoftTodo(userId, taskRow) {
  const msId = taskRow.microsoft_todo_item_id;
  if (!msId) return;
  let listId;
  const rows = await query(
    'SELECT todo_list_id FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
    [userId]
  );
  listId = Array.isArray(rows) && rows[0]?.todo_list_id;
  if (!listId) {
    try {
      listId = await ensureCrmTodoListId(userId);
    } catch (_) {
      return;
    }
  }
  if (!listId) return;
  try {
    await graphPatch(userId, `/me/todo/lists/${listId}/tasks/${msId}`, {
      status: 'completed',
    });
  } catch (e) {
    console.warn('[microsoft todo] complete failed', e?.message || e);
  }
}

export async function disconnectUser(userId) {
  await query('DELETE FROM user_microsoft_graph WHERE user_id = ?', [userId]);
  await query('UPDATE tasks SET microsoft_todo_item_id = NULL WHERE assigned_to = ?', [userId]);
}
