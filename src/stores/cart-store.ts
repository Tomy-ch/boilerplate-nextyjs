"use client";

import { create } from "zustand";

/** カートの表示に関する要求と、その操作。 */
export type CartStore = {
  /**
   * 中身を見たいという要求。
   *
   * 要求をどう見せるかは器が決める。脇に常設できる幅では領域そのものの出し入れになり、それ未満では
   * 本文へ被せる drawer の開閉になる。
   */
  isOpen: boolean;
  /** 中身を見たいかどうかを指定する。 */
  setOpen: (isOpen: boolean) => void;
};

/**
 * カートを開いているかという横断 client 状態。
 *
 * @remarks
 * 商品側の「カートに追加」がこの要求を立て、カートの器がそれに従うため、feature を跨ぎます。
 *
 * **カートの中身は持ちません。** 明細も小計もバックエンドが所有しており、写しをここへ置くと
 * 鮮度の管理が client 側にも生まれます。
 *
 * 永続化しません。リロードすると閉じた状態から始まります。中身は残ります。
 */
export const useCartStore = create<CartStore>((set) => ({
  isOpen: false,

  setOpen: (isOpen) => set({ isOpen }),
}));
