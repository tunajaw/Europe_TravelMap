export type OsmNameTags = Record<string, string | undefined>;

export type LocalizedPoiName = {
  name: string;
  originalName: string;
  language: 'zh-Hant' | 'zh' | 'source';
};

export function localizedPoiName(originalName: string, tags: OsmNameTags = {}): LocalizedPoiName {
  const traditionalChinese = tags['name:zh-Hant']?.trim();
  if (traditionalChinese) return { name: traditionalChinese, originalName, language: 'zh-Hant' };

  const chinese = tags['name:zh']?.trim();
  if (chinese) return { name: chinese, originalName, language: 'zh' };

  return { name: originalName, originalName, language: 'source' };
}
