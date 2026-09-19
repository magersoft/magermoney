import {
  InflowDtoSchema,
  type CreateInflowInput,
  type InflowDto,
  type UpdateInflowInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const inflowList = listOf(InflowDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };
/** The API's largest page. A month of inflows is a handful of rows; a source's whole history pages by cursor if it ever outgrows this. */
export const INFLOWS_PAGE = 200;

export interface InflowListParams {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
}

export const inflowsApi = (client: ApiClient) => ({
  list: async (params: InflowListParams): Promise<InflowDto[]> => {
    const q = new URLSearchParams({ limit: String(INFLOWS_PAGE) });
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.sourceId) q.set('sourceId', params.sourceId);
    return parse(await client.fetch(`/inflows?${q}`, { method: 'GET' }), inflowList);
  },
  create: async (input: CreateInflowInput): Promise<InflowDto> =>
    parse(
      await client.fetch('/inflows', { method: 'POST', body: JSON.stringify(input) }),
      InflowDtoSchema,
    ),
  update: async (id: string, input: UpdateInflowInput): Promise<InflowDto> =>
    parse(
      await client.fetch(`/inflows/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      InflowDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/inflows/${id}`, { method: 'DELETE' }), noContent),
});
