import { z } from "zod";

import { META_KEY, portalManifestSchema } from "./portal-manifest";

/** ルート直下の `*.md` をまとめる section id。 */
const ROOT_MD_SECTION_ID = "overview";

const subgroupConfigSchema = z.object({
  title: z.string(),
  items: z.array(z.string()).default([]),
});

const groupConfigSchema = z.object({
  title: z.string(),
  sections: z.array(z.string()).default([]),
});

/**
 * サイドバー下部の常設リンク。
 *
 * section id を書くと、その section の代表項目へのリンクになる。加えて
 * `{title, path}` を直接書ける。Storybook のように portal と同じサイトへ並ぶが `docs/`
 * 配下には存在しない生成物は、section として発見されないため id では指せない。
 */
const referenceLinkConfigSchema = z.union([
  z.string(),
  z.object({ title: z.string(), path: z.string() }),
]);

// 各フィールドが既定値を持つため、`{}` を渡せば全項目が埋まる。外側の既定は置かない。
const metaSchema = z.object({
  title: z.string().default("Documentation"),
  subtitle: z.string().default(""),
  groups: z.array(groupConfigSchema).default([]),
  section_titles: z.record(z.string(), z.string()).default({}),
  reference_links: z.array(referenceLinkConfigSchema).default([]),
  subgroups: z.record(z.string(), z.array(subgroupConfigSchema)).default({}),
});

/** `docs/` を走査して得た内容。FS へ触るのは呼び出し元の責務にする。 */
export type DiscoveredDirectory = {
  name: string;
  hasIndexHtml: boolean;
  enFiles: readonly string[];
  jaFiles: readonly string[];
};

export type DiscoveredDocs = {
  directories: readonly DiscoveredDirectory[];
  rootEnFiles: readonly string[];
  rootJaFiles: readonly string[];
};

type DocItem = {
  name: string;
  path: string;
  source: string;
  lang: "en" | "ja" | "all";
};

type WorkingSection = {
  id: string;
  title: string;
  items: WorkingItem[];
  seenPaths: Set<string>;
};

type WorkingItem = DocItem & { guideId: string };

export function autoTitle(value: string): string {
  return value
    .replace(/\.md$/, "")
    .replace(/\.ja$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 経路の末尾要素。`split().pop()` と違い、常に文字列になる。 */
function basename(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

function langOf(destination: string): "en" | "ja" {
  return destination.includes("/ja/") || /\.ja\.md$/.test(destination) ? "ja" : "en";
}

/**
 * 項目を subgroup へ割り当てるための識別子を導く。
 *
 * `.ja.md` は 2 段、それ以外の拡張子は 1 段だけ落とす。EN と JA の対を同じ識別子へ寄せつつ、
 * `foo.html.md` と `foo.html` を別物として扱うため。
 */
export function guideIdOf(filePath: string): string {
  const base = basename(filePath);

  if (/\.ja\.md$/i.test(base)) {
    return base.replace(/\.ja\.md$/i, "");
  }

  if (/\.md$/i.test(base)) {
    return base.replace(/\.md$/i, "");
  }

  if (/\.html$/i.test(base)) {
    return base.replace(/\.html$/i, "");
  }

  return base;
}

function createSectionStore(sectionTitles: Record<string, string>) {
  const sections = new Map<string, WorkingSection>();
  const warnings: string[] = [];

  function ensure(id: string, fallbackTitle: string): WorkingSection {
    const existing = sections.get(id);

    if (existing) {
      return existing;
    }

    const created: WorkingSection = {
      id,
      title: sectionTitles[id] ?? fallbackTitle,
      items: [],
      seenPaths: new Set(),
    };

    sections.set(id, created);

    return created;
  }

  function add(section: WorkingSection, item: DocItem, guideId: string): void {
    if (section.seenPaths.has(item.path)) {
      warnings.push(`重複した項目を飛ばしました: section="${section.id}" path="${item.path}"`);

      return;
    }

    section.seenPaths.add(item.path);
    section.items.push({ ...item, guideId });
  }

  return { add, ensure, sections, warnings };
}

const LANG_ORDER: Record<DocItem["lang"], number> = { en: 0, ja: 1, all: 2 };

/**
 * manifest と走査結果から `docs.json` を組む。
 *
 * @remarks
 * FS へは触りません。走査結果を受け取る形にして、経路の組み立てと分類の規則だけをここに
 * 閉じ込めています。
 *
 * 警告は投げずに返します。manifest の記述漏れは配信を止めるほどではない一方、黙って
 * 消えると気付けないためです。
 */
export function buildDocsJson(manifest: unknown, discovered: DiscoveredDocs) {
  const parsed = portalManifestSchema.parse(manifest);
  const meta = metaSchema.parse(parsed[META_KEY] ?? {});
  const store = createSectionStore(meta.section_titles);

  for (const [sectionId, value] of Object.entries(parsed)) {
    if (sectionId === META_KEY || !Array.isArray(value)) {
      continue;
    }

    const section = store.ensure(sectionId, autoTitle(sectionId));

    for (const entry of value) {
      store.add(
        section,
        {
          name: autoTitle(basename(entry.dst)),
          path: entry.dst.replace(/^docs\/portal\//, "./"),
          source: entry.src,
          lang: langOf(entry.dst),
        },
        guideIdOf(entry.dst),
      );
    }
  }

  for (const directory of discovered.directories) {
    if (!directory.hasIndexHtml && !directory.enFiles.length && !directory.jaFiles.length) {
      continue;
    }

    const section = store.ensure(directory.name, autoTitle(directory.name));

    if (directory.hasIndexHtml) {
      store.add(
        section,
        {
          name: section.title,
          path: `../${directory.name}/index.html`,
          source: `docs/${directory.name}/index.html`,
          lang: "all",
        },
        directory.name,
      );
    }

    for (const file of directory.enFiles) {
      store.add(
        section,
        {
          name: autoTitle(file),
          path: `../${directory.name}/${file}`,
          source: `docs/${directory.name}/${file}`,
          lang: "en",
        },
        guideIdOf(file),
      );
    }

    for (const file of directory.jaFiles) {
      store.add(
        section,
        {
          name: autoTitle(file),
          path: `../ja/${directory.name}/${file}`,
          source: `docs/ja/${directory.name}/${file}`,
          lang: "ja",
        },
        guideIdOf(file),
      );
    }
  }

  if (discovered.rootEnFiles.length || discovered.rootJaFiles.length) {
    const section = store.ensure(ROOT_MD_SECTION_ID, autoTitle(ROOT_MD_SECTION_ID));

    for (const file of discovered.rootEnFiles) {
      store.add(
        section,
        { name: autoTitle(file), path: `../${file}`, source: `docs/${file}`, lang: "en" },
        guideIdOf(file),
      );
    }

    for (const file of discovered.rootJaFiles) {
      store.add(
        section,
        { name: autoTitle(file), path: `../ja/${file}`, source: `docs/ja/${file}`, lang: "ja" },
        guideIdOf(file),
      );
    }
  }

  for (const section of store.sections.values()) {
    section.items.sort((left, right) =>
      LANG_ORDER[left.lang] === LANG_ORDER[right.lang]
        ? left.name.localeCompare(right.name)
        : LANG_ORDER[left.lang] - LANG_ORDER[right.lang],
    );
  }

  const subgroupsBySection = new Map<string, { title: string; items: WorkingItem[] }[]>();

  for (const [sectionId, configs] of Object.entries(meta.subgroups)) {
    const section = store.sections.get(sectionId);

    if (!section) {
      store.warnings.push(`meta.subgroups: section id "${sectionId}" は存在しません`);

      continue;
    }

    const byGuideId = new Map<string, WorkingItem[]>();

    for (const item of section.items) {
      byGuideId.set(item.guideId, [...(byGuideId.get(item.guideId) ?? []), item]);
    }

    const subgroups: { title: string; items: WorkingItem[] }[] = [];
    const placed = new Set<string>();

    for (const config of configs) {
      const items: WorkingItem[] = [];

      for (const guideId of config.items) {
        const matched = byGuideId.get(guideId);

        if (!matched) {
          store.warnings.push(
            `meta.subgroups[${sectionId}][${config.title}]: guide id "${guideId}" は存在しません`,
          );

          continue;
        }

        placed.add(guideId);
        items.push(...matched);
      }

      if (items.length) {
        subgroups.push({ title: config.title, items });
      }
    }

    const others = section.items.filter((item) => !placed.has(item.guideId));

    if (others.length) {
      subgroups.push({ title: "Other", items: others });
    }

    if (subgroups.length) {
      subgroupsBySection.set(sectionId, subgroups);
    }
  }

  // guideId は subgroup へ割り当てるための内部の鍵であり、ビューアーは使わない。
  const toOutputItem = ({ guideId: _guideId, ...item }: WorkingItem): DocItem => item;

  const toOutputSection = (section: WorkingSection) => {
    const subgroups = subgroupsBySection.get(section.id);

    return {
      id: section.id,
      slug: slugify(section.id),
      title: section.title,
      items: section.items.map(toOutputItem),
      ...(subgroups
        ? {
            subgroups: subgroups.map((subgroup) => ({
              title: subgroup.title,
              items: subgroup.items.map(toOutputItem),
            })),
          }
        : {}),
    };
  };

  const groups: { title: string; slug: string; sections: ReturnType<typeof toOutputSection>[] }[] =
    [];
  const placedSectionIds = new Set<string>();

  for (const config of meta.groups) {
    const groupSections: ReturnType<typeof toOutputSection>[] = [];

    for (const id of config.sections) {
      const section = store.sections.get(id);

      if (!section) {
        store.warnings.push(
          `meta.groups: section id "${id}" は存在しません（group: ${config.title}）`,
        );

        continue;
      }

      if (placedSectionIds.has(id)) {
        store.warnings.push(
          `meta.groups: section id "${id}" が複数の group にあります（"${config.title}" 側を飛ばしました）`,
        );

        continue;
      }

      placedSectionIds.add(id);
      groupSections.push(toOutputSection(section));
    }

    if (groupSections.length) {
      groups.push({ title: config.title, slug: slugify(config.title), sections: groupSections });
    }
  }

  const referenceLinks: { sectionId: string; title: string; path: string }[] = [];

  for (const config of meta.reference_links) {
    if (typeof config !== "string") {
      referenceLinks.push({ sectionId: slugify(config.title), ...config });

      continue;
    }

    placedSectionIds.add(config);

    const section = store.sections.get(config);

    if (!section) {
      store.warnings.push(`meta.reference_links: section id "${config}" は存在しません`);

      continue;
    }

    const primary = section.items[0];

    if (primary) {
      referenceLinks.push({ sectionId: config, title: section.title, path: primary.path });
    }
  }

  const orphans = [...store.sections.values()].filter(
    (section) => !placedSectionIds.has(section.id),
  );

  if (orphans.length) {
    groups.push({
      title: "Uncategorized",
      slug: "uncategorized",
      sections: orphans
        .sort((left, right) => left.title.localeCompare(right.title))
        .map(toOutputSection),
    });
    store.warnings.push(
      `どの group にも入っていない section (${orphans.map((section) => section.id).join(", ")}) を "Uncategorized" へまとめました`,
    );
  }

  return {
    docs: { title: meta.title, subtitle: meta.subtitle, groups, referenceLinks },
    warnings: store.warnings,
  };
}
