/**
 * The AI Barista (Blueprint §6.4/§6.5).
 *
 * Real tool-calling into the SAME service layer the REST API uses — not a
 * scripted demo. When `GROQ_API_KEY` is absent the tools still run for real
 * against the real catalogue; only the language generation falls back to a
 * local responder, so the recommend → add-to-cart round trip works either way.
 */
import { env, features } from '@/config/env';
import { formatMoney } from '@/domain/money';
import { getMenu } from './catalog';
import { availability } from './reservation';
import { trackOrder } from './order';
import { listStores } from '@/repositories';
import { toDateKey } from '@/domain/slots';
import { ORDER_NUMBER_PATTERN, normaliseOrderNumber } from '@/lib/ids';
import type { Drink } from '@/domain/types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  action?: ChatAction | null;
}

export type ChatAction =
  | { kind: 'add_to_cart'; drinkSlug: string; drinkName: string; quantity: number }
  | { kind: 'open'; href: string; label: string };

const SYSTEM_PROMPT = `You are the AURA TOAST barista.

Voice: warm, precise, a little poetic, never saccharine. Short sentences.
Concrete nouns over adjectives — "1,750m, Chikmagalur, washed" beats
"exceptionally smooth and refined." Never use the words premium, artisanal,
elevated, or journey. Two or three sentences unless asked for more.

You know only what the tools return. If a tool gives you nothing, say so
plainly and offer the nearest real thing. Never invent a drink, a price, an
origin, or an order number.`;

/* ── Tools — each one calls the real service layer ───────────────────── */
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_menu',
      description:
        'Search the live menu by mood, taste, dietary need, temperature or name. Returns real drinks with real prices.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What the guest is after' },
          dairyFree: { type: 'boolean' },
          iced: { type: 'boolean' },
          maxCaffeineMg: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_to_cart',
      description: 'Add a drink to the guest cart by its slug. Only use slugs returned by search_menu.',
      parameters: {
        type: 'object',
        properties: {
          drinkSlug: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['drinkSlug'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_order',
      description: 'Look up the live status of an order by its order number, e.g. AT-7K3M9Q.',
      parameters: {
        type: 'object',
        properties: { orderNumber: { type: 'string' } },
        required: ['orderNumber'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_tables',
      description: 'Check table availability at a store on a date (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: { store: { type: 'string' }, date: { type: 'string' } },
        required: [],
      },
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'search_menu': {
      const { drinks } = await getMenu();
      const q = String(args.query ?? '').toLowerCase();
      let rows = drinks.filter((d) => d.isAvailable);
      if (args.dairyFree) rows = rows.filter((d) => !d.allergens.includes('dairy'));
      if (args.iced === true) rows = rows.filter((d) => d.isIced);
      if (args.iced === false) rows = rows.filter((d) => !d.isIced);
      if (typeof args.maxCaffeineMg === 'number') {
        rows = rows.filter((d) => d.caffeineMg <= (args.maxCaffeineMg as number));
      }
      const scored = rows
        .map((d) => ({ d, score: scoreDrink(d, q) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      return {
        results: scored.map(({ d }) => ({
          slug: d.slug,
          name: d.name,
          price: formatMoney(d.basePrice),
          notes: d.tastingNotes,
          caffeineMg: d.caffeineMg,
          iced: d.isIced,
          dairy: d.allergens.includes('dairy'),
          description: d.description,
        })),
      };
    }
    case 'add_to_cart': {
      const { drinks } = await getMenu();
      const drink = drinks.find((d) => d.slug === args.drinkSlug);
      if (!drink) return { error: 'no such drink' };
      return {
        added: true,
        drinkSlug: drink.slug,
        drinkName: drink.name,
        quantity: Number(args.quantity ?? 1) || 1,
        price: formatMoney(drink.basePrice),
      };
    }
    case 'check_order': {
      try {
        const { order, state } = await trackOrder(normaliseOrderNumber(String(args.orderNumber ?? '')));
        return {
          orderNumber: order.orderNumber,
          stage: state.currentStage,
          etaMinutes: state.etaMs != null ? Math.ceil(state.etaMs / 60000) : null,
          total: formatMoney(order.total),
        };
      } catch {
        return { error: 'no such order' };
      }
    }
    case 'check_tables': {
      const stores = await listStores();
      const store =
        stores.find((s) => s.slug === args.store || s.name.toLowerCase() === String(args.store ?? '').toLowerCase()) ??
        stores[0];
      const date = String(args.date ?? toDateKey(new Date()));
      const a = await availability(store.id, date);
      return {
        store: store.name,
        date,
        open: a.slots.filter((s) => s.state === 'available' || s.state === 'tight').slice(0, 6).map((s) => s.time),
      };
    }
    default:
      return { error: 'unknown tool' };
  }
}

function scoreDrink(d: Drink, q: string): number {
  if (!q) return d.isSeasonal ? 2 : 1;
  const terms = q.split(/\s+/).filter(Boolean);
  let s = 0;
  const hay = `${d.name} ${d.description} ${d.longDescription} ${d.tastingNotes.join(' ')} ${d.category}`.toLowerCase();
  for (const t of terms) if (hay.includes(t)) s += 2;
  if (/sweet|dessert/.test(q) && /honey|vanilla|chocolate|sugar/.test(hay)) s += 3;
  if (/strong|wake|intense/.test(q)) s += d.intensity;
  if (/light|gentle|mild|calm/.test(q)) s += 5 - d.intensity;
  if (/hot|warm/.test(q) && !d.isIced) s += 2;
  if (/cold|ice/.test(q) && d.isIced) s += 3;
  if (/vegan|dairy|lactose/.test(q) && !d.allergens.includes('dairy')) s += 3;
  return s;
}

/* ── Groq (free tier) ────────────────────────────────────────────────── */
async function groqComplete(messages: unknown[], withTools: boolean) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 420,
      ...(withTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  return (await res.json()) as {
    choices: {
      message: {
        content: string | null;
        tool_calls?: { id: string; function: { name: string; arguments: string } }[];
      };
    }[];
  };
}

export interface BaristaReply {
  reply: string;
  action: ChatAction | null;
  toolsUsed: string[];
  source: 'groq' | 'local';
}

export async function askBarista(history: ChatMessage[], userText: string): Promise<BaristaReply> {
  const toolsUsed: string[] = [];
  let action: ChatAction | null = null;

  if (features.groq) {
    try {
      const messages: Record<string, unknown>[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userText },
      ];

      const first = await groqComplete(messages, true);
      const choice = first.choices[0].message;

      if (choice.tool_calls?.length) {
        messages.push({ role: 'assistant', content: choice.content ?? '', tool_calls: choice.tool_calls });
        for (const call of choice.tool_calls) {
          const args = safeJson(call.function.arguments);
          const result = await runTool(call.function.name, args);
          toolsUsed.push(call.function.name);
          if (call.function.name === 'add_to_cart' && (result as { added?: boolean }).added) {
            const r = result as { drinkSlug: string; drinkName: string; quantity: number };
            action = { kind: 'add_to_cart', drinkSlug: r.drinkSlug, drinkName: r.drinkName, quantity: r.quantity };
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        const second = await groqComplete(messages, false);
        return {
          reply: second.choices[0].message.content?.trim() || 'Here is what I found.',
          action,
          toolsUsed,
          source: 'groq',
        };
      }

      return {
        reply: choice.content?.trim() || 'Ask me for something and I will find it on the bar.',
        action: null,
        toolsUsed,
        source: 'groq',
      };
    } catch {
      /* fall through to the local responder — a chat outage is not an outage */
    }
  }

  return localBarista(userText, toolsUsed);
}

/**
 * The keyless path. The TOOLS still run for real — this only replaces the
 * language model, so recommend → add-to-cart genuinely works with no API key.
 */
async function localBarista(userText: string, toolsUsed: string[]): Promise<BaristaReply> {
  const q = userText.toLowerCase();

  const orderMatch = userText.match(ORDER_NUMBER_PATTERN);
  if (orderMatch) {
    toolsUsed.push('check_order');
    const wanted = normaliseOrderNumber(orderMatch[0]);
    const r = (await runTool('check_order', { orderNumber: wanted })) as Record<string, unknown>;
    if (r.error) {
      return { reply: `I cannot find ${wanted}. Check the number on your receipt.`, action: null, toolsUsed, source: 'local' };
    }
    return {
      reply: `${r.orderNumber} is ${String(r.stage).replace(/_/g, ' ')}${r.etaMinutes ? `, about ${r.etaMinutes} minutes out` : ''}. ${r.total} total.`,
      action: { kind: 'open', href: `/track/${r.orderNumber}`, label: 'Watch it move' },
      toolsUsed,
      source: 'local',
    };
  }

  if (/table|reserv|book|seat/.test(q)) {
    toolsUsed.push('check_tables');
    const r = (await runTool('check_tables', {})) as { store: string; date: string; open: string[] };
    return {
      reply: r.open.length
        ? `${r.store} has ${r.open.slice(0, 4).join(', ')} open today. Thirty-minute slots, hard capacity — when it says full, it is full.`
        : `${r.store} is full today. Try tomorrow, or the Jayanagar room.`,
      action: { kind: 'open', href: '/reservations', label: 'Pick a slot' },
      toolsUsed,
      source: 'local',
    };
  }

  toolsUsed.push('search_menu');
  const dairyFree = /vegan|dairy|lactose|oat|almond|soy/.test(q);
  const iced = /cold|ice|iced|chilled/.test(q) ? true : /hot|warm/.test(q) ? false : undefined;
  const res = (await runTool('search_menu', { query: q, dairyFree, iced })) as {
    results: { slug: string; name: string; price: string; notes: string[]; description: string }[];
  };

  if (!res.results.length) {
    return {
      reply: 'Nothing on the bar matches that today. Tell me a mood instead — sharp, heavy, gentle, cold — and I will find the nearest real thing.',
      action: null,
      toolsUsed,
      source: 'local',
    };
  }

  const [top, ...rest] = res.results;
  const alt = rest.length ? ` If that is not it, the ${rest[0].name} goes the other direction.` : '';
  return {
    reply: `The ${top.name}, ${top.price}. ${top.description} ${top.notes.join(', ')}.${alt}`,
    action: { kind: 'add_to_cart', drinkSlug: top.slug, drinkName: top.name, quantity: 1 },
    toolsUsed,
    source: 'local',
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const BARISTA_SUGGESTIONS = [
  'Something sharp to wake me up',
  'Cold, not sweet',
  'What is dairy-free?',
  'Book me a table',
] as const;
