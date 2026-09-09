import { toUserId } from "@/model/user/user";
import type { AdminUserRow } from "./row";

/** 契約が許す姓名の最大長（`src/adapters/gen/api/endpoints.zod.ts`）。 */
const MAX_NAME_LENGTH = 100;

/** 折り返しの有無を見分けるため、区切りの無い長い語と日本語を混ぜる。 */
function longText(length: number): string {
  const unit = "長谷川ヴィクトリア-Bartholomew-Featherstonehaugh-";

  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
}

/**
 * 一覧に並ぶ利用者。
 *
 * @remarks
 * **有効な行と退会済みの行を混ぜてあります。**行ごとに出る操作が状態で変わるため、混ざった
 * 並びこそがこの一覧で確かめたい姿です。電話番号は桁数と記法（国番号・市外局番）を散らして
 * あり、列の幅が値で動かないことを見られます。
 */
export const ADMIN_USER_ROWS: readonly AdminUserRow[] = [
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000001"),
    name: "山田 太郎",
    email: "yamada@example.com",
    phone: "09012345678",
    withdrawn: false,
  },
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000002"),
    name: "佐藤 花子",
    email: "sato@example.com",
    phone: "08098765432",
    withdrawn: false,
  },
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000003"),
    name: "鈴木 一郎",
    email: "suzuki@example.com",
    phone: "+819011112222",
    withdrawn: false,
  },
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000004"),
    name: "田中 二郎",
    email: "tanaka@example.com",
    phone: "09012345678",
    withdrawn: true,
  },
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000005"),
    name: "高橋 三郎",
    email: "takahashi@example.com",
    phone: "0312345678",
    withdrawn: false,
  },
];

/** 退会済みだけの並び。どの行にも操作が出ないことを見るために置く。 */
export const WITHDRAWN_USER_ROWS: readonly AdminUserRow[] = [
  ...ADMIN_USER_ROWS.filter((row) => row.withdrawn),
  {
    id: toUserId("0195f0c2-0000-7000-8000-000000000006"),
    name: "伊藤 四郎",
    email: "ito@example.com",
    phone: "09022223333",
    withdrawn: true,
  },
];

/** 契約上の最大長を持つ姓名。表が自分の領域の中で横へ伸びるかを見るために置く。 */
export const LONG_NAME_USER_ROW: AdminUserRow = {
  id: toUserId("0195f0c2-0000-7000-8000-000000000007"),
  name: `${longText(MAX_NAME_LENGTH)} ${longText(MAX_NAME_LENGTH)}`,
  email: `${longText(60)}@example.com`,
  phone: "09012345678",
  withdrawn: false,
};
