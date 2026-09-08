import { TravelDataSchema, assertReferentialIntegrity, type TravelData } from '../domain/travel-data.ts';

export async function loadTravelData(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<TravelData> {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const response = await fetcher(`${normalizedBase}data/travel-data.json`);
  if (!response.ok) throw new Error(`Unable to load travel data (${response.status})`);

  const data = TravelDataSchema.parse(await response.json());
  assertReferentialIntegrity(data);
  return data;
}
