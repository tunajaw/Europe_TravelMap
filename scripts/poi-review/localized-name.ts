export type OsmNameTags = Record<string, string | undefined>;

export type LocalizedPoiName = {
  name: string;
  originalName: string;
  language: 'zh-Hant' | 'zh' | 'source';
};

export type BilingualPoiName = {
  name: string;
  localizedName: string | null;
};

const meaningfulChineseFragment = /\p{Script=Han}{2,}(?:[\-·・‧／/]\p{Script=Han}{2,})*/gu;
const latinLetter = /\p{Script=Latin}/u;

const mergeLocalizedNames = (localizedName: string | null, fragments: string[]): string | null => {
  const names = [localizedName?.trim(), ...fragments]
    .filter((value): value is string => Boolean(value));
  return names.filter((value, index) => names.indexOf(value) === index).join('／') || null;
};

/**
 * Separates meaningful Chinese words accidentally embedded in a Latin/source
 * display name. A two-Han-character minimum avoids treating mojibake such as
 * `W羹rzburg` as a Chinese translation. Pure Chinese names are preserved when
 * no reliable Latin/source name is available.
 */
export function separateChinesePoiName(
  name: string,
  localizedName: string | null,
): BilingualPoiName {
  if (!latinLetter.test(name)) return { name, localizedName };

  const fragments = [...name.matchAll(meaningfulChineseFragment)].map(([fragment]) => fragment);
  if (fragments.length === 0) return { name, localizedName };

  const mainName = name
    .replace(meaningfulChineseFragment, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:|/／\-–—·・‧]+|[\s,;:|/／\-–—·・‧]+$/g, '')
    .trim();
  if (!mainName || !latinLetter.test(mainName)) return { name, localizedName };

  return {
    name: mainName,
    localizedName: mergeLocalizedNames(localizedName, fragments),
  };
}

export function localizedPoiName(originalName: string, tags: OsmNameTags = {}): LocalizedPoiName {
  const traditionalChinese = tags['name:zh-Hant']?.trim();
  if (traditionalChinese) return { name: traditionalChinese, originalName, language: 'zh-Hant' };

  const chinese = tags['name:zh']?.trim();
  if (chinese) return { name: chinese, originalName, language: 'zh' };

  return { name: originalName, originalName, language: 'source' };
}
