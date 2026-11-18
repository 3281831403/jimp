import { expect, test, describe } from "vitest";
import { createJimp } from "@jimp/core";
import jpeg from "@jimp/js-jpeg";
import png from "@jimp/js-png";
import { makeTestImage } from "@jimp/test-utils";

import * as blit from "./index.js";

const Jimp = createJimp({ formats: [jpeg, png], plugins: [blit.methods] });

describe("Blit over image", function () {
  const targetImg = Jimp.fromBitmap(
    makeTestImage(
      "▴▴▴▴▸▸▸▸",
      "▴▴▴▴▸▸▸▸",
      "▴▴▴▴▸▸▸▸",
      "▴▴▴▴▸▸▸▸",
      "▾▾▾▾◆◆◆◆",
      "▾▾▾▾◆◆◆◆",
      "▾▾▾▾◆◆◆◆",
      "▾▾▾▾◆◆◆◆",
    ),
  );
  // stores the Jimp instances of the JGD images above.
  // prettier-ignore
  const srcImg = Jimp.fromBitmap(makeTestImage(
    "□□□□□□",
    "□▥▥▥▥□",
    "□▥■■▥□",
    "□▥■■▥□",
    "□▥▥▥▥□",
    "□□□□□□"
  ));

  test("blit on top, with no crop", () => {
    expect(targetImg.clone().blit(srcImg)).toMatchSnapshot();
  });

  test("blit on middle, with no crop", () => {
    expect(
      targetImg.clone().blit({ src: srcImg, x: 1, y: 1 }),
    ).toMatchSnapshot();
  });

  test("blit on middle, with x,y crop", () => {
    expect(
      targetImg
        .clone()
        .blit({ src: srcImg, x: 2, y: 2, srcX: 1, srcY: 1, srcW: 5, srcH: 5 }),
    ).toMatchSnapshot();
  });

  test("blit on middle, with x,y,w,h crop", () => {
    expect(
      targetImg
        .clone()
        .blit({ src: srcImg, x: 2, y: 2, srcX: 1, srcY: 1, srcW: 4, srcH: 4 }),
    ).toMatchSnapshot();
  });

  test("blit partially out, on top-left", () => {
    expect(
      targetImg.clone().blit({ src: srcImg, x: -1, y: -1 }),
    ).toMatchSnapshot();
  });

  test("blit partially out, on bottom-right", () => {
    expect(
      targetImg.clone().blit({ src: srcImg, x: 3, y: 3 }),
    ).toMatchSnapshot();
  });
});

describe("Blit alpha compositing", () => {
  function solidImage(rgba: number) {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(rgba >>> 0, 0);

    return Jimp.fromBitmap({ width: 1, height: 1, data });
  }

  const halfWhite = () => solidImage(0xffffff80);

  test("half-transparent source keeps its color and alpha on an empty canvas", () => {
    const out = solidImage(0x00000000).blit({ src: halfWhite() });

    // same result as Jimp#composite: (255, 255, 255, 128)
    expect([...out.bitmap.data]).toEqual([255, 255, 255, 128]);
  });

  test("stacking two half-transparent layers composes alpha like composite", () => {
    const out = solidImage(0x00000000)
      .blit({ src: halfWhite() })
      .blit({ src: halfWhite() });

    // src-over: a = 0.5 + 0.5 - 0.25 = 0.75 -> 191, color stays white
    expect([...out.bitmap.data]).toEqual([255, 255, 255, 191]);
  });

  test("opaque source is blitted byte-for-byte", () => {
    const dst = solidImage(0x11223344);
    const src = solidImage(0xaabbccff);

    dst.blit({ src });

    expect([...dst.bitmap.data]).toEqual([170, 187, 204, 255]);
  });

  test("fully transparent source leaves the destination untouched", () => {
    const dst = solidImage(0x11223344);
    const src = solidImage(0xff000000);

    dst.blit({ src });

    expect([...dst.bitmap.data]).toEqual([17, 34, 51, 68]);
  });
});
