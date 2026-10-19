export interface LegacyProfilePreview { id: string; name: string }
/** Preview only: creating or mapping each source identity requires an explicit teacher action. */
export function previewLegacyProfiles(json: string): LegacyProfilePreview[] {
  if (json.length > 1_000_000) throw Error('Choose a roster smaller than 1 MB.');
  const value = JSON.parse(json);
  const rows = Array.isArray(value) ? value : value?.studentRoster;
  if (!Array.isArray(rows) || rows.length > 1000) throw Error('Expected a studentRoster array with at most 1,000 profiles.');
  const ids = new Set<string>();
  return rows.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || row.id.length > 200 || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 200) throw Error('Each legacy profile needs an ID and display name.');
    if (ids.has(row.id)) throw Error('Duplicate source IDs must be resolved before mapping.');
    ids.add(row.id);
    return { id: row.id, name: row.name.trim() };
  });
}
