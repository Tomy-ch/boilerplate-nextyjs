// image:tag → digest の解決と、解決先の公開日の取得。
// ネットワークに出るのはこのモジュールだけで、apply / check は完全にオフラインで動く。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const NETWORK_TIMEOUT_MS = 60_000;
const MS_PER_DAY = 86_400_000;
const DIGEST_PATTERN = /^Digest:[ \t]+(sha256:[0-9a-f]{64})$/m;

type ImageConfig = { created?: unknown };

/** inspect 出力から index digest を取り出す。 */
export function parseDigest(out: string): string {
  const digest = DIGEST_PATTERN.exec(out)?.[1];
  if (digest === undefined) throw new Error("Digest 行を解釈できません");

  return digest;
}

/**
 * image config の JSON から最も古い作成時刻を返す。
 *
 * @remarks
 * マルチアーキの image は platform ごとの config を持ち、それぞれ作成時刻が違います。最も
 * 古いものを採るのは、検疫が「この参照はいつから存在するか」を問うものだからです。新しい方を
 * 採ると、既存の image に 1 アーキテクチャを足しただけで検疫に掛かります。
 */
export function earliestCreated(json: string): Date {
  const parsed = JSON.parse(json) as ImageConfig | Record<string, ImageConfig>;
  const configs = isConfig(parsed) ? [parsed] : Object.values(parsed);

  const times = configs
    .map((config) =>
      typeof config?.created === "string" ? Date.parse(config.created) : Number.NaN,
    )
    .filter((time) => !Number.isNaN(time));
  if (times.length === 0) throw new Error("image config の created を解釈できません");

  return new Date(Math.min(...times));
}

/** image:tag が現在指している index digest を registry から取得する。 */
export async function resolveDigest(reference: string): Promise<string> {
  return parseDigest(await inspect(reference));
}

/** image:tag が指す digest の公開からの経過日数。 */
export async function imageAgeDays(reference: string): Promise<number> {
  const created = earliestCreated(await inspect(reference, "--format", "{{ json .Image }}"));

  return Math.floor((Date.now() - created.getTime()) / MS_PER_DAY);
}

function isConfig(value: ImageConfig | Record<string, ImageConfig>): value is ImageConfig {
  return "created" in value;
}

async function inspect(reference: string, ...extra: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["buildx", "imagetools", "inspect", reference, ...extra],
      { timeout: NETWORK_TIMEOUT_MS },
    );

    return stdout;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`docker buildx imagetools inspect ${reference}: ${message.trim()}`);
  }
}
